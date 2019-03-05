import * as functions from "firebase-functions";

import * as admin from "firebase-admin";

admin.initializeApp();

import * as checkNewDisclosure from "./checkNewDisclosure";

exports.checkNewDisclosure = functions.pubsub
  .topic("minutely5-tick")
  .onPublish(checkNewDisclosure);
exports.createCompanyDict2 = functions.pubsub
  .topic("weekly-tick")
  .onPublish(require("./createCompanyDict"));

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
