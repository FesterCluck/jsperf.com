const Lab = require('@hapi/lab');
const Code = require('@hapi/code');
const Support = require('../../../support/server');
const QsPayload = require('../../../../server/lib/qsPayload');

const lab = exports.lab = Lab.script();
let server;

lab.beforeEach(async () => {
  server = await Support.createServer({ views: false, plugins: [QsPayload] });
  server.route({ method: 'POST', path: '/', handler: (request) => request.payload });
});

lab.experiment('qsPayload', () => {
  lab.test('parses nested urlencoded form fields', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'title=a&test[0][title]=t1&test[1][title]=t2&test[1][defer]=y'
    });

    Code.expect(res.result).to.equal({
      title: 'a',
      test: [{ title: 't1' }, { title: 't2', defer: 'y' }]
    });
  });

  lab.test('leaves JSON payloads alone', async () => {
    const res = await server.inject({ method: 'POST', url: '/', payload: { 'a[b]': 1 } });

    Code.expect(res.result).to.equal({ 'a[b]': 1 });
  });

  lab.test('turns an empty POST body into an empty payload', async () => {
    const res = await server.inject({ method: 'POST', url: '/' });

    Code.expect(res.result).to.equal({});
  });

  lab.test('ignores requests without a payload', async () => {
    const res = await server.inject({ method: 'POST', url: '/', headers: { 'content-type': 'application/x-www-form-urlencoded' } });

    Code.expect(res.statusCode).to.equal(200);
  });
});
