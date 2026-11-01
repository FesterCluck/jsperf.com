const Lab = require('@hapi/lab');
const Code = require('@hapi/code');
const schema = require('../../../../server/lib/schema');

const lab = exports.lab = Lab.script();

lab.experiment('Schema Library', function () {
  lab.experiment('Medium Text', function () {
    lab.test('is a Joi schema', async function () {
      const joiDesc = schema.mediumText.describe();
      Code.expect(Array.isArray(joiDesc.rules)).to.be.true();
    });
  });

  lab.experiment('Test Page', function () {
    lab.test('is a Joi schema', async function () {
      const joiDesc = schema.testPage.describe();
      Code.expect(joiDesc.type).to.equal('object');
    });

    lab.experiment('test array', () => {
      let value;

      lab.beforeEach(async () => {
        value = {
          author: 'Pitcher Man',
          authorEmail: 'kool-aid@kraft.com',
          authorURL: 'http://kool-aid.com',
          authorGitHub: 'koolaidman',
          title: 'oh',
          slug: 'wee',
          info: '',
          initHTML: '',
          setup: '',
          teardown: ''
          // `test` intentionally missing. will be set in each test
        };
      });

      lab.test('title with code is valid', async () => {
        value.test = [
          {
            title: 't1',
            code: 't=1'
          },
          {
            title: 't2',
            code: 't=2'
          }
        ];

        const { error: err } = schema.testPage.validate(value);
        Code.expect(err).to.not.exist();
      });

      lab.test('blank title with blank code is valid', async () => {
        value.test = [
          {
            title: 't1',
            code: 't=1'
          },
          {
            title: '', // intentionally blank
            code: '' // intentionally blank
          },
          {
            title: 't3',
            code: 't=3'
          }
        ];

        const { error: err, value: res } = schema.testPage.validate(value);
        Code.expect(err).to.not.exist();
        Code.expect(res.test[1].title).to.equal('GENERATED_DEFAULT_DELETE_ME');
        Code.expect(res.test[1].code).to.equal('GENERATED_DEFAULT_DELETE_ME');
      });

      lab.test('blank title with code is invalid', async () => {
        value.test = [
          {
            title: 't1',
            code: 't=1'
          },
          {
            title: 't2',
            code: 't=2'
          },
          {
            title: '', // intentionally blank
            code: 't=3'
          }
        ];

        const { error: err, value: res } = schema.testPage.validate(value);
        Code.expect(err).to.not.exist();
        Code.expect(res.test[2].title).to.equal('GENERATED_DEFAULT_DELETE_ME');
      });

      lab.test('title with blank code is invalid', async () => {
        value.test = [
          {
            title: 't1',
            code: 't=1'
          },
          {
            title: 't2',
            code: 't=2'
          },
          {
            title: 't3',
            code: '' // intentionally blank
          }
        ];

        const { error: err, value: res } = schema.testPage.validate(value);
        Code.expect(err).to.not.exist();
        Code.expect(res.test[2].code).to.equal('GENERATED_DEFAULT_DELETE_ME');
      });
    });
  });

  lab.experiment('comment', function () {
    lab.test('is a Joi schema', async function () {
      const joiDesc = schema.comment.describe();
      Code.expect(joiDesc.type).to.equal('object');
    });
  });
});

lab.experiment('Schema Library auth', () => {
  lab.test('register accepts a valid username and password', () => {
    const { error } = schema.register.validate({ username: 'alice-b', password: 'correct horse' });
    Code.expect(error).to.not.exist();
  });

  lab.test('register rejects bad usernames and short passwords', () => {
    Code.expect(schema.register.validate({ username: 'a b', password: 'correct horse' }).error).to.exist();
    Code.expect(schema.register.validate({ username: '-ab', password: 'correct horse' }).error).to.exist();
    Code.expect(schema.register.validate({ username: 'alice', password: 'short' }).error).to.exist();
  });

  lab.test('login requires username and password', () => {
    Code.expect(schema.login.validate({ username: 'alice', password: 'x' }).error).to.not.exist();
    Code.expect(schema.login.validate({ username: 'alice' }).error).to.exist();
  });
});
