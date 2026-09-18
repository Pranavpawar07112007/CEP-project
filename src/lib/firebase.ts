
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  "projectId": "societypay-tracker",
  "appId": "1:553240744713:web:bad8f0a7d25d55746d79d8",
  "storageBucket": "societypay-tracker.firebasestorage.app",
  "apiKey": "AIzaSyAHVpFoRNDWZatHy67d1rd7ZI-IZlu-aHM",
  "authDomain": "societypay-tracker.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "553240744713"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };
