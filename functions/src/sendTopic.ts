import * as admin from "firebase-admin";
import { Disclosure } from "./models/disclosure";
import * as functions from "firebase-functions";
import base64url from "base64url";

const createMessage = (topic: string, data: Disclosure) => {
  return {
    android: {
      notification: {
        body: `${data.title}`,
        tag: topic,
        color: "#311B92",
        title: `新しい開示情報 ${data.company}(${data.code})`
      }
    },
    data: {
      title: `${data.title}`,
      code: `${data.code}`,
      company: `${data.company}`,
      click_action: "FLUTTER_NOTIFICATION_CLICK"
    },
    notification: {
      body: `${data.title}`,
      title: `新しい開示情報 ${data.company}(${data.code})`
    },
    topic: topic
  };
};

const sendTopic = (
  snapshot: functions.firestore.DocumentSnapshot,
  _: functions.EventContext
) => {
  const data = snapshot.data() as Disclosure | undefined;
  if (data === undefined) return true;
  console.log(data.title, data.code, data.noSend, data.company);
  if (data.noSend) return true;
  const tagMessages = Object.keys(data.tags || {}).map(e => {
    const b64 = base64url.encode(e);
    return createMessage(`tags_${b64}`, data);
  });

  const messages = [createMessage(`code_${data.code}`, data), ...tagMessages];

  console.log(JSON.stringify(messages));

  return admin
    .messaging()
    .sendAll(messages)
    .then(d => console.log(JSON.stringify(d)));
  // return admin.messaging().sendToTopic(`code_${data.code}`, {
  //   notification: {
  //     body: `${data.title}`,
  //     tag: `code_${data.code}`,
  //     color: "#006064",
  //     title: `新しい開示情報 ${data.company}(${data.code})`
  //     // clickAction: "FLUTTER_NOTIFICATION_CLICK"
  //   },
  //   data: {
  //     title: `${data.title}`,
  //     code: `${data.code}`,
  //     company: `${data.company}`,
  //     click_action: "FLUTTER_NOTIFICATION_CLICK"
  //   }
  // });
};

export default sendTopic;
