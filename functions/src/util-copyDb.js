const rp = require('request-promise-native');
const admin = require('firebase-admin');
const functions = require('firebase-functions');

const Firestore = require('@google-cloud/firestore');
// Get project ID from environment
const firestoreId = process.env.GCLOUD_PROJECT;
const db = new Firestore({
  projectId: firestoreId,
})

const DB_PATH = 'disclosures';


const utilCopyDb = (req, res) => {
  admin.database().ref(DB_PATH).once('value')
  .then(disclosures => {
    promises = [];
    disclosures.forEach(e => {
      const val = e.val();
      console.log(val);
      promises.push(db.collection(DB_PATH).doc(val.document).set(val));
    })
    return promises;
  })
  .then(promises => Promise.all(promises))
  .then(() => res.send('OK'))
  .catch((e) => {
    console.error(e);
    res.status(500).json(e).end()
  });
}

module.exports = utilCopyDb;
