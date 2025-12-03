/* -- ALL OF THE FIREBASE IMPORTS --*/
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  deleteDoc,
  updateDoc,
  increment,
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC1X3eQaWxuFZt-Jrrzxl_X7RPzD1ooRd8",
  authDomain: "calendar-app-eeda4.firebaseapp.com",
  projectId: "calendar-app-eeda4",
  storageBucket: "calendar-app-eeda4.firebasestorage.app",
  messagingSenderId: "135200443171",
  appId: "1:135200443171:web:d842dc61da8fcae97d5a96",
  measurementId: "G-B0DBRK6MM2",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// represents the ID of the user logged in; assume nobody is logged in, so set it to null
let USERS_CURRENT_ID = null;
// the current date selected, set to today by default
let selecteddate = new Date();

/* --- HELPER FUNCTION FOR CONVERTING DATES TO YYYY-MM-DD FORMAT --- */
function formatDate(dateObj) {
  // gets year
  let year = dateObj.getFullYear();

  // gets month index, adds 1 to make up for the index
  let monthnumber = dateObj.getMonth() + 1;
  // represents the month as a string
  let monthstring = String(monthnumber);

  // pads the month or day with a 0 in front if it's a single digit number
  if (monthstring.length === 1) {
    monthstring = "0" + monthstring;
  }
  let daynumber = dateObj.getDate();
  let daystring = String(daynumber);

  if (daystring.length === 1) {
    daystring = "0" + daystring;
  }

  return year + "-" + monthstring + "-" + daystring; //yyyy-mm-dd
}

/* --- CREATES DOC IDS IN THIS FORMAT: 20251112-Homework --- */
function makeUniqueDocId(formattedDate, title) {
  return formattedDate.replaceAll("-", "") + title;
}

/* --- HELPER FUNCTION TO CALCULATE # OF DAYS IN MONTH --- */
function daysInMonth(indexofmonth, year) {
  // whenever the day number is 0, javascript interprets it as the final day of the last month
  // 2025, 3, 0 means the 0th day of april, aka march 31st
  let dateObject = new Date(year, indexofmonth + 1, 0);
  return dateObject.getDate();
}

/* --- variables that we connect to html elements later on  --- */
let taskList;
let taskInput;
let calendarContainer;
let collapseButton;

/* --- FOR CREATING NEW TASK ITEMS --- */
/* changed the original function so that task creation only happens in a single spot;
   before, addTask() was making new list items, but it didn't include the 
   redirect to the edit page or priority borders, and loadTasksForTheDay was only making
   task items for loaded tasks, so there was a lot of repeated code;
   this also fixed the reload bug when editing tasks
*/
function createTask(taskId, taskinfo, tasklocation = null) {
  const taskItem = document.createElement("li");

  // saves the task id and priority level inside the list item
  taskItem.dataset.taskId = taskId;
  taskItem.dataset.priority = (taskinfo.priority || "").toLowerCase();

  // assigns each task a css class based on priority (only used for styling)
  if (taskItem.dataset.priority === "high")
    taskItem.classList.add("highpriority");
  else if (taskItem.dataset.priority === "medium")
    taskItem.classList.add("mediumpriority");
  else if (taskItem.dataset.priority === "low")
    taskItem.classList.add("lowpriority");

  // displays the name of the task
  taskItem.textContent = taskinfo.title;

  // for creating the groups icon to the right of every group task
  if (tasklocation && tasklocation.path.includes("groups")) {
    const groupicon = document.createElement("img");
    groupicon.src = "/img/groupicon.png";
    groupicon.style.width = "80px";
    groupicon.style.position = "absolute";
    groupicon.style.right = "90px";
    groupicon.style.top = "10%";
    taskItem.style.position = "relative"; // makes the li the context that its being positioned in
    taskItem.appendChild(groupicon);
  }

  // creates delete button, attaches it to task
  const deletebutton = document.createElement("button");
  deletebutton.textContent = "X";
  taskItem.appendChild(deletebutton);

  async function completeAndDeleteTask(taskRef) {
    const taskSnap = await getDoc(taskRef);
    if (taskSnap.exists()) {
      const taskData = taskSnap.data();
      const completedRef = doc(
        taskRef.parent.parent,
        "completedTasks",
        taskRef.id
      );
      await setDoc(completedRef, {
        ...taskData,
        done: true,
        completedAt: new Date(),
        completedBy: auth.currentUser.uid,
      });
    }
    await deleteDoc(taskRef);
  }

  // CHANGES MADE HERE TO ACCOMODATE THE NEW FEATURE (FOR COMPLETED GROUP TASKS)
  deletebutton.onclick = async () => {
    if (tasklocation) {
      await completeAndDeleteTask(tasklocation);
    } else if (USERS_CURRENT_ID) {
      const taskRef = doc(
        db,
        "personal-tasks",
        USERS_CURRENT_ID,
        "tasks",
        taskId
      );
      await completeAndDeleteTask(taskRef);
    }

    // increment user’s completed counter
    if (USERS_CURRENT_ID) {
      const currentuserdoc = doc(db, "users", USERS_CURRENT_ID);
      await updateDoc(currentuserdoc, { tasksCompleted: increment(1) });
    }

    taskItem.remove();
    updateNote();
  };

  // redirects to the task editing page with the correct task id in the url whenever the task is clicked on
  if (!tasklocation || tasklocation.path.includes("groups")) {
    taskItem.onclick = null; // note: I added this line to disable editing for group tasks
  } else {
    taskItem.onclick = (e) => {
      if (e.target.closest("button")) return; // stops if the click was on the delete button
      window.location.href =
        "sofiasnewedit.html?taskId=" + encodeURIComponent(taskId);
    };
  }
  // adds new task to the list
  taskList.appendChild(taskItem);
}

