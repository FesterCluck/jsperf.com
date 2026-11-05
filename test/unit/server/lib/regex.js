const Lab = require('@hapi/lab');
const Code = require('@hapi/code');

const regex = require('../../../../server/lib/regex');

const lab = exports.lab = Lab.script();

lab.experiment('Regex Lib', function () {
  lab.experiment('url', function () {
    lab.test('is a string', async function () {
      Code.expect(regex.url).to.be.a.string();
    });

    lab.test('matches valid url', async function () {
      const re = new RegExp(regex.url);

      Code.expect(re.test('http://user:pass@www.example.com:80/path')).to.be.true();
    });

    lab.test('does not match invalid url', async function () {
      const re = new RegExp(regex.url);

      Code.expect(re.test('this.is.not.a.url')).to.be.false();
    });
  });

  lab.experiment('slug', function () {
    lab.test('is a string', async function () {
      Code.expect(regex.slug).to.be.a.string();
    });

    lab.test('matches valid slug', async function () {
      const re = new RegExp(regex.slug);

      Code.expect(re.test('aB3-')).to.be.true();
    });

    lab.test('does not match invalid slug', async function () {
      const re = new RegExp(regex.slug);

      Code.expect(re.test('!@#$')).to.be.false();
    });
  });

  lab.experiment('script', function () {
    lab.test('is a string', async function () {
      Code.expect(regex.script).to.be.a.string();
    });

    lab.test('matches script tag', async function () {
      const re = new RegExp(regex.script);

      Code.expect(re.test('<script>console.log("hi")</script>')).to.be.true();
    });

    lab.test('does not match invalid script tag', async function () {
      const re = new RegExp(regex.script);

      Code.expect(re.test('<script href="//elsewhe.re" />')).to.be.false();
    });
  });

  lab.experiment('github', function () {
    lab.test('is a string', async function () {
      Code.expect(regex.github).to.be.a.string();
    });

    lab.test('matches valid github name', async function () {
      const re = new RegExp(regex.github);

      Code.expect(re.test('agithubname5000')).to.be.true();
      Code.expect(re.test('agit-hubname5000')).to.be.true();
      Code.expect(re.test('a-github-name500')).to.be.true();
      Code.expect(re.test('a'.repeat(39))).to.be.true();
    });

    lab.test('doesn\'t allow dashes at beginning or end of github name, nor allows for more than one consecutive dash', async function () {
      const re = new RegExp(regex.github);

      Code.expect(re.test('-agithubname5000')).to.be.false();
      Code.expect(re.test('agithubname5000-')).to.be.false();
      Code.expect(re.test('agit--hubname500')).to.be.false();
      Code.expect(re.test('a'.repeat(40))).to.be.false();
    });
  });
});
