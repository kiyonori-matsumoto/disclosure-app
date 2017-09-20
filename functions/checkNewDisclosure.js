const rp = require('request-promise-native');
const request = require('request');
const cheerio = require('cheerio');
const moment = require('moment');
// const co = require('co');

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const https = require('https');

const myBucket = admin.storage().bucket(functions.config().firebase.storageBucket);

// co(function*() {
//   for(let i=1; i<9; i++) {
//     const data = yield rp.get(`https://www.release.tdnet.info/inbs/I_list_00${i}_${time.format('YYYYMMDD')}.html`);

//   }
// })


// const getNextDisclosure = function* () {
//   for(let i=1; i<10; i++) {
//     yield rp.get(`https://www.release.tdnet.info/inbs/I_list_001_${time.format('YYYYMMDD')}.html`);
//   }
// }

const checkNewDisclosure = (event) => {
  const time = moment(event.timestamp).utcOffset(9);
  // const time = moment('2017/09/19 23:50:00+0900').utcOffset(9);
  console.log(`viewing: ${time.format('YYYYMMDD')}`);
  return Promise.all([
    rp.get(`https://www.release.tdnet.info/inbs/I_list_001_${time.format('YYYYMMDD')}.html`),
    admin.database().ref('disclosures').orderByChild('time').limitToLast(1).once('value'),
  ]).then(([data, lastDisclosures]) => {
    let lastDocument = '';
    
    lastDisclosures.forEach(e => {
      console.log(e.val());
      lastDocument = e.val().document;
      return true;
    })

    const $ = cheerio.load(data);
    const promises = []
    $('table#main-list-table tr').each((i, elem) => {
      const doc = $(elem).find('.kjTitle a').attr('href').replace(/\.pdf/, '');
      if(doc !== lastDocument) {
        const ws = myBucket.file(`disclosures/${doc}.pdf`).createWriteStream({gzip: true})
        request(`https://www.release.tdnet.info/inbs/${doc}.pdf`).pipe(ws);
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
        promises.push(new Promise((resolve, reject) => {
          ws.on('finish', () => {
            resolve(true);
          });

          ws.on('error', (err) => {
            reject(err);
          });
        }));

        console.log(t, data);

        promises.push(
          admin.database().ref(`disclosures`).push(data)
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
