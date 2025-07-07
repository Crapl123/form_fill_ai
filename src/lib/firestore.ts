
// This is a mock implementation of Firestore to allow the app to run without credentials.
// It uses in-memory storage, so data will be lost on page refresh.

let inMemoryStore: Record<string, any> = {};

/**
 * Saves a user's master data to the in-memory store.
 * @param uid The user's unique ID.
 * @param data The master data object to save.
 */
export async function saveMasterData(uid: string, data: Record<string, string>): Promise<void> {
  // Simulate network delay
  await new Promise(res => setTimeout(res, 300));

  if (!uid) {
    throw new Error("User is not authenticated. Cannot save data.");
  }
  try {
    if (!inMemoryStore[uid]) {
      inMemoryStore[uid] = {};
    }
    inMemoryStore[uid].masterData = data;
    console.log(`[Mock Firestore] Saved data for user ${uid}`);
  } catch (error) {
    console.error("Error saving master data to mock Firestore:", error);
    throw new Error("Failed to save master data.");
  }
}

/**
 * Retrieves a user's master data from the in-memory store.
 * @param uid The user's unique ID.
 * @returns The user's master data object, or null if it doesn't exist.
 */
export async function getMasterData(uid: string): Promise<Record<string, string> | null> {
    // Simulate network delay
  await new Promise(res => setTimeout(res, 300));
  
  if (!uid) {
    console.warn("No user ID provided to getMasterData.");
    return null;
  }
  try {
    const userData = inMemoryStore[uid];
    if (userData && userData.masterData) {
      console.log(`[Mock Firestore] Found data for user ${uid}`);
      return userData.masterData;
    } else {
      console.log(`[Mock Firestore] No document found for user ${uid}.`);
      return null;
    }
  } catch (error)
  {
    console.error("Error getting master data from mock Firestore:", error);
    throw new Error("Failed to retrieve master data.");
  }
}
