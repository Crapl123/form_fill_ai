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
    if (error.code === 'permission-denied') {
        throw new Error("Save Failed: Permission Denied. Please check your Firestore security rules in the Firebase Console. They should allow authenticated users to write to their own 'users/{userId}' document.");
    }
    throw new Error("Failed to save master data.");
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
    if (error.code === 'permission-denied') {
      throw new Error("Access Denied: Could not retrieve data. Please check your Firestore security rules. They must allow authenticated users to read their own '/users/{userId}' document.");
    }
    throw new Error("Failed to retrieve master data.");
  }
}
