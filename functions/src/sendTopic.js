const admin = require('firebase-admin');

const sendTopic = (event) => {
  const data = event.data.val();
  console.log(data.title, data.code);
  admin.messaging().sendToTopic(`code_${data.code}`, {
    notification: {
      body: `(${data.code}) ${data.title}`,
      tag: `code_${data.code}`,
      color: '#006064',
      title: '新しい開示情報',
    }
  })
};

module.exports = sendTopic;