/* --- LOADING TASKS FOR A SPECIFIC DAY --- */
// removed task creation section which is now handled by createTask()
async function loadTasksForTheDay(currentday) {
  // stops if no user is logged in
  if (!USERS_CURRENT_ID) return;

  // gets all tasks for this user from firestore
  const snapshot = await getDocs(
    collection(db, "personal-tasks", USERS_CURRENT_ID, "tasks")
  );

  // clears the current task list before adding new items
  taskList.innerHTML = "";

  // goes through each task in the snapshot
  for (let i = 0; i < snapshot.docs.length; i++) {
    const taskDoc = snapshot.docs[i]; // a single task from firestore
    const taskinfo = taskDoc.data(); // all of the task's info; title, date, priority level

    // only show tasks matching the currently selected day
    if (taskinfo.dateISO === currentday) {
      createTask(taskDoc.id, taskinfo, taskDoc.ref);
    }
  }

  // LOADS IN ALL GROUP TASKS
  const groupscollection = collection(db, "groups");
  const allgroupdocs = await getDocs(groupscollection);

  for (let i = 0; i < allgroupdocs.docs.length; i++) {
    // loops through each group
    const singleGroupSnapshot = allgroupdocs.docs[i]; // takes one group doc
    const singleGroupInfo = singleGroupSnapshot.data(); // reads its fields

    if (singleGroupInfo.members) {
      // checks if the group has members
      let userIsMember = false; // starts with the assumption that they're not a group member
      for (let j = 0; j < singleGroupInfo.members.length; j++) {
        // loops through each member
        if (singleGroupInfo.members[j].uid === USERS_CURRENT_ID) {
          // checks if current user is listed
          userIsMember = true;
          break; // stops checking afterwards
        }
      }

      if (userIsMember) {
        // only continues if the user is actually in the group
        const tasksCollection = collection(
          // points to the user's tasks subcollection
          db,
          "groups",
          singleGroupSnapshot.id,
          "tasks"
        );
        const taskssnapshot = await getDocs(tasksCollection); // get all tasks for this group

        for (let k = 0; k < taskssnapshot.docs.length; k++) {
          // loops through each task
          const singleTaskSnapshot = taskssnapshot.docs[k];
          const singleTaskInfo = singleTaskSnapshot.data();

          if (singleTaskInfo.dateISO === currentday) {
            // only keep tasks for the currently selected day
            const taskDetails = {
              dateISO: singleTaskInfo.dateISO,
              priority: singleTaskInfo.priority || null,
              completed: singleTaskInfo.completed,
              title: singleTaskInfo.title,
            };

            createTask(
              // renders the task onto the list
              singleTaskSnapshot.id,
              taskDetails,
              singleTaskSnapshot.ref
            );
          }
        }
      }
    }
  }

  // refreshes the limit note
  updateNote();
}

/* --- ADDS A BRAND NEW TASK TO THE LIST (Modified Version) --- */
function addNewTask(taskTitle) {
  // stops after the 20 task limit
  if (taskList.children.length >= 20) return;

  // figures out the day of the task in yyyy-mm-dd form
  const currentday = formatDate(selecteddate);

  // creates a new id for the task: combines date and name of task (so we can identify it later)
  const taskId = makeUniqueDocId(currentday, taskTitle);

  // main info about the task (priority level left empty until set by the user)
  const taskinfo = { title: taskTitle, priority: null }; // ANOTHER CHANGE MADE HERE: SET DEFAULT PRIORITY TO NULL

  // if the user is logged in, point to where the task will be saved in firestore
  const tasklocation = USERS_CURRENT_ID
    ? doc(db, "personal-tasks", USERS_CURRENT_ID, "tasks", taskId)
    : null; // otherwise, set it to null

  // uses the new helper function to create a task
  createTask(taskId, taskinfo, tasklocation);

  // updates the task limit note
  updateNote();

  // if the user is logged in, save the task to firestore
  if (USERS_CURRENT_ID) {
    setDoc(tasklocation, {
      dateISO: currentday, // day of task
      title: taskTitle, // task name
      createdAt: new Date(), // creation date
      done: false, // false by default, assume task is incomplete
      priority: null,
    });
  }
}

