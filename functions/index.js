const functions = require('firebase-functions');

const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);

const checkNewDisclosure = require('./src/checkNewDisclosure');

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
exports.checkNewDisclosure = functions.pubsub.topic('minutely5-tick').onPublish(checkNewDisclosure);
exports.createCompanyDict = functions.pubsub.topic('weekly-tick').onPublish(require('./src/createCompanyDict'));

// exports.sendTopic = functions.database.ref('/disclosures/{key}').onCreate(require('./src/sendTopic'));
exports.sendTopicFs = functions.firestore.document('disclosures/{key}').onCreate(require('./src/sendTopic'));
exports.addTagFs = functions.firestore.document('disclosures/{key}').onCreate(require('./src/addTag'));
exports.saveDocumentFs = functions.firestore.document('disclosures/{key}').onCreate(require('./src/saveDocument'));


exports.listTopics = functions.https.onRequest(require('./src/listTopics'));

exports.changeTopic = functions.database.ref('/user/topics/{userId}').onWrite(require('./src/changeTopic'));

// exports.checkNewDisclosureDev = functions.pubsub.topic('minutely5-tick').onPublish(require('./src/dev-checkNewDisclosure'));

// exports.saveDocumentFsDev = functions.firestore.document('dev-disclosures/{key}').onCreate(require('./src/dev-saveDocument'));
