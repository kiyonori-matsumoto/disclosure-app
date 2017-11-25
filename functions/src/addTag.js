const admin = require('firebase-admin');

const TAGS = ['株主優待', '決算', '配当', '業績予想', '日々の開示事項', '自己株式', '新株']

const addTag = (event) => {
  const doc = event.data;
  const data = event.data.data();
  
  const tags = TAGS.filter(e => data.title.match(e))
  .reduce((a, e) => {
    a[e] = true; return a;
  }, {});

  console.log(JSON.stringify(tags));

  return doc.ref.update({ tags });
};

module.exports = addTag;
