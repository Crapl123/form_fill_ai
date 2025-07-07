
import { db } from './firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

/**
 * Saves a user's master data to their specific document in Firestore.
 * @param uid The user's unique ID from Firebase Authentication.
 * @param data The master data object to save.
 */
export async function saveMasterData(uid: string, data: Record<string, string>): Promise<void> {
  if (!uid) {
    throw new Error("User is not authenticated. Cannot save data.");
  }
  try {
    const userDocRef = doc(db, 'users', uid);
    // This will create or overwrite the document with the new master data.
    await setDoc(userDocRef, { masterData: data });
    console.log(`[Firestore] Saved data for user ${uid}`);
  } catch (error) {
    console.error("Error saving master data to Firestore:", error);
    throw new Error("Failed to save master data.");
  }
}

/**
 * Retrieves a user's master data from Firestore.
 * @param uid The user's unique ID from Firebase Authentication.
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
      const data = docSnap.data();
      console.log(`[Firestore] Found data for user ${uid}`);
      // Return the masterData object, or null if it's missing for some reason.
      return data.masterData || null;
    } else {
      // This is a new user, so no data exists yet.
      console.log(`[Firestore] No document found for user ${uid}. They are a new user.`);
      return null;
    }
  } catch (error) {
    console.error("Error getting master data from Firestore:", error);
    throw new Error("Failed to retrieve master data.");
  }
}
