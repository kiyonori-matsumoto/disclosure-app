import * as admin from "firebase-admin";
import { Disclosure } from "./models/disclosure";
import * as functions from "firebase-functions";
import base64url from "base64url";

const createMessageTags = (topic: string, data: Disclosure, tag: string) => {
  return {
    android: {
      notification: {
        body: `${data.title}`,
        tag: topic,
        color: "#311B92",
        title: `新しい開示情報 ${tag} - ${data.company}`
      }
    },
    data: {
      title: `${data.title}`,
      code: `${data.code}`,
      company: `${data.company}`,
      click_action: "FLUTTER_NOTIFICATION_CLICK",
      tag,
      type: "tag"
    },
    notification: {
      body: `${data.title}`,
      title: `新しい開示情報 ${tag} - ${data.company}`
    },
    topic: topic
  };
};

const createMessage = (
  topic: string,
  data: Disclosure,
  additionals?: { [key: string]: string }
) => {
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
      click_action: "FLUTTER_NOTIFICATION_CLICK",
      ...additionals
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
  const tagMessages = (data.tags2 || []).map(e => {
    const b64 = base64url.encode(e);
    return createMessageTags(`tags_${b64}`, data, e);
  });

  const messages = [createMessage(`code_${data.code}`, data), ...tagMessages];

  console.log(JSON.stringify(messages));

  return admin
    .messaging()
    .sendAll(messages)
    .then(d => console.log(JSON.stringify(d)));
};

export default sendTopic;