/* --- UPDATING THE TASK LIMIT NOTE --- */
function updateNote() {
  const note = document.getElementById("note");
  const numberOfTasks = taskList.children.length; // # of items in list

  // if you have more than 20 tasks, show the limit note, and disable the task input box
  if (numberOfTasks >= 20) {
    note.style.display = "block";
    taskInput.disabled = true;
  } else {
    // otherwise, hide the task limit note, enable input box
    note.style.display = "none";
    taskInput.disabled = false;
  }
}

/* --- UPDATING THE CALENDAR HEADER --- */
function createHeaders(dateObject) {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  // concatenates the month, day, and year together to display on the header
  document.getElementById("mainmonthlabel").textContent =
    months[dateObject.getMonth()] +
    " " +
    dateObject.getDate() +
    ", " +
    dateObject.getFullYear();
}

/* --- CREATING THE CALENDAR GRID! --- */

// holds the year, month index (0-11), and the day of the month
function createCalendar(dateObj) {
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth();
  const todaysdate = dateObj.getDate();

  // finds all the week rows within our big calendar grid
  const allWeekrows = calendarContainer.getElementsByClassName("days");
  // multiplies the number of week rows by 7 to get the total number of days in the calendar grid
  const totalnumboxes = allWeekrows.length * 7;
  // calculates total # of days in the month using our helper function from earlier
  const totalMonthDays = daysInMonth(month, year);
  // tells you which day of the week the 1st day of the month is on
  const firstday = new Date(year, month, 1).getDay();
  // a counter which shows how many calendar boxes we've filled in so far
  let daycount = 0;

  // loops through each box in the calendar grid to decide whether a box should be empty or filled with a day
  // note: i represents each box number
  /* AN EXAMPLE: if i = 3
  3/7 = 0.xxxx -> rounds down to 0 AND 3 % 7 = 3; this means box 3 would be on row 0, column 3
  */
  for (let i = 0; i < totalnumboxes; i++) {
    const rows = Math.floor(i / 7);
    const columns = i % 7;
    const daybox = allWeekrows[rows].getElementsByClassName("day")[columns];

    // resets the style for all the boxes
    daybox.style.visibility = "visible";
    daybox.style.border = "";
    daybox.style.borderRadius = "";
    daybox.style.boxShadow = "";
    daybox.textContent = "";

    // hides all empty calendar boxes that come before the first day of the month
    if (i < firstday) {
      daybox.style.visibility = "hidden";
      daybox.textContent = "";
      daybox.removeAttribute("id");
      daybox.onclick = null;
    }

    // if the day count is less than the total days in the month, that means we're still inside the month, so we should fill the box with a day number
    else if (daycount < totalMonthDays) {
      // daycount initially started at 0, so add 1 to make the first day show up as 1, and not 0
      const displaynumber = daycount + 1;
      daybox.textContent = displaynumber; // update the number displayed in the box
      daybox.id = "day" + displaynumber; // creates a unique id for each box: day1

      // if today's date is equal to the box value, then add a border
      if (displaynumber === todaysdate) {
        daybox.style.border = "2px solid gray";
        daybox.style.borderRadius = "10px";
        daybox.style.boxShadow = "0px 0px 0px 10px rgba(47, 23, 4, 0.3)";
      }

      // when this specific day box is clicked
      daybox.onclick = function () {
        // update the selected day to this date
        selecteddate = new Date(year, month, displaynumber);
        createHeaders(selecteddate); // update the calendar header & add a border around the day box
        createCalendar(selecteddate);

        loadTasksForTheDay(formatDate(selecteddate)); // it should also load the tasks from firestore
      };

      daycount++; // moves onto the next day box
    }

    // hides any empty days leftover at the end of the calendar
    else {
      daybox.style.visibility = "hidden";
      daybox.textContent = "";
      daybox.removeAttribute("id"); // removes ids associated with the empty boxes
      daybox.onclick = null;
    }
  }
}

/* --- COLLAPSIBLE CALENDAR --- */
// NEW CHANGES MADE HERE (I THINK KIAN FIXED IT THOUGH)
// originally, I was checking the style of the first week row to decide if the calendar was collapsed;
// what I noticed at the start of this month was that the first row was still visible
// even when the calendar was collapsed, so my logic was flawed

//  we're using a variable to track the state of the calendar instead
let isCollapsed = false;

