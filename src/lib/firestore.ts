import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

const MASTER_DATA_COLLECTION = 'masterData';

export async function saveMasterData(uid: string, data: Record<string, string>): Promise<void> {
  try {
    const userDocRef = doc(db, MASTER_DATA_COLLECTION, uid);
    await setDoc(userDocRef, { data });
  } catch (error) {
    console.error("Error saving master data:", error);
    throw new Error("Could not save master data to the database.");
  }
}

export async function getMasterData(uid: string): Promise<Record<string, string> | null> {
  try {
    const userDocRef = doc(db, MASTER_DATA_COLLECTION, uid);
    const docSnap = await getDoc(userDocRef);

    if (docSnap.exists()) {
      return docSnap.data().data as Record<string, string>;
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error fetching master data:", error);
    throw new Error("Could not fetch master data from the database.");
  }
}
