const admin = require('firebase-admin');
const serviceAccount = require('../disclosure-app-firebase-adminsdk-kh901-5d7f4fdb64.json')
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseUrl: "https://disclosure-app.firebaseio.com",
});

const TAGS = ['株主優待', '決算', '配当', '業績予想', '日々の開示事項']

admin.firestore().collection('disclosures').get()
.then(querySnap => {
  const promises = [];
  querySnap.forEach((doc) => {
    const data = doc.data();
    
    const tags = TAGS.filter(e => data.title.match(e))
    .reduce((a, e) => {
      a[e] = true; return a;
    }, {});
  
    console.log(JSON.stringify(tags));
    
    promises.push(doc.ref.update({ tags }));
  })
  return Promise.all(promises)
})
.then(() => console.log('Success'), err => {
  console.error(err);
});
