const Lab = require('@hapi/lab');
const Code = require('@hapi/code');

const relativeDate = require('../../../../templates/helpers/relativeDate');

const lab = exports.lab = Lab.script();

lab.experiment('Template Helper relativeDate', function () {
  let d;

  lab.before(async function () {
    d = new Date();
  });

  lab.test('returns "just now" if less than 5 seconds ago', async function () {
    Code.expect(relativeDate(d)).to.equal('just now');
  });

  lab.test('returns "$$ seconds ago" if less than a minute ago', async function () {
    const thirtySeconds = 30 * 1000;
    d.setTime(Date.now() - thirtySeconds);

    Code.expect(relativeDate(d)).to.equal('30 seconds ago');
  });

  lab.test('returns "$$ minutes ago" if less than an hour ago', async function () {
    const thirtyMinutes = 30 * 60 * 1000;
    d.setTime(Date.now() - thirtyMinutes);

    Code.expect(relativeDate(d)).to.equal('30 minutes ago');
  });

  lab.test('returns "$ hour ago" if one hour ago', async function () {
    // provides coverage to `else` in niceTime
    const oneHours = 1 * 60 * 60 * 1000;
    d.setTime(Date.now() - oneHours);

    Code.expect(relativeDate(d)).to.equal('1 hour ago');
  });

  lab.test('returns "$$ hours ago" if less than a day ago', async function () {
    const twoHours = 2 * 60 * 60 * 1000;
    d.setTime(Date.now() - twoHours);

    Code.expect(relativeDate(d)).to.equal('2 hours ago');
  });

  lab.test('returns "$$ days ago" if less than a week ago', async function () {
    const twoDays = 2 * 24 * 60 * 60 * 1000;
    d.setTime(Date.now() - twoDays);

    Code.expect(relativeDate(d)).to.equal('2 days ago');
  });

  lab.test('returns "$$ weeks ago" if less than a month ago', async function () {
    const twoDays = 2 * 7 * 24 * 60 * 60 * 1000;
    d.setTime(Date.now() - twoDays);

    Code.expect(relativeDate(d)).to.equal('2 weeks ago');
  });

  lab.test('returns "on $locale" if more than a month ago', async function () {
    d.setFullYear(1999);
    d.setMonth(11);
    d.setDate(31);

    Code.expect(relativeDate(d)).to.equal('on ' + d.toLocaleDateString());
  });
});
