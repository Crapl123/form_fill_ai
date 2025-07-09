import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Saves a user's master data to Firestore.
 * @param uid The user's unique ID.
 * @param data The master data object to save.
 */
export async function saveMasterData(uid: string, data: Record<string, string>): Promise<void> {
  if (!uid) {
    throw new Error("User is not authenticated. Cannot save data.");
  }
  try {
    const userDocRef = doc(db, 'users', uid);
    // Use merge: true to avoid overwriting other fields on the user document
    await setDoc(userDocRef, { 
        masterData: data,
        lastUpdated: serverTimestamp() 
    }, { merge: true });
    console.log(`[Firestore] Saved data for user ${uid}`);
  } catch (error: any) {
    console.error("Error saving master data to Firestore:", error);
    let detailedMessage = "Failed to save master data. This can happen if the client is offline or if there's a configuration issue.";
    
    if (error.code === 'permission-denied' || (error.message && error.message.toLowerCase().includes('permission-denied'))) {
        detailedMessage = "Save Failed: Permission Denied. Your Firestore security rules are blocking write access. Please go to your Firebase Console -> Firestore -> Rules and ensure authenticated users can write to their own 'users/{userId}' document.";
    }
    throw new Error(detailedMessage);
  }
}

/**
 * Retrieves a user's master data from Firestore.
 * @param uid The user's unique ID.
 * @returns The user's master data object, or null if it doesn't exist.
 */
export async function getMasterData(uid: string): Promise<Record<string, string> | null> {
  if (!uid) {
    console.warn("No user ID provided to getMasterData.");
    return null;
  }
  try {
    const userDocRef = doc(db, 'users', uid);
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      const userData = docSnap.data();
      return userData.masterData || null;
    } else {
      console.log(`[Firestore] No master data found for user ${uid}. This is normal for a new user.`);
      return null;
    }
  } catch (error: any) {
    console.error("Error getting master data from Firestore:", error);

    let detailedMessage = "Failed to retrieve master data.";
    
    if (error.code === 'permission-denied' || (error.message && error.message.toLowerCase().includes('permission-denied'))) {
        detailedMessage = "Access Denied: Your Firestore security rules are blocking read access. Please go to your Firebase Console -> Firestore -> Rules and ensure authenticated users can read their own '/users/{userId}' document.";
    } else if (error.message && error.message.toLowerCase().includes('offline')) {
        detailedMessage = "Client Offline: The app can't connect to the database. Please check your internet connection and ensure both your Firestore database has been created and its security rules are correctly configured to allow access.";
    } else if (error.message && error.message.toLowerCase().includes('failed to start connection')) {
        detailedMessage = "Connection Failed: Could not connect to Firestore. Please verify your Firebase project credentials in the .env file and ensure you have created a Firestore database in your Firebase project console.";
    }

    throw new Error(detailedMessage);
  }
}
