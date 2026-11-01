const Lab = require('@hapi/lab');
const Code = require('@hapi/code');
const Support = require('../../../support/server');
const sinon = require('sinon');
const Hoek = require('@hapi/hoek');
const defaults = require('../../../../server/lib/defaults');

const MockDb = Support.mock('db', {
  escape: (val) => '`' + val + '`',
  genericQuery: () => {}
});

const TestsRepo = require('../../../../server/repositories/tests');

const lab = exports.lab = Lab.script();

lab.experiment('Tests Repository', function () {
  let server, tests, genericQueryStub;

  lab.before(async () => {
    server = await Support.createServer({ views: false, plugins: [MockDb, TestsRepo] });

    tests = server.plugins['repositories/tests'];
  });

  lab.beforeEach(async function () {
    genericQueryStub = sinon.stub(server.plugins.db, 'genericQuery');
  });

  lab.afterEach(async () => {
    genericQueryStub.restore();
  });

  lab.experiment('bulkCreate', function () {
    let pageID;
    let t;

    lab.before(async function () {
      t = [
        {
          title: 't1',
          defer: 'n',
          code: 'a = 1'
        }, {
          title: 't2',
          defer: 'n',
          code: 'a = 2'
        }
      ];

      pageID = 1;
    });

    lab.test('inserts multiple values', async function () {
      genericQueryStub.returns(Promise.resolve({ affectedRows: t.length }));

      await tests.bulkCreate(pageID, t);
      Code.expect(
        genericQueryStub.calledWithExactly(
          'INSERT INTO ?? (??) VALUES (1, `t1`, `n`, `a = 1`, NULL), (1, `t2`, `n`, `a = 2`, NULL)',
          [
            'tests',
            ['pageID', 'title', 'defer', 'code', 'complexity']
          ]
        )
      ).to.be.true();
    });

    lab.test('stores the complexity estimate as JSON', async function () {
      genericQueryStub.returns(Promise.resolve({ affectedRows: 1 }));

      await tests.bulkCreate(pageID, [{ title: 't1', defer: 'n', code: 'a = 1', complexity: { estimate: true, overall: 'o1', calls: [] } }]);
      Code.expect(genericQueryStub.getCall(0).args[0]).to.equal('INSERT INTO ?? (??) VALUES (1, `t1`, `n`, `a = 1`, `{"estimate":true,"overall":"o1","calls":[]}`)');
    });

    lab.test('returns an error when not enough rows inserted', async function () {
      genericQueryStub.returns(Promise.resolve({ affectedRows: t.length - 1 }));

      const err = await Code.expect(tests.bulkCreate(pageID, t)).to.reject();
      Code.expect(err).to.be.instanceof(Error);
      Code.expect(err.message).to.equal('Not all tests inserted');
    });

    lab.test('returns an error when not enough rows inserted', async function () {
      const testErrMsg = 'testing';
      const testErr = new Error(testErrMsg);

      genericQueryStub.returns(Promise.reject(testErr));

      const err = await Code.expect(tests.bulkCreate(pageID, t)).to.reject();
      Code.expect(err).to.be.instanceof(Error);
      Code.expect(err.message).to.equal(testErrMsg);
    });
  });

  lab.experiment('bulkUpdate', function () {
    let pageID;
    let t;

    lab.before(async function () {
      t = [
        {
          title: 't1',
          defer: 'n',
          code: 'a = 1'
        }, {
          title: 't2',
          defer: 'n',
          code: 'a = 2'
        }
      ];

      pageID = 1;
    });

    lab.test('inserts multiple values', async function () {
      genericQueryStub.returns(Promise.resolve({ affectedRows: 1 }));

      await tests.bulkUpdate(pageID, t, false);
      let call1 = genericQueryStub.getCall(0).args;
      call1 = Hoek.flatten(call1).join(',');

      Code.expect(call1).to.equal('INSERT INTO ?? (??) VALUES (1, `t1`, `n`, `a = 1`, NULL),tests,pageID,title,defer,code,complexity');
    });

    lab.test('updates and inserts the complexity estimate', async function () {
      genericQueryStub.returns(Promise.resolve({ affectedRows: 1 }));
      const estimate = { overall: 'on', calls: [] };
      const json = '`{"overall":"on","calls":[]}`';

      await tests.bulkUpdate(pageID, [
        { testID: 5, title: 't1', defer: 'n', code: 'a = 1', complexity: estimate },
        { title: 't2', defer: 'n', code: 'a = 2', complexity: estimate }
      ], true);

      Code.expect(genericQueryStub.getCall(0).args[0]).to.equal('UPDATE ?? SET title = `t1`, defer =  `n` , code =  `a = 1`, complexity = ' + json + ' WHERE pageID = 1 AND testID = 5');
      Code.expect(genericQueryStub.getCall(1).args[0]).to.equal('INSERT INTO ?? (??) VALUES (1, `t2`, `n`, `a = 2`, ' + json + ')');
    });

    lab.test('returns the result of each update', async function () {
      genericQueryStub.returns(Promise.resolve({ affectedRows: 1 }));

      const results = await tests.bulkUpdate(pageID, t, false);
      Code.expect(results[0].affectedRows).to.equal(1);
      Code.expect(results[1].affectedRows).to.equal(1);
    });

    lab.test('updates test if it is an existing test and the same owner', async function () {
      genericQueryStub.returns(Promise.resolve({ affectedRows: 1 }));
      const tClone = Hoek.clone(t);
      tClone[0].testID = 123;
      tClone[1].testID = 321;
      await tests.bulkUpdate(pageID, tClone, true);
      const call1 = genericQueryStub.getCall(0).args;
      const call2 = genericQueryStub.getCall(1).args;

      Code.expect(call2[0]).to.equal('UPDATE ?? SET title = `t2`, defer =  `n` , code =  `a = 2`, complexity = NULL WHERE pageID = 1 AND testID = 321');
      Code.expect(call2[1]).to.equal(['tests']);
      Code.expect(call1[0]).to.equal('UPDATE ?? SET title = `t1`, defer =  `n` , code =  `a = 1`, complexity = NULL WHERE pageID = 1 AND testID = 123');
      Code.expect(call1[1]).to.equal(['tests']);
    });

    lab.test('inserts new test if user is not the original owner', async function () {
      genericQueryStub.returns(Promise.resolve({ affectedRows: 1 }));
      const tClone = Hoek.clone(t);
      tClone[0].testID = 123;
      tClone[1].testID = 321;
      await tests.bulkUpdate(pageID, tClone, false);
      const call1 = genericQueryStub.getCall(0).args;
      const call2 = genericQueryStub.getCall(1).args;
      Code.expect(call2[0]).to.equal('INSERT INTO ?? (??) VALUES (1, `t2`, `n`, `a = 2`, NULL)');
      Code.expect(call2[1]).to.equal(['tests', ['pageID', 'title', 'defer', 'code', 'complexity']]);

      Code.expect(call1[0]).to.equal('INSERT INTO ?? (??) VALUES (1, `t1`, `n`, `a = 1`, NULL)');
      Code.expect(call1[1]).to.equal(['tests', ['pageID', 'title', 'defer', 'code', 'complexity']]);
    });

    lab.test('deletes existing test if no title and no code', async function () {
      genericQueryStub.returns(Promise.resolve({ affectedRows: 1 }));
      const tClone = Hoek.clone(t);
      tClone[0].testID = 123;
      tClone[1].testID = 321;
      tClone[0].code = defaults.deleteMe;
      tClone[0].title = defaults.deleteMe;
      tClone[1].code = defaults.deleteMe;
      tClone[1].title = defaults.deleteMe;

      await tests.bulkUpdate(pageID, tClone, true);
      const call1 = genericQueryStub.getCall(0).args;
      const call2 = genericQueryStub.getCall(1).args;

      Code.expect(call1[0]).to.equal('DELETE FROM ?? WHERE pageID = 1 AND testID = 123');
      Code.expect(call1[1]).to.equal(['tests']);
      Code.expect(call2[0]).to.equal('DELETE FROM ?? WHERE pageID = 1 AND testID = 321');
      Code.expect(call2[1]).to.equal(['tests']);
    });

    lab.test('keeps a test that only has a blank title', async function () {
      genericQueryStub.returns(Promise.resolve({ affectedRows: 1 }));
      const tClone = Hoek.clone(t);
      tClone[0].title = defaults.deleteMe;

      await tests.bulkUpdate(pageID, tClone, true);

      Code.expect(genericQueryStub.getCall(0).args[0]).to.startWith('INSERT INTO');
    });

    lab.test('inserts new tests added by the owner', async function () {
      genericQueryStub.returns(Promise.resolve({ affectedRows: 1 }));

      await tests.bulkUpdate(pageID, Hoek.clone(t), true);

      Code.expect(genericQueryStub.getCall(0).args[0]).to.startWith('INSERT INTO');
    });

    lab.test('does nothing if no title and no code with no test id', async function () {
      genericQueryStub.returns(Promise.resolve({ affectedRows: 1 }));
      const tClone = Hoek.clone(t);
      tClone[0].code = defaults.deleteMe;
      tClone[0].title = defaults.deleteMe;
      tClone[1].code = defaults.deleteMe;
      tClone[1].title = defaults.deleteMe;

      await tests.bulkUpdate(pageID, tClone, true);
      const call1 = genericQueryStub.getCall(0);

      Code.expect(call1).to.equal(null);
    });

    lab.test('does nothing if no title and no code with no ownership', async function () {
      genericQueryStub.returns(Promise.resolve({ affectedRows: 1 }));
      const tClone = Hoek.clone(t);
      tClone[0].testID = 123;
      tClone[1].testID = 321;
      tClone[0].code = defaults.deleteMe;
      tClone[0].title = defaults.deleteMe;
      tClone[1].code = defaults.deleteMe;
      tClone[1].title = defaults.deleteMe;

      await tests.bulkUpdate(pageID, tClone, false);
      const call1 = genericQueryStub.getCall(0);

      Code.expect(call1).to.equal(null);
    });

    lab.test('returns an error when not enough rows inserted', async function () {
      genericQueryStub.returns(Promise.resolve({ affectedRows: 0 }));

      const err = await Code.expect(tests.bulkUpdate(pageID, t, false)).to.reject();
      Code.expect(err).to.be.instanceof(Error);
      Code.expect(err.message).to.equal('Not all tests inserted');
    });
  });

  lab.experiment('setComplexity', function () {
    lab.test('stores the estimate for one test', async function () {
      genericQueryStub.returns(Promise.resolve({ affectedRows: 1 }));

      await tests.setComplexity(7, { overall: 'o1', calls: [] });
      Code.expect(genericQueryStub.calledWithExactly('UPDATE ?? SET complexity = ? WHERE testID = ?', ['tests', '{"overall":"o1","calls":[]}', 7])).to.be.true();
    });
  });

  lab.experiment('findByPageID', function () {
    lab.test('selects all from tests where pageID', async function () {
      const pageID = 1;
      genericQueryStub.returns(Promise.resolve([]));

      await tests.findByPageID(pageID);
      Code.expect(
        genericQueryStub.calledWithExactly(
          'SELECT * FROM ?? WHERE pageID = ?',
          ['tests', pageID]
        )
      ).to.be.true();
    });
  });
});
