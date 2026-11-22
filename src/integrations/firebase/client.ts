import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAO8Xew03YsYD32qpAapZ2iS0A88DR4Sls",
  authDomain: "somisteam-5440a.firebaseapp.com",
  projectId: "somisteam-5440a",
  storageBucket: "somisteam-5440a.firebasestorage.app",
  messagingSenderId: "882908540086",
  appId: "1:882908540086:web:9cc05c09e0785f8d5bca17",
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
export const firestore = getFirestore(firebaseApp);
