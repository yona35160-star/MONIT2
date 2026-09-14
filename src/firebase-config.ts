/**
 * Firebase Configuration for Push Notifications (FCM)
 * 
 * Instructions:
 * 1. Go to Firebase Console: https://console.firebase.google.com/
 * 2. Create a new project (or use existing)
 * 3. Add a Web App to the project
 * 4. Copy the firebaseConfig values below
 * 5. Go to Project Settings > Cloud Messaging and generate a VAPID key
 * 6. Paste the VAPID key in the vapidKey field below
 */

export const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// VAPID Key for Push Notifications (Cloud Messaging > Web Push certificates)
export const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth, signInWithCustomToken } from "firebase/auth";

const isIsolatedPlaceholder =
  !firebaseConfig.projectId ||
  !firebaseConfig.apiKey ||
  firebaseConfig.apiKey.startsWith('your_') ||
  firebaseConfig.projectId.startsWith('your_') ||
  firebaseConfig.apiKey.includes('PLACEHOLDER');

const app = isIsolatedPlaceholder
  ? null
  : initializeApp(firebaseConfig);
export const db = app ? getDatabase(app) : (null as any);
export const auth = app ? getAuth(app) : (null as any);

export const authenticateFirebase = async (customToken: string) => {
    if (!auth) return false;
    try {
        await signInWithCustomToken(auth, customToken);
        console.log("Firebase Authenticated Securely via Custom Token");
        return true;
    } catch (e) {
        console.error("Firebase Custom Auth Failed", e);
        return false;
    }
};

// Check if Firebase is configured
export const isFirebaseConfigured = () => {
    return !!app && !!firebaseConfig.apiKey && !!vapidKey;
};
