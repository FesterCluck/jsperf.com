const Lab = require('@hapi/lab');
const Code = require('@hapi/code');
const sinon = require('sinon');
const Support = require('../../../../support/server');
const CommentPlugin = require('../../../../../server/web/comment');

const MockCommentService = Support.mock('services/comments', ['delete']);

const lab = exports.lab = Lab.script();
let server;

lab.beforeEach(async () => {
  server = await Support.createServer({ views: false, yar: true, auth: true, plugins: [MockCommentService, CommentPlugin] });
});

lab.experiment('comment', () => {
  let request;

  lab.experiment('delete', () => {
    lab.beforeEach(() => {
      request = {
        method: 'GET',
        url: '/comment/delete/1'
      };
    });

    lab.test('unauthorized if not admin', async () => {
      // admin session not set
      const response = await server.inject(request);

      Code.expect(response.statusCode).to.equal(401);
    });

    lab.test('if admin', async () => {
      const stub = sinon.stub(server.plugins['services/comments'], 'delete').resolves();
      server.route({
        method: 'GET',
        path: '/setsession',
        handler: (req) => {
          req.yar.set('admin', true);
          return 'session set';
        }
      });

      request.headers = { cookie: await Support.sessionCookie(server, '/setsession') };
      const response = await server.inject(request);

      Code.expect(response.statusCode).to.equal(200);
      Code.expect(response.result).to.include('Comment deleted');
      Code.expect(stub.calledWith('1')).to.be.true();
    });
  });
});
