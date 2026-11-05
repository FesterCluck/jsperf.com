const Lab = require('@hapi/lab');
const Code = require('@hapi/code');

const formatAuthor = require('../../../../templates/helpers/formatAuthor');

const lab = exports.lab = Lab.script();

lab.experiment('Template Helper formatAuthor', function () {
  lab.test('returns empty string if given empty name', async function () {
    Code.expect(formatAuthor('').toString()).to.equal('');
  });

  lab.test('follow Mathias links', async function () {
    Code.expect(formatAuthor('Mathias', 'https://mathiasbynens.be/').toString()).to.not.include('nofollow');
  });

  lab.test('no url', async function () {
    Code.expect(formatAuthor('Max').toString()).to.not.include('nofollow');
  });

  lab.test('nofollow other links and comment prefix', async function () {
    const res = formatAuthor('Max', 'https://example.com/', true).toString();

    Code.expect(res).to.include('rel=\'nofollow\'');
    Code.expect(res).to.not.include('by ');
  });

  lab.test('prefixes with by when not a comment', async function () {
    Code.expect(formatAuthor('Max', 'https://example.com/').toString()).to.startWith('by ');
  });
});
