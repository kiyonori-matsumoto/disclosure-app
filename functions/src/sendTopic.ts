import * as admin from "firebase-admin";
import { Disclosure } from "./models/disclosure";
import logger from "./lib/logger";

const buildMessage = (
  topic: string,
  data: Disclosure,
  title: string,
  extraData?: { [key: string]: string }
) => {
  return {
    android: {
      notification: {
        body: `${data.title}`,
        tag: topic,
        color: "#311B92",
        title,
      },
    },
    data: {
      title: `${data.title}`,
      code: `${data.code}`,
      company: `${data.company}`,
      click_action: "FLUTTER_NOTIFICATION_CLICK",
      ...extraData,
    },
    notification: {
      body: `${data.title}`,
      title,
    },
    topic,
  };
};

const createMessageTags = (topic: string, data: Disclosure, tag: string) => {
  const title = `新しい開示情報 ${tag} - ${data.company}`;
  const extraData = { tag, type: "tag" };
  return buildMessage(topic, data, title, extraData);
};

const createMessage = (
  topic: string,
  data: Disclosure,
  additionals?: { [key: string]: string }
) => {
  const title = `新しい開示情報 ${data.company}(${data.code})`;
  return buildMessage(topic, data, title, additionals);
};

const sendTopic = (
  snapshot: admin.firestore.DocumentSnapshot,
  _context?: any
) => {
  const data = snapshot.data() as Disclosure | undefined;
  if (data === undefined) return true;
  logger.info("Processing sendTopic trigger", {
    title: data.title,
    code: data.code,
    noSend: data.noSend,
    company: data.company,
  });
  if (data.noSend) return true;
  const tagMessages = (data.tags2 || []).map((e) => {
    const b64 = Buffer.from(e, "utf-8").toString("base64url");
    return createMessageTags(`tags_${b64}`, data, e);
  });

  const messages = [createMessage(`code_${data.code}`, data), ...tagMessages];

  logger.info(`Sending ${messages.length} FCM messages for code_${data.code}`);

  return admin
    .messaging()
    .sendEach(messages)
    .then((response) => {
      logger.info(
        `FCM sendEach completed: ${response.successCount} succeeded, ${response.failureCount} failed`
      );
      if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            logger.error(
              `FCM error sending message index ${idx} to topic:`,
              resp.error
            );
          }
        });
      }
      return response;
    })
    .catch((err) => {
      logger.error("Fatal error in FCM sendTopic:", err);
      throw err;
    });
};

export default sendTopic;
