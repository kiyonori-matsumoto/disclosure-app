import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { logger } from "./lib/logger";

const DB_PATH = "disclosures";

export const utilCopyDb = async (
  req: functions.https.Request,
  res: functions.Response
): Promise<void> => {
  try {
    const snapshot = await admin.database().ref(DB_PATH).once("value");
    const promises: Promise<any>[] = [];
    const db = admin.firestore();

    snapshot.forEach((child) => {
      const val = child.val();
      if (val && val.document) {
        promises.push(db.collection(DB_PATH).doc(val.document).set(val));
      }
    });

    await Promise.all(promises);
    res.send("OK");
  } catch (err: any) {
    logger.error("Failed to copy db from realtime database to firestore:", err);
    res.status(500).json({ error: err.message || err }).end();
  }
};

export default utilCopyDb;
