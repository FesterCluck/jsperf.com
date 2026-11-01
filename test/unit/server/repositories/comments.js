const Lab = require('@hapi/lab');
const Code = require('@hapi/code');
const Support = require('../../../support/server');
const sinon = require('sinon');

const Comments = require('../../../../server/repositories/comments');

const MockDb = Support.mock('db', ['genericQuery']);

const lab = exports.lab = Lab.script();

lab.experiment('Comments Repository', () => {
  let server, comments, genericQueryStub;

  lab.before(async () => {
    server = await Support.createServer({ views: false, plugins: [MockDb, Comments] });

    comments = server.plugins['repositories/comments'];
  });

  lab.beforeEach(async () => {
    genericQueryStub = sinon.stub(server.plugins.db, 'genericQuery');
  });

  lab.afterEach(async () => {
    genericQueryStub.restore();
  });

  lab.experiment('findByPageID', () => {
    lab.test('selects all from comments where pageID', async () => {
      const pageID = 1;
      genericQueryStub.returns(Promise.resolve([]));

      await comments.findByPageID(pageID);
      Code.expect(
        genericQueryStub.calledWithExactly(
          'SELECT * FROM ?? WHERE pageID = ? ORDER BY published ASC',
          ['comments', pageID]
        )
      ).to.be.true();
    });
  });

  lab.experiment('create', () => {
    let payload;
    let insertId;

    lab.before(async () => {
      payload = {
        pageID: 123
      };

      insertId = 1;
    });

    lab.test('inserts payload', async () => {
      genericQueryStub.returns(Promise.resolve({ insertId }));

      const newId = await comments.create(payload);
      Code.expect(
        genericQueryStub.calledWithExactly(
          'INSERT INTO ?? SET ?',
          [
            'comments',
            payload
          ]
        )
      ).to.be.true();
      Code.expect(newId).to.equal(insertId);
    });

    lab.test('returns an error if query failed', async () => {
      const testErrMsg = 'testing';
      const testErr = new Error(testErrMsg);

      genericQueryStub.returns(Promise.reject(testErr));

      const err = await Code.expect(comments.create(payload)).to.reject();
      Code.expect(err).to.be.instanceof(Error);
      Code.expect(err.message).to.equal(testErrMsg);
    });
  });

  lab.experiment('delete', () => {
    lab.test('should delete specific comment', async () => {
      genericQueryStub.returns(Promise.resolve());
      const id = 1;
      await comments.delete(id);
      Code.expect(genericQueryStub.calledWithExactly(
        'DELETE FROM ?? WHERE id = ?',
        ['comments', id]
      )).to.be.true();
    });
  });
});
