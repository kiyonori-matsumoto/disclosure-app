const rp = require('request-promise-native');
const admin = require('firebase-admin');
const functions = require('firebase-functions');

const listTopics = (req, res) => {
  const IID_TOKEN = req.body.IID_TOKEN;
  rp.get({
    url: `https://iid.googleapis.com/iid/info/${IID_TOKEN}?details=true`,
    json: true,
    headers: {
      Authorization: `key=${functions.config().messaging.serverkey}`
    }
  })
  .then(data => {
    console.log(data);
    res.json(data.rel).end();
  })
  .catch(err => {
    console.error(err);
    res.status(err.code || err.statusCode || err.status).json(err.error).end();
  })
}

module.exports = listTopics;