function collapsecalendar() {
  collapseButton.addEventListener("click", function () {
    // grabs all the week rows in the calendar grid
    const allWeekRows = calendarContainer.getElementsByClassName("days");

    // figures out the year, month, and day currently selected
    const currentYear = selecteddate.getFullYear();
    const currentMonth = selecteddate.getMonth();
    const currentDate = selecteddate.getDate();

    // finds which weekday the 1st of the month falls on
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();

    // calculates which week row the current day belongs to
    const currentWeek = Math.floor((currentDate + firstDayOfMonth - 1) / 7);

    isCollapsed = !isCollapsed;

    // instead of checking the first row’s style, it relies on the variable flag
    for (let i = 0; i < allWeekRows.length; i++) {
      if (!isCollapsed) {
        // shows all of the weeks by default
        allWeekRows[i].style.display = "flex";
      } else {
        // only shows the week of the current row when collapsed
        allWeekRows[i].style.display = i === currentWeek ? "flex" : "none";
      }
    }

    // rotates the arrow based on whether it's collapsed or not
    const arrow = document.querySelector("#collapseButton img");
    if (arrow) {
      arrow.style.transform = isCollapsed ? "rotate(180deg)" : "rotate(0deg)";
    }
  });
}

/* --- CUSTOMIZING THE PLANNER NAME --- */
async function displayPlannerName(userId) {
  const reference = doc(db, "users", userId); // reference this user's document under the users collection
  const snapshot = await getDoc(reference); // get the doc data from firestore

  // if the doc for the user is there
  if (snapshot.exists()) {
    const data = snapshot.data(); // get all the fields stored for that user, and use their username
    const name = data.username || "user";
    document.getElementById("plannerName").textContent = name + "'s Planner";
  } else {
    document.getElementById("plannerName").textContent = "My Planner";
  }
}

/* --- EVERYTHING THAT NEEDS TO HAPPEN WHEN THE PAGE FIRST LOADS --- */
/* --- Sets up the custom Navbar & Calendar Color --- */
window.onload = function () {
  // links each html element to its javascript var
  const titleElement = document.getElementById("mainmonthlabel");
  taskList = document.getElementById("taskList");
  taskInput = document.getElementById("taskInput");
  calendarContainer = document.getElementById("tracker");
  collapseButton = document.getElementById("collapseButton");

  const previousbutton = document.getElementById("previousarrow");
  const nextbutton = document.getElementById("nextarrow");

  // sets the selected date to today by default
  selecteddate = new Date();

  // helper function to create the header & calendar based on the day selected by the user
  function refreshCalendar() {
    createHeaders(selecteddate);
    createCalendar(selecteddate);
  }

  // allows for month switching using the nav arrows
  previousbutton.onclick = () => {
    selecteddate.setMonth(selecteddate.getMonth() - 1);
    refreshCalendar();
  };
  nextbutton.onclick = () => {
    selecteddate.setMonth(selecteddate.getMonth() + 1);
    refreshCalendar();
  };

  // sets up the collapsible calendar & correctly renders the calendar for the given month
  refreshCalendar();
  collapsecalendar();

  // if a non-empty task is entered
  taskInput.onkeydown = function (event) {
    if (event.key === "Enter" && taskInput.value !== "") {
      addNewTask(taskInput.value); // handles both adding + saving
      taskInput.value = ""; // clear the input box
    }
  };
};

/* --- NEW FEATURES ADDED: CUSTOMIZABLE COLORS & MORE --- */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    USERS_CURRENT_ID = null;
    document.getElementById("plannerName").textContent = "My Planner";
    taskList.innerHTML = "";
    updateNote();
    return;
  }

  USERS_CURRENT_ID = user.uid;

  // show planner name and load tasks
  displayPlannerName(USERS_CURRENT_ID);
  loadTasksForTheDay(formatDate(selecteddate));

  const userdocref = doc(db, "users", user.uid);
  const userdoc = await getDoc(userdocref);
  if (!userdoc.exists()) return;

  const data = userdoc.data();

  // apply header font
  if (data.headerFont) {
    document.documentElement.style.setProperty(
      "--header-font",
      data.headerFont
    );
  }

  // apply the accent color absolutely everywhere
  if (data.accentColor) {
    document.documentElement.style.setProperty(
      "--accent-color",
      data.accentColor
    );
  }

  // for removing the header bg and setting it to the custom color
  const header = document.querySelector("header");
  if (header) {
    if (data.useSolidHeader) {
      header.style.backgroundImage = "none";
      header.style.backgroundColor = data.accentColor || "var(--accent-color)";
    } else {
      header.style.backgroundImage = "url('./img/lightcoloredbackdrop.png')";
      header.style.backgroundColor = "";
    }
  }
});
