import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v1";
import logger from "./lib/logger";

export const handleContentViewEvent = async (
  event: functions.analytics.AnalyticsEvent,
  context?: functions.EventContext
) => {
  const db = admin.firestore();
  const contentType = event?.params?.content_type;
  const document = event?.params?.item_id;

  if (!document) {
    logger.info("item_id is not provided in event params");
    return true;
  }

  logger.info(`Processing content view event: type=${contentType}, item_id=${document}`);

  if (contentType === "edinet_pdf") {
    const DB_PATH = "edinets";
    const docRef = db.collection(DB_PATH).doc(document);
    const docSnapshot = await docRef.get();

    if (!docSnapshot.exists) {
      logger.info(`Document ${document} does not exist in ${DB_PATH}`);
      return true;
    }

    logger.info(`Incrementing view_count for edinet doc ${document}`);
    await docRef.update({
      view_count: admin.firestore.FieldValue.increment(1),
    });
    return true;
  } else {
    const DB_PATH = "disclosures";
    const querySnapshot = await db
      .collection(DB_PATH)
      .where("document", "==", document)
      .limit(1)
      .get();

    if (querySnapshot.empty || querySnapshot.docs.length === 0) {
      logger.info(`Document ${document} does not exist in ${DB_PATH}`);
      return true;
    }

    const docSnapshot = querySnapshot.docs[0];
    const data = docSnapshot.data();
    logger.info(`Incrementing view_count for disclosure ${docSnapshot.id} (${data.title || "no title"})`);

    await docSnapshot.ref.update({
      view_count: admin.firestore.FieldValue.increment(1),
    });
    return true;
  }
};

export default handleContentViewEvent;
