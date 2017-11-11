const request = require('request');
const admin = require('firebase-admin');
const functions = require('firebase-functions');

const DB_PATH = 'disclosures';

const myBucket = admin.storage().bucket(functions.config().firebase.storageBucket);

const saveDocument = (event) => {
  const data = event.data.data();
  const ws = myBucket.file(`${DB_PATH}/${data.document}.pdf`).createWriteStream({
    gzip: true
  })
  request(`https://www.release.tdnet.info/inbs/${data.document}.pdf`).pipe(ws);

  console.log(`requesting ${data.document}.pdf`)

  return new Promise((resolve, reject) => {
    ws.on('finish', () => {
      resolve(true);
    });

    ws.on('error', (err) => {
      reject(err);
    });
  })
}

module.exports = saveDocument;
