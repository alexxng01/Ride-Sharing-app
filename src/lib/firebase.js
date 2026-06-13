// src/lib/firebase.js
// ─────────────────────────────────────────────────────────────────────────────
// Firebase Realtime Database configuration
// Replace these values with your own Firebase project credentials.
// Steps:
//   1. Go to https://console.firebase.google.com
//   2. Create a new project (free Spark plan)
//   3. Add a Web App → copy the firebaseConfig object below
//   4. Enable "Realtime Database" in the Firebase console
//   5. Set DB rules to allow read/write (for demo):
//      { "rules": { ".read": true, ".write": true } }
// ─────────────────────────────────────────────────────────────────────────────

import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey:            process.env.REACT_APP_FIREBASE_API_KEY            || "YOUR_API_KEY",
  authDomain:        process.env.REACT_APP_FIREBASE_AUTH_DOMAIN        || "YOUR_PROJECT.firebaseapp.com",
  databaseURL:       process.env.REACT_APP_FIREBASE_DATABASE_URL       || "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId:         process.env.REACT_APP_FIREBASE_PROJECT_ID         || "YOUR_PROJECT_ID",
  storageBucket:     process.env.REACT_APP_FIREBASE_STORAGE_BUCKET     || "YOUR_PROJECT.appspot.com",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID|| "YOUR_SENDER_ID",
  appId:             process.env.REACT_APP_FIREBASE_APP_ID             || "YOUR_APP_ID",
};

const app = initializeApp(firebaseConfig);
export const db  = getDatabase(app);
export default app;
