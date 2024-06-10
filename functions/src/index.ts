import * as functions from "firebase-functions";

import * as admin from "firebase-admin";

admin.initializeApp();

import { checkNewDisclosure } from "./checkNewDisclosure";
import sendTopic from "./sendTopic";

import createSettlementDict from "./createSettlementDict";
// import devCreateSettlementDict from "./dev-createSettlementDict";
import sendSettlementToTopic from "./sendSettlementToTopic";
import checkNewEdinet from "./checkNewEdinet";
import sendEdinetToTopic from "./sendEdinetToTopic";
import getDownloadUrlEdinet from "./downloadNewEdinet";
import createCompanyDict from "./createCompanyDict";

exports.checkNewDisclosure2 = functions.pubsub
  .topic("minutely5-tick")
  .onPublish(checkNewDisclosure);

exports.checkNewEdinet = functions.pubsub
  .topic("minutely5-tick")
  .onPublish(checkNewEdinet);

exports.createCompanyDict2 = functions
  .runWith({ memory: "1GB", timeoutSeconds: 300 })
  .pubsub.topic("weekly-tick")
  .onPublish(createCompanyDict);

exports.createSettlementDict = functions.pubsub
  .topic("daily-tick")
  .onPublish(createSettlementDict);

// exports.devCreateSettlementDict = functions.pubsub
//   .topic("daily-tick")
//   .onPublish(devCreateSettlementDict);

// 毎朝8時に確認して送信する
exports.sendSettlementToTopic = functions.pubsub
  .topic("daily-8am-tick")
  .onPublish(sendSettlementToTopic);

exports.sendTopicFs2 = functions.firestore
  .document("disclosures/{key}")
  .onCreate(sendTopic);
exports.saveDocumentFs = functions.firestore
  .document("disclosures/{key}")
  .onCreate(require("./saveDocument"));
exports.sendEdinetToTopic = functions.firestore
  .document("edinets/{key}")
  .onCreate(sendEdinetToTopic);

exports.listTopics = functions.https.onRequest(require("./listTopics"));

exports.getDownloadUrlEdinet = functions.https.onRequest(getDownloadUrlEdinet);

exports.changeTopic = functions.database
  .ref("/user/topics/{userId}")
  .onWrite(require("./changeTopic"));

exports.handleContentViewEvent = functions.analytics
  .event("select_content")
  .onLog(require("./handleContentViewEvent"));

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
//
// export const helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });
