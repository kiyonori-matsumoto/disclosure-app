const request = require('request');
const admin = require('firebase-admin');

const myBucket = admin.storage().bucket(functions.config().firebase.storageBucket);

const saveDocument = (event) => {
  const data = event.data.val();
  const ws = myBucket.file(`disclosures/${data.document}.pdf`).createWriteStream({
    gzip: true
  })
  request(`https://www.release.tdnet.info/inbs/${data.document}.pdf`).pipe(ws);

  return new Promise((resolve, reject) => {
    ws.on('finish', () => {
      resolve(true);
    });

    ws.on('error', (err) => {
      reject(err);
    });
  })
}

module.exports = sendTopic;
