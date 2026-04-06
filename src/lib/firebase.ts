import { initializeApp } from "firebase/app";
import { getAuth, browserLocalPersistence, setPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBHxOJDx53QDBQZA5V6QxQo5Ls2oTEbOfg",
  authDomain: "academic-insights-hub-2c8a5.firebaseapp.com",
  projectId: "academic-insights-hub-2c8a5",
  storageBucket: "academic-insights-hub-2c8a5.firebasestorage.app",
  messagingSenderId: "134013669001",
  appId: "1:134013669001:web:0e879287b2b600e7350058",
  measurementId: "G-L8JS8HP365"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Explicitly set localStorage persistence so sessions survive page refresh
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn("[Firebase] Could not set auth persistence:", err);
});

export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
