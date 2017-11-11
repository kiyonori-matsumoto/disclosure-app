const rp = require('request-promise-native');
const request = require('request');
const cheerio = require('cheerio');
const moment = require('moment');

const admin = require('./config/admin');
const https = require('https');

const co = require('co');

const DB_PATH = 'dev-disclosures';
const TIME_MAX = 9999999999999;

const zeroPad = (n) => {
  return ('000000' + n).slice(-3)
}

const checkNewDisclosure = (event) => {
  const time = moment(event.timestamp).utcOffset(9);
  // const time = moment('2017-11-03T23:50:00+0900').utcOffset(9);
  const start = moment(time).utcOffset(9).startOf('date').valueOf();
  const end =   moment(start).utcOffset(9).add(1, 'days').valueOf();

  const batch = admin.firestore().batch();

  console.log(`viewing: ${time.format('YYYYMMDD')}, ${start}, ${end}`);
  return co(function* () {
    const lastDisclosures = yield admin.firestore().collection(DB_PATH).orderBy('time', 'desc').where('time', '>=', start).where('time', '<', end).limit(1).get();
    
    const lastDocuments = lastDisclosures.docs.map((doc) => doc.data().document);
    const lastCount = lastDisclosures.docs.map((doc) => doc.data().time % 1000).reduce((a, e) => e, 0);

    // lastDisclosures.forEach(e => {
    //   lastDocument = e.data().document;
    //   return true;
    // })

    console.log(lastDocuments.length);

    let matched = false;
    let count = 0;
    for (let i = 1; i < 100; i++) {
      let data;
      try {
        data = yield rp.get(`https://www.release.tdnet.info/inbs/I_list_${zeroPad(i)}_${time.format('YYYYMMDD')}.html`)
      } catch(err) {
        break;
      }
      const $ = cheerio.load(data);
      if (count === 0) {
        console.log($('.kaijiSum').text().replace(/\s+/, '').match(/全(\d+)件/))
        count = parseInt($('.kaijiSum').text().replace(/\s+/, '').match(/全(\d+)件/)[1]);
        console.log(count);
        if (!count && count !== 0) {
          throw new RangeError('cannot get kaijiSum');
        }
      }
      const m = $('table#main-list-table tr')
      m.each((j, elem) => {
        const doc = $(elem).find('.kjTitle a').attr('href').replace(/\.pdf/, '');
        if(lastDocuments.indexOf(doc) < 0) { // not found.
  
          // save table data
          const t = $(elem).find('.kjTime').text().split(':').map(e => parseInt(e, 10));
          const code = $(elem).find('.kjCode').text().slice(0, 4);
          const data = {
            code: code,
            company: $(elem).find('.kjName').text(),
            title: $(elem).find('.kjTitle a').text(),
            document: doc,
            exchanges: $(elem).find('.kjPlace').text().trim(), 
            time: time.clone().hour(t[0]).minute(t[1]).second(0).millisecond(0).valueOf() + count,
          };
          count --;

          console.log(t, data);

          batch.set(admin.firestore().collection(DB_PATH).doc(doc), data)
        } else {
          matched = true;
          return false;
        }
      })
      if (matched || m.length != 100) break;
    }
    return batch.commit();
    // return Promise.resolve(true);

  })
};


checkNewDisclosure({timestamp: moment("2017-11-01").toISOString() })
.then(e => console.log(e.length), console.log);

// module.exports = checkNewDisclosure;
