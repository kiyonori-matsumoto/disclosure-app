const chai = require('chai');
const expect = chai.expect;
const sinon = require('sinon');

const moment = require('moment');

const fs = require('fs')
const path = require('path');
const dummyhtml = fs.readFileSync(path.resolve(__dirname, 'dummy.html'));

let f;

describe('checkNewDisclosure', () => {
  before(() => {
    // Since index.js makes calls to functions.config and admin.initializeApp at the top of the file,
    // we need to stub both of these functions before requiring index.js. This is because the
    // functions will be executed as a part of the require process.
    // Here we stub admin.initializeApp to be a dummy function that doesn't do anything.
    admin =  require('firebase-admin');
    adminInitStub = sinon.stub(admin, 'initializeApp');
    adminStrageStub = sinon.stub(admin, 'storage');
    bucketStub = sinon.stub();
    
    adminStrageStub.returns({bucket: bucketStub});
    // Next we stub functions.config(). Normally config values are loaded from Cloud Runtime Config;
    // here we'll just provide some fake values for firebase.databaseURL and firebase.storageBucket
    // so that an error is not thrown during admin.initializeApp's parameter check
    functions = require('firebase-functions');
    configStub = sinon.stub(functions, 'config').returns({
        firebase: {
          databaseURL: 'https://not-a-project.firebaseio.com',
          storageBucket: 'not-a-project.appspot.com',
        }
        // You can stub any other config values needed by your functions here, for example:
        // foo: 'bar'
      });
    f = require('../src/checkNewDisclosure');
    admin.initializeApp(functions.config().firebase);
    // admin.database().ref('/disclosures').orderByKey().limitToLast(1).once('value'),
    refStub = sinon.stub();
    orderByKey = sinon.stub();
    limitToLast = sinon.stub();
    once = sinon.stub();

    databaseStub = sinon.stub(admin, 'database').returns({ref: refStub});
    refStub.returns({orderByKey});
    orderByKey.returns({limitToLast});
    limitToLast.withArgs(1).returns({once});
    once.withArgs('value').returns(Promise.resolve([{
      code: '62640',
      company: 'M-マルマエ',
      title: '平成29年８月度 月次受注残高についてのお知らせ',
      document: '140120170909470727',
      exchanges: ['東'],
      time: 1504936800000,
    }]))
    
    rp = require('request-promise-native');
    sinon.stub(rp, 'get').withArgs(`https://www.release.tdnet.info/inbs/I_list_001_20170908.html`)
    .returns(dummyhtml)
  });

  it('can get html', () => {
    return f({ timestamp: moment('2017-09-08T11:11:22').toISOString() })
  })
})
