const Code = require('@hapi/code');
const Lab = require('@hapi/lab');
const Proxyquire = require('proxyquire');

const Composer = Proxyquire('../../index', {
  './manifest': {
    get: () => ({}),
    '@noCallThru': true
  }
});

const lab = exports.lab = Lab.script();

lab.experiment('Index', () => {
  lab.test('it composes a server', async () => {
    const server = await Composer();

    Code.expect(server).to.be.an.object();
  });

  lab.test('it uses Joi as the validator', async () => {
    const server = await Composer();

    Code.expect(server.realm.validator).to.exist();
  });

  lab.test('it resolves named view engines from the manifest', async () => {
    const Composed = Proxyquire('../../index', {
      './manifest': {
        get: () => ({
          register: {
            plugins: [{ plugin: '@hapi/vision', options: { engines: { hbs: 'handlebars' } } }]
          }
        }),
        '@noCallThru': true
      }
    });

    const server = await Composed();

    Code.expect(server.getViewsManager()).to.exist();
  });

  lab.test('it leaves engines that are already modules alone', async () => {
    const engine = require('handlebars');
    const Composed = Proxyquire('../../index', {
      './manifest': {
        get: () => ({
          register: {
            plugins: [{ plugin: '@hapi/inert' }, { plugin: '@hapi/vision', options: { engines: { hbs: engine } } }]
          }
        }),
        '@noCallThru': true
      }
    });

    const server = await Composed();

    Code.expect(server.getViewsManager()).to.exist();
  });
});
