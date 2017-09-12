const functions = require('firebase-functions');

const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);

const checkNewDisclosure = require('./checkNewDisclosure');

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });

exports.test = functions.pubsub.topic('daily-tick').onPublish((event) => {
});

exports.checkNewDisclosure = functions.pubsub.topic('minutely5-tick').onPublish(checkNewDisclosure);
// exports.checkNewDisclosure = functions.https.onRequest((req, res) => checkNewDisclosure().then(d => res.send(d), e => {
//   console.error(e);
//   res.status(500).send(e)
// }));
