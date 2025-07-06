// This is a mock implementation of the Firestore service to allow the app to run without real credentials.
// It uses a simple in-memory object to simulate storing and retrieving data for the current session.
// Data will be reset when the browser is refreshed.

// This will act as our in-memory "database".
const inMemoryStore: Record<string, any> = {};

export async function saveMasterData(uid: string, data: Record<string, string>): Promise<void> {
  console.log(`[Mock Firestore] Saving data for user ${uid}`);
  inMemoryStore[uid] = { data };
  return Promise.resolve();
}

export async function getMasterData(uid: string): Promise<Record<string, string> | null> {
  console.log(`[Mock Firestore] Getting data for user ${uid}`);
  const userDoc = inMemoryStore[uid];
  if (userDoc && userDoc.data) {
    return Promise.resolve(userDoc.data);
  } else {
    // Return null to simulate a new user who needs to upload master data.
    return Promise.resolve(null);
  }
}
