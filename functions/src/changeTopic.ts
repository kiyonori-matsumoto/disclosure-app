import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v1";
import { logger } from "./lib/logger";

export const changeTopic = async (
  change: functions.Change<functions.database.DataSnapshot>,
  context: functions.EventContext
): Promise<any> => {
  const uid = context.params.userId;
  const tokenSnapshot = await admin
    .database()
    .ref(`/user/tokens/${uid}`)
    .once("value");

  const token = tokenSnapshot.val();
  if (!token) {
    logger.info(`No token found for user ${uid}`);
    return null;
  }

  const currentObj = change.after.val() || {};
  const previousObj = change.before.val() || {};

  const current: string[] = Object.keys(currentObj).filter((e) => Boolean(e));
  const previous: string[] = Object.keys(previousObj).filter((e) => Boolean(e));

  const added = current.filter((c) => !previous.includes(c));
  const deleted = previous.filter((c) => !current.includes(c));

  logger.info(`User ${uid} topic changes - added: ${added.join(",")}, deleted: ${deleted.join(",")}`);

  const promises: Promise<any>[] = [];

  for (const code of added) {
    promises.push(
      admin.messaging().subscribeToTopic(token, code).catch((err) => {
        logger.error(`Failed to subscribe token to topic ${code}:`, err);
        throw err;
      })
    );
  }

  for (const code of deleted) {
    promises.push(
      admin.messaging().unsubscribeFromTopic(token, code).catch((err) => {
        logger.error(`Failed to unsubscribe token from topic ${code}:`, err);
        throw err;
      })
    );
  }

  return Promise.all(promises);
};

export default changeTopic;
