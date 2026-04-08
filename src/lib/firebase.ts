import { initializeApp } from "firebase/app";
import { getAuth, browserLocalPersistence, setPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBHxOJDx53QDBQZA5V6QxQo5Ls2oTEbOfg",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "academic-insights-hub-2c8a5.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "academic-insights-hub-2c8a5",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "academic-insights-hub-2c8a5.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "134013669001",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:134013669001:web:0e879287b2b600e7350058",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-L8JS8HP365",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn("[Firebase] Could not set auth persistence:", err);
});

export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
