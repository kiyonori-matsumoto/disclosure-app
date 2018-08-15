const rp = require('request-promise-native');
const request = require('request');
const cheerio = require('cheerio');
const moment = require('moment');

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const https = require('https');

const co = require('co');

const DB_PATH = 'disclosures';
const TIME_MAX = 9999999999999;

const zeroPad = (n) => {
  return ('000000' + n).slice(-3)
}

const checkNewDisclosure = (data, context) => {
  const time = moment(context.timestamp).utcOffset(9);
  // const time = moment('2017-11-02T23:50:00+0900').utcOffset(9);
  const start = moment(time).utcOffset(9).startOf('date').valueOf();
  const end = moment(start).utcOffset(9).add(1, 'days').valueOf();


  console.log(`viewing: ${time.format('YYYYMMDD')}, ${start}, ${end}`);
  return co(function* () {
    const lastDisclosures = yield admin.firestore().collection(DB_PATH).orderBy('time', 'desc').where('time', '>=', start).where('time', '<', end).limit(1).get();

    const lastDocuments = lastDisclosures.docs.map((doc) => doc.data().document);
    const lastCount = lastDisclosures.docs.map((doc) => doc.data().time % 1000).reduce((a, e) => e, 0);

    console.log(`lastCount = ${lastCount}`);

    let matched = false;
    let count = 0;
    let batches = [];
    for (let i = 1; i < 100; i++) {
      const batch = admin.firestore().batch();

      let data;
      try {
        data = yield rp.get(`https://www.release.tdnet.info/inbs/I_list_${zeroPad(i)}_${time.format('YYYYMMDD')}.html`)
      } catch (err) {
        if (err.statusCode === 404) {
          console.log(err);
          if (matched) {
            throw err;
          }
          break;
        } else {
          throw err;
        }
      }
      const $ = cheerio.load(data);
      if (count === 0) {
        const countText = $('.kaijiSum').text();
        if (!countText) {
          console.log('no documents');
          return;
        }
        count = parseInt($('.kaijiSum').text().replace(/\s+/, '').match(/全(\d+)件/)[1]);
        console.log(`current count=${count}`);
        if (!count && count !== 0) {
          throw new RangeError('cannot get kaijiSum');
        }
      }
      const m = $('table#main-list-table tr')
      m.each((j, elem) => {
        const doc = ($(elem).find('.kjTitle a').attr('href') || 'NOMATCH').replace(/\.pdf/, '');
        if (lastDocuments.indexOf(doc) < 0) { // not found.

          // save table data
          const t = $(elem).find('.kjTime').text().split(':').map(e => parseInt(e, 10));
          const code = $(elem).find('.kjCode').text().slice(0, 4);
          const docTime = time.clone().hour(t[0]).minute(t[1]).second(0).millisecond(0).valueOf() + count;
          const data = {
            code: code,
            company: $(elem).find('.kjName').text(),
            title: $(elem).find('.kjTitle a').text(),
            document: doc,
            exchanges: $(elem).find('.kjPlace').text().trim(),
            time: docTime,
          };
          count--;

          console.log(t, data);

          batch.set(admin.firestore().collection(DB_PATH).doc(docTime.toString(10)), data);
        } else {
          matched = true;
          return false;
        }
      })
      batches.push(batch.commit())
      if (matched || m.length != 100) break;
    }
    return Promise.all(batches);

  })
};


// checkNewDisclosure({timestamp: moment().toISOString() }).then(console.log, console.log);

module.exports = checkNewDisclosure;
