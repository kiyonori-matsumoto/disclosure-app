const admin = require('./config/admin');
const csvParse = require('csv-parse/lib/sync');
const rp = require('request-promise-native');
const encoding = require('encoding');

rp.get('http://k-db.com/stocks/?download=csv', {followAllRedirects: true, encoding: null})
.then(data => {
  const batches = [];
  data = encoding.convert(data, 'UTF-8', 'SHIFT_JIS', true).toString();
  let csv = csvParse(data, {columns: true, relax_column_count: true});
  
  while(csv.length > 0) {
    s = csv.slice(0, 500);
    csv = csv.slice(500, 10000);
    const batch = admin.firestore().batch();
    s.forEach(company => {
      const ref = admin.firestore().collection('companies').doc(company["コード"].slice(0, 4))
      batch.set(ref, {
        name: company["銘柄名"],
        exchange: company["市場"],
      });
    })
    batches.push(batch.commit());
    console.log(`batch created, length = ${s.length}`);
  }
  return Promise.all(batches);
})
.then(() => console.log('success'), err => console.error(err));
