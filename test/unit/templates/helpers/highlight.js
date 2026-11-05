const Lab = require('@hapi/lab');
const Code = require('@hapi/code');
const proxyquire = require('proxyquire');

const highlight = proxyquire('../../../../templates/helpers/highlight', {
  'highlight.js': {
    highlight: function (code, opts) {
      return {
        value: '<span class="pretty">' + code + '</span>'
      };
    }
  }
});

const lab = exports.lab = Lab.script();

lab.experiment('Template Helper highlight', function () {
  lab.test('returns highlighted syntax wrapped in pre+code', async function () {
    const res = highlight('1', 'js');

    Code.expect(res.toString()).to.equal('<pre><code class="js"><span class="pretty">1</span></code></pre>');
  });
});
