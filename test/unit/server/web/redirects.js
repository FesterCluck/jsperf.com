const Lab = require('@hapi/lab');
const Code = require('@hapi/code');
const Support = require('../../../support/server');

const WebRedirectsPlugin = require('../../../../server/web/redirects');

const lab = exports.lab = Lab.script();
let request, server;

lab.beforeEach(async () => {
  server = await Support.createServer({ views: false, plugins: [WebRedirectsPlugin] });
});

lab.experiment('redirects', function () {
  lab.beforeEach(async function () {
    request = {
      method: 'GET'
    };
  });

  lab.test('it redirects aliases to relative URLs', async function () {
    request.url = '/document-head-speed-test';

    const response = await server.inject(request);
    Code.expect(response.statusCode).to.equal(301);
    Code.expect(response.headers.location).to.equal('/document-head');
  });
});
