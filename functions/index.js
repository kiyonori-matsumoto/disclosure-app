const functions = require('firebase-functions');

const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);

const checkNewDisclosure = require('./src/checkNewDisclosure');

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });

exports.test = functions.pubsub.topic('daily-tick').onPublish((event) => {
});

exports.checkNewDisclosure = functions.pubsub.topic('minutely5-tick').onPublish(checkNewDisclosure);

exports.sendTopic = functions.database.ref('/disclosures/{key}').onCreate(require('./src/sendTopic'));

exports.listTopics = functions.https.onRequest(require('./src/listTopics'));

exports.changeTopic = functions.database.ref('/user/topics/{userId}').onWrite(require('./src/changeTopic'));
