const chai = require('chai');
const expect = chai.expect;
const sinon = require('sinon');

const moment = require('moment');

const errors = require('request-promise-core/errors');

const fs = require('fs')
const path = require('path');
const dummyhtmls = [fs.readFileSync(path.resolve(__dirname, 'I_list_001_20171005.html')), fs.readFileSync(path.resolve(__dirname, 'I_list_002_20171005.html'))];

// mocks requests
const rp = require('request-promise-native');

let f;

let stubs = {};

describe('checkNewDisclosure', () => {
  let batchCommitStub;

  before(() => {
    // Since index.js makes calls to functions.config and admin.initializeApp at the top of the file,
    // we need to stub both of these functions before requiring index.js. This is because the
    // functions will be executed as a part of the require process.
    // Here we stub admin.initializeApp to be a dummy function that doesn't do anything.
    admin =  require('firebase-admin');
    adminInitStub = sinon.stub(admin, 'initializeApp');
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

    //mocking of admin.firestore().collection(DB_PATH).orderBy('time', 'desc').where('time', '>=', start).where('time', '<', end).limit(1).get();
    // admin.firestore().batch();
    refStub = sinon.stub();
    collectionsStub = sinon.stub();
    orderByStub = sinon.stub();
    whereStub = sinon.stub();
    limitStub = sinon.stub();
    stubs.getStub = getStub = sinon.stub();
    docStub = sinon.stub();
    queryStub = {
      orderBy: orderByStub,
      where: whereStub,
      limit: limitStub,
      get: getStub,
      doc: docStub,
    }

    stubs.batchSetStub = batchSetStub = sinon.stub();
    batchCommitStub = sinon.stub();
    batchStub = sinon.stub().returns({
      set: batchSetStub,
      commit: batchCommitStub,
    });

    datastoreStub = sinon.stub(admin, 'firestore').returns({
      batch: batchStub,
      collection: collectionsStub
    });
    collectionsStub.withArgs('disclosures').returns(queryStub);
    orderByStub.returns(queryStub);
    whereStub.returns(queryStub);
    limitStub.returns(queryStub);

    rpGetStub = sinon.stub(rp, 'get')
    rpGetStub.withArgs(`https://www.release.tdnet.info/inbs/I_list_001_20171015.html`)
    .resolves(dummyhtmls[0])
    rpGetStub.withArgs(`https://www.release.tdnet.info/inbs/I_list_002_20171015.html`)
    .resolves(dummyhtmls[1])
    rpGetStub.withArgs('https://www.release.tdnet.info/inbs/I_list_001_20171014.html')
    .rejects(new errors.StatusCodeError(404, 'not found'));
    rpGetStub.withArgs('https://www.release.tdnet.info/inbs/I_list_001_20171013.html')
    .rejects(new errors.StatusCodeError(500, 'server error'));
  });
  
  describe('get htmls of 171015', () => {
    it('can get html', () => {
      
      stubs.getStub.resolves({docs: [{ data: () => { return {
        code: '62640',
        company: 'M-マルマエ',
        title: '平成29年８月度 月次受注残高についてのお知らせ',
        document: '140120170909470727',
        exchanges: ['東'],
        time: 1504936800000,
      }}}]})
  
      return f({ timestamp: moment('2017-10-15T11:11:22').toISOString() }).then(() => {
        expect(batchSetStub.callCount).to.equals(129);
      })
    })
  
    it ('saves nothing when latest document is saved', () => {
      stubs.getStub.resolves({docs: [{ data: () => { return {
        code: '6636',
        company: 'M-マルマエ',
        title: '業績予想の修正並びに中期経営計画の取り下げに関するお知らせ',
        document: '140120171005486134',
        exchanges: ['東'],
        time: 1504936800000,
      }}}]})
  
      return f({ timestamp: moment('2017-10-15T11:11:22').toISOString() }).then(() => {
        expect(batchSetStub.callCount).to.equals(0);
      })
    })

  })

  it ('handles notfound error as 0 document', () => {
    stubs.getStub.resolves({docs: []})
    return f({ timestamp: moment('2017-10-14T11:11:22').toISOString() }).then(() => {
      expect(batchSetStub.callCount).to.equals(0);
      expect(batchCommitStub.callCount).to.equals(1);
    })
  })
  
  it ('throws error other than notfound error', () => {
    stubs.getStub.resolves({docs: []})
    return f({ timestamp: moment('2017-10-13T11:11:22').toISOString() }).then(() => {
      throw 'failuer state error';
    }, (err) => {
      expect(batchCommitStub.callCount).to.equals(0);
      if (err.statusCode === 500) {
        return true;
      } else {
        throw err;
      }
    })
  })

  afterEach(() => {
    stubs.batchSetStub.reset();
    batchCommitStub.reset();
  })
})
