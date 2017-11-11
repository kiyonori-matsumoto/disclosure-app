const admin = require('./config/admin');

admin.firestore().collection('dev-disclosures').get()
.then(querySnap => {
  querySnap.forEach((doc) => {
    console.log(doc.id, doc.data());
  })
  console.log(querySnap.size);
  return 1;
})
.then(() => console.log('Success'), err => {
  console.error(err);
});
