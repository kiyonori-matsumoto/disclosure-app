const rp = require('request-promise-native');
const moment = require('moment');
const functions = require('firebase-functions');
const admin = require('firebase-admin');

const DB_PATH = 'edinets';

const checkNewEdinet = (event) => {
  const lastEdinets = admin.firestore().collection(DB_PATH).orderBy('time', 'desc').limit(1).get();

  const lastEdinet = lastEdinets.docs.map(doc => doc.data().document)[0] || {};

  const lastEdinet = {}

  lastEdinet.time = lastEdinet.time ? moment(lastEdinet.time) : moment('2017-01-01 00:00:00');
  const batch = admin.firestore().batch();

  return rp.get('https://webapi.yanoshin.jp/webapi/edinet/list/recent.json', {json: true})
  .then(data => {
    d = data.items
      .map(e => e.Edinet )
      .map(e => {
        e.time = moment(e.pubdate);
        delete e.pubdate
        return e;
      })
      .filter(e => e.time > lastEdinet.time)
    
      .each(e => batch.set(admin.firestore().collection(DB_PATH).doc(e.document_id)), e);
    return d;
  })
  .then(d => batch.commit())
  .then(() => 'finish');
}

checkNewEdinet({}).then(console.log)
