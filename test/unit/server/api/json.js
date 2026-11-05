const Lab = require('@hapi/lab');
const Code = require('@hapi/code');
const Support = require('../../../support/server');
const sinon = require('sinon');

const JsonPlugin = require('../../../../server/api/json');

const lab = exports.lab = Lab.script();
let request, server;
const expect = Code.expect;

const MockPagesService = Support.mock('services/pages', ['getBySlug']);

lab.beforeEach(async () => {
  server = await Support.createServer({ views: false, plugins: [MockPagesService, JsonPlugin] });
});

lab.experiment('json', function () {
  lab.beforeEach(async function () {
    request = {
      method: 'GET',
      url: '/test/1.json'
    };
  });

  lab.test('it returns page data', async function () {
    const data = [
      { // page
        id: 1,
        slug: 'test',
        revision: 1,
        title: 'title',
        info: '',
        setup: '',
        teardown: '',
        published: 'n',
        updated: '',
        maxRev: 1
      }, [ // tests
        {
          testID: 1,
          title: 'Test',
          code: 'Test',
          defer: 'n'
        }
      ], [ // revisions
        {
          author: '',
          revision: 1,
          published: '',
          updated: '',
          maxRev: 1,
          title: 'title'
        }
      ], [ // comments
        {
          id: 1,
          author: '',
          published: '',
          content: ''
        }
      ]
    ];

    sinon.stub(server.plugins['services/pages'], 'getBySlug').returns(Promise.resolve(data));

    const response = await server.inject(request);
    expect(response.statusCode).to.equal(200);
    expect(response.headers['content-type']).to.equal('application/json; charset=utf-8');
    expect(response.result.page).to.equal(data[0]);
    expect(response.result.tests).to.equal(data[1]);
    expect(response.result.revisions).to.equal(data[2]);
    expect(response.result.comments).to.equal(data[3]);
  });

  lab.test('it returns errors', async function () {
    sinon.stub(server.plugins['services/pages'], 'getBySlug').returns(Promise.reject(new Error('DB is down')));

    const response = await server.inject(request);
    expect(response.headers['content-type']).to.equal('application/json; charset=utf-8');
    expect(response.result.statusCode).to.equal(500);
    expect(response.result.error).to.equal('Internal Server Error');
    expect(response.result.message).to.equal('An internal server error occurred');
  });
});
