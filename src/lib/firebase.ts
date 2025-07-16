
import { initializeApp, getApps, type FirebaseApp, getApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

// This check ensures Firebase is only initialized on the client-side (in the browser).
// This is crucial for builds on platforms like Vercel where server-side rendering
// might not have access to a 'window' object.
if (typeof window !== 'undefined' && !getApps().length) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
} else if (getApps().length > 0) {
    // If the app is already initialized, we get the existing instance.
    app = getApp();
    auth = getAuth(app);
    db = getFirestore(app);
}

// We export the initialized services. In a server-only build environment, they might be undefined,
// which is handled by client-side components that use them.
export { app, db, auth };
