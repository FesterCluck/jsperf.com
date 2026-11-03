const Lab = require('@hapi/lab');
const Code = require('@hapi/code');
const Support = require('../../../support/server');
const sinon = require('sinon');

const Comments = require('../../../../server/services/comments');

const MockRepo = Support.mock('repositories/comments', ['create']);

const lab = exports.lab = Lab.script();

lab.experiment('Comments Service', function () {
  let s, server, comments, createStub;

  lab.beforeEach(async function () {
    s = sinon.createSandbox();

    server = await Support.createServer({ views: false, plugins: [MockRepo, Comments] });

    createStub = s.stub(server.plugins['repositories/comments'], 'create');

    comments = server.plugins['services/comments'];
  });

  lab.afterEach(async function () {
    s.restore();
  });

  lab.experiment('create', function () {
    let payload;

    lab.beforeEach(async function () {
      payload = {};
    });

    lab.test('returns error if comment creation failed', async function () {
      const testErrMsg = 'testing';
      const testErr = new Error(testErrMsg);

      createStub.returns(Promise.reject(testErr));

      const err = await Code.expect(comments.create(null, null, payload)).to.reject();
      Code.expect(err).to.be.instanceof(Error);
      Code.expect(err.message).to.equal(testErrMsg);
    });

    lab.test('assigns new id to comment before returning', async () => {
      const id = 2;
      createStub.returns(Promise.resolve(id));

      const comment = await comments.create(null, null, payload);
      Code.expect(comment).to.include({ id });
    });
  });
});
