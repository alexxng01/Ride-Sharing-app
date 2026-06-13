// src/lib/firebase.js
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey:            process.env.REACT_APP_FIREBASE_API_KEY             || "AIzaSyBBgsfQCWtr_-X1uezuYe8UoRQhDurA3Zs",
  authDomain:        process.env.REACT_APP_FIREBASE_AUTH_DOMAIN         || "web-app-ea4de.firebaseapp.com",
  databaseURL:       process.env.REACT_APP_FIREBASE_DATABASE_URL        || "https://web-app-ea4de-default-rtdb.firebaseio.com",
  projectId:         process.env.REACT_APP_FIREBASE_PROJECT_ID          || "web-app-ea4de",
  storageBucket:     process.env.REACT_APP_FIREBASE_STORAGE_BUCKET      || "web-app-ea4de.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "219849352649",
  appId:             process.env.REACT_APP_FIREBASE_APP_ID              || "1:219849352649:web:f14c93058ffd8feaebb418",
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export default app;