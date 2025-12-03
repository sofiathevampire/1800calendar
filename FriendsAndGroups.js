import { db, auth } from "./FirebaseInstances.js";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
  addDoc,
  arrayUnion,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

// adds a friend by creating a new friendship doc
export async function addFriend(frienduid) {
  const signedinuser = auth.currentUser;
  if (!signedinuser) {
    return;
  }

  const friendshipscollection = collection(db, "friendships");

  await addDoc(friendshipscollection, {
    userA: signedinuser.uid,
    userB: frienduid,
    createdAt: Date.now(),
  });
}

// A COUPLE OF CHANGES WERE MADE HERE AS WELL

// removes a friend by finding and deleting the friendship document that matches
export async function removeFriend(currentuserid, frienduid) {
  const friendshipscollection = collection(db, "friendships");
  const friendshipsdocs = await getDocs(friendshipscollection);

  for (const friendshipdoc of friendshipsdocs.docs) {
    const friendshipdata = friendshipdoc.data();
    const matchA =
      friendshipdata.userA === currentuserid &&
      friendshipdata.userB === frienduid;
    const matchB =
      friendshipdata.userB === currentuserid &&
      friendshipdata.userA === frienduid;

    if (matchA || matchB) {
      await deleteDoc(doc(db, "friendships", friendshipdoc.id));
    }
  }
}

// adds a friend to a group by updating the group's members list
export async function addFriendToGroup(frienduid, groupuid) {
  const groupdocref = doc(db, "groups", groupuid);
  const groupdoc = await getDoc(groupdocref);

  if (!groupdoc.exists()) {
    return;
  }

  const frienddocref = doc(db, "users", frienduid);
  const frienddoc = await getDoc(frienddocref);

  if (!frienddoc.exists()) {
    return;
  }

  const frienddata = frienddoc.data();

  const newmember = {
    uid: frienduid,
    username: frienddata.username || frienduid,
    profilePic: frienddata.profilePic || "../img/defaultprofile.png",
  };

  await updateDoc(groupdocref, {
    members: arrayUnion(newmember),
  });
}

// gets all groups with the current user
export async function getUserGroups(signedinuser) {
  const userid = signedinuser.uid;
  const groupscollection = collection(db, "groups");
  const groupsdocs = await getDocs(groupscollection);

  const usergroups = [];

  for (const groupdoc of groupsdocs.docs) {
    const groupdata = groupdoc.data();
    if (groupdata.members) {
      for (const member of groupdata.members) {
        if (member.uid === userid) {
          usergroups.push({
            id: groupdoc.id,
            name: groupdata.name,
            members: groupdata.members,
          });
          break;
        }
      }
    }
  }
  return usergroups;
}
