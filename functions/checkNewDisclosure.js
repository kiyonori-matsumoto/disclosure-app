const rp = require('request-promise-native');
const request = require('request');
const cheerio = require('cheerio');
const moment = require('moment');

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const https = require('https');

const myBucket = admin.storage().bucket(functions.config().firebase.storageBucket);

const checkNewDisclosure = (event) => {
  const time = moment(event.timestamp);
  console.log(`viewing: ${time.format('YYYYMMDD')}`);
  return Promise.all([
    rp.get(`https://www.release.tdnet.info/inbs/I_list_001_${time.format('YYYYMMDD')}.html`),
    // rp.get(`https://www.release.tdnet.info/inbs/I_list_001_20170908.html`),
    admin.database().ref('disclosures').orderByChild('time').limitToLast(1).once('value'),
  ]).then(([data, lastDisclosures]) => {
    let lastDocument;
    
    lastDisclosures.forEach(e => {
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
        const data = {
          code: $(elem).find('.kjCode').text(),
          company: $(elem).find('.kjName').text(),
          title: $(elem).find('.kjTitle a').text(),
          document: doc,
          exchanges: $(elem).find('.kjPlace').text(),
          time: time.clone().hour(t[0]).minute(t[1]).second(0).millisecond(0).valueOf(),
        };

        console.log(t, data);

        promises.push(
          admin.database().ref(`disclosures/${doc}`).set(data)
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
