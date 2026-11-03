const Lab = require('@hapi/lab');
const Code = require('@hapi/code');

const error = require('../../../../templates/helpers/error');

const lab = exports.lab = Lab.script();

lab.experiment('Template Helper error', function () {
  lab.test('returns span with error class', async function () {
    const safe = error('msg', { hash: {} });
    Code.expect(safe).to.be.object();
    Code.expect(safe.string).to.equal('<span class="error">msg</span>');
  });

  lab.test('returns tag with error class', async function () {
    const safe = error('msg', { hash: { tag: 'p' } });
    Code.expect(safe).to.be.object();
    Code.expect(safe.string).to.equal('<p class="error">msg</p>');
  });

  lab.test('escapes the message', async function () {
    const safe = error('<img src=x onerror=alert(1)>', { hash: {} });
    Code.expect(safe.string).to.equal('<span class="error">&lt;img src&#x3D;x onerror&#x3D;alert(1)&gt;</span>');
  });
});
