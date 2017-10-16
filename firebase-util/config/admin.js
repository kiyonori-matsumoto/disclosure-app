const admin = require('firebase-admin');
const serviceAccount = require('../../disclosure-app-firebase-adminsdk-kh901-5d7f4fdb64.json')
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseUrl: "https://disclosure-app.firebaseio.com",
});
module.exports = admin;
