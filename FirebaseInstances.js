import {
  initializeApp,
  getApps,
  getApp,
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyC1X3eQaWxuFZt-Jrrzxl_X7RPzD1ooRd8",
  authDomain: "calendar-app-eeda4.firebaseapp.com",
  projectId: "calendar-app-eeda4",
  storageBucket: "calendar-app-eeda4.appspot.com",
  messagingSenderId: "135200443171",
  appId: "1:135200443171:web:d842dc61da8fcae97d5a96",
  measurementId: "G-B0DBRK6MM2",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
