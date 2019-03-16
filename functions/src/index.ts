import * as functions from "firebase-functions";

import * as admin from "firebase-admin";

admin.initializeApp();

import * as checkNewDisclosure from "./checkNewDisclosure";

import createSettlementDict from "./createSettlementDict";
import sendSettlementToTopic from "./sendSettlementToTopic";

exports.checkNewDisclosure = functions.pubsub
  .topic("minutely5-tick")
  .onPublish(checkNewDisclosure);
exports.createCompanyDict2 = functions.pubsub
  .topic("weekly-tick")
  .onPublish(require("./createCompanyDict"));

exports.createSettlementDict = functions.pubsub
  .topic("daily-tick")
  .onPublish(createSettlementDict);

// 毎朝8時に確認して送信する
exports.sendSettlementToTopic = functions.pubsub
  .topic("daily-8am-tick")
  .onPublish(sendSettlementToTopic);

exports.sendTopicFs = functions.firestore
  .document("disclosures/{key}")
  .onCreate(require("./sendTopic"));
exports.addTagFs = functions.firestore
  .document("disclosures/{key}")
  .onCreate(require("./addTag"));
exports.saveDocumentFs = functions.firestore
  .document("disclosures/{key}")
  .onCreate(require("./saveDocument"));

exports.listTopics = functions.https.onRequest(require("./listTopics"));

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
