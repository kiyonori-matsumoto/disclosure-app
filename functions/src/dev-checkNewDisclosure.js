const rp = require('request-promise-native');
const request = require('request');
const cheerio = require('cheerio');
const moment = require('moment');

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const https = require('https');

const DB_PATH = 'dev-disclosures';
const TIME_MAX = 9999999999999;

const myBucket = admin.storage().bucket(functions.config().firebase.storageBucket);

const checkNewDisclosure = (event) => {
  // const time = moment(event.timestamp).utcOffset(9);
  const time = moment('2017/09/19 23:50:00+0900').utcOffset(9);
  console.log(`viewing: ${time.format('YYYYMMDD')}`);
  return Promise.all([
    rp.get(`https://www.release.tdnet.info/inbs/I_list_001_${time.format('YYYYMMDD')}.html`),
    admin.firestore().collection(DB_PATH).orderBy('time', 'desc').limit(1).get(),// database().ref(DB_PATH).orderByChild('time').limitToLast(1).once('value'),
  ]).then(([data, lastDisclosures]) => {
    let lastDocument = '';
    
    lastDisclosures.forEach(e => {
      console.log(e.data());
      lastDocument = e.data().document;
      return true;
    })

    console.log(lastDocument);

    const $ = cheerio.load(data);
    const promises = []
    $('table#main-list-table tr').each((i, elem) => {
      const doc = $(elem).find('.kjTitle a').attr('href').replace(/\.pdf/, '');
      if(doc !== lastDocument) {

        // save document
        // const ws = myBucket.file(`${DB_PATH}/${doc}.pdf`).createWriteStream({gzip: true})
        // request(`https://www.release.tdnet.info/inbs/${doc}.pdf`).pipe(ws);
        // promises.push(new Promise((resolve, reject) => {
        //   ws.on('finish', () => {
        //     resolve(true);
        //   });

        //   ws.on('error', (err) => {
        //     reject(err);
        //   });
        // }));

        // save table data
        const t = $(elem).find('.kjTime').text().split(':').map(e => parseInt(e, 10));
        const code = $(elem).find('.kjCode').text().slice(0, 4);
        const data = {
          code: code,
          company: $(elem).find('.kjName').text(),
          title: $(elem).find('.kjTitle a').text(),
          document: doc,
          exchanges: $(elem).find('.kjPlace').text().trim(), 
          time: time.clone().hour(t[0]).minute(t[1]).second(0).millisecond(999-i).valueOf(),
        };

        console.log(t, data);

        promises.push(
          // admin.database().ref(DB_PATH).push(data),
          
          admin.firestore().collection(DB_PATH).doc((TIME_MAX - data.time).toString(10)).set(data).catch((e) => {
            console.error(e);
            return e;
          })
        );
      } else {
        return false;
      }
    })
    return Promise.all(promises);
  })
};

// checkNewDisclosure({timestamp: moment().toISOString() }).then(console.log, console.log);

module.exports = checkNewDisclosure;
