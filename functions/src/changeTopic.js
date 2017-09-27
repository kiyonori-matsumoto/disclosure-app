const admin = require('firebase-admin');
const _ = require('lodash');

const changeTopic = (event) => {
  const uid = event.params.userId;
  return admin.database().ref(`/user/tokens/${uid}`).once('value')
  .then(token => {
    const current = _.keys(event.current.val()).filter(e => e);
    const previous = _.keys(event.previous.val()).filter(e => e);
    const added = _.difference(current - previous);
    const deleted = _.difference(previous - current);
    
    const promises = []

    promises = promises.concat(
      added.map(code => admin.messaging().subscribeToTopic(token, code)),
      deleted.map(code => admin.messaging().unsubscribeFromTopic(token, code))
    );
    return Promise.all(promises);
  })
}

module.exports = changeTopic;
