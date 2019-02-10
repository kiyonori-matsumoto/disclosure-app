const admin = require('firebase-admin');

const sendTopic = (snapshot, context) => {
  const data = snapshot.data();
  console.log(data.title, data.code, data.noSend, data.company);
  if (data.noSend) return true;
  return admin.messaging().sendToTopic(`code_${data.code}`, {
    notification: {
      body: `${data.title}`,
      tag: `code_${data.code}`,
      color: '#006064',
      title: `新しい開示情報 ${data.company}(${data.code})`,
      click_action: 'FLUTTER_NOTIFICATION_CLICK',
    },
    data: {
      code: `${data.code}`,
    }
  })
};

module.exports = sendTopic;
