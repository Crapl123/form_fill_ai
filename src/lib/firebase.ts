import type { FirebaseApp } from 'firebase/app';
import type { Firestore } from 'firebase/firestore';
import type { Auth } from 'firebase/auth';

// This file provides mock Firebase services to allow the app to run without credentials.
// It prevents the "auth/api-key-not-valid" error during development.

const app = {} as FirebaseApp;
const db = {} as Firestore;
const auth = {} as Auth;

export { app, db, auth };
