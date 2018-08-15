const admin = require('firebase-admin');

const sendTopic = (snapshot, context) => {
  const data = snapshot.data();
  console.log(data.title, data.code, data.noSend);
  if (data.noSend) return true;
  return admin.messaging().sendToTopic(`code_${data.code}`, {
    notification: {
      body: `(${data.code}) ${data.title}`,
      tag: `code_${data.code}`,
      color: '#006064',
      title: '新しい開示情報',
      // click_action: 'FCM_PLUGIN_ACTIVITY', // remove here when cordova-plugin-firebase 
    }, data: {
      code: `${data.code}`,
    }
  })
};

module.exports = sendTopic;
