const admin = require('firebase-admin');

const changeTopic = (change, context) => {
  const uid = context.params.userId;
  return admin.database().ref(`/user/tokens/${uid}`).once('value')
  .then(tokenSnapshot => {
    const token = tokenSnapshot.val();
    if (!token) return null;

    const currentObj = change.after.val() || {};
    const previousObj = change.before.val() || {};

    const current = Object.keys(currentObj).filter(e => e);
    const previous = Object.keys(previousObj).filter(e => e);
    
    const added = current.filter(c => !previous.includes(c));
    const deleted = previous.filter(c => !current.includes(c));

    const promises = [];

    added.forEach(code => promises.push(admin.messaging().subscribeToTopic(token, code)));
    deleted.forEach(code => promises.push(admin.messaging().unsubscribeFromTopic(token, code)));

    return Promise.all(promises);
  })
}

module.exports = changeTopic;
