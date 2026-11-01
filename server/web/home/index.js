'use strict';

const defaults = require('../../lib/defaults');
const schema = require('../../lib/schema');

const register = (server) => {
  const pagesService = server.plugins['services/pages'];

  server.route({
    method: 'GET',
    path: '/',
    options: {
      auth: {
        mode: 'try',
        strategy: 'session'
      }
    },
    handler: (request, h) => h.view('home/index', Object.assign({}, defaults.testPageContext, {
      home: true,
      showAtom: {
        slug: 'browse'
      },
      jsClass: true,
      mainJS: true,
      test: [defaults.test, defaults.test]
    }))
  });

  server.route({
    method: 'POST',
    path: '/',
    options: {
      auth: 'session'
    },
    handler: async (request, h) => {
      const errResp = (errObj) => {
        if (errObj.message) {
          errObj.genError = errObj.message;
        }

        return h.view('home/index', Object.assign({}, defaults.testPageContext, request.payload, {
          home: true,
          showAtom: {
            slug: 'browse'
          },
          jsClass: true,
          mainJS: true
        }, errObj)).code(400);
      };

      request.payload.authorGitHub = request.auth.credentials.username;

      const { error, value: pageWithTests } = schema.testPage.validate(request.payload);
      if (error) {
        const errObj = {};
        // `abortEarly` option defaults to `true` so can rely on 0 index
        // but just in case...
        try {
          switch (error.details[0].path[0]) {
            case 'title':
              errObj.titleError = defaults.errors.title;
              break;
            case 'slug':
              errObj.slugError = defaults.errors.slug;
              break;
            default:
              throw new Error('unknown validation error');
          }
        } catch (ex) {
          errObj.genError = defaults.errors.general;
        }

        return errResp(errObj);
      }

      // additional validation that's not possible or insanely complex w/ Joi
      let wasAdditionalValidationError = false;
      pageWithTests.test.forEach((t, idx) => {
        const missingTitle = t.title === defaults.deleteMe;
        const missingCode = t.code === defaults.deleteMe;

        if (missingTitle && !missingCode) {
          wasAdditionalValidationError = true;
          request.payload.test[idx].codeTitleError = defaults.errors.codeTitle;
        }

        if (missingCode && !missingTitle) {
          wasAdditionalValidationError = true;
          request.payload.test[idx].codeError = defaults.errors.code;
        }
      });

      if (wasAdditionalValidationError) {
        return errResp({});
      }

      // Joi defaults any properties not present in `request.payload` so use `payload` from here on out
      const payload = pageWithTests;

      try {
        const isAvail = await pagesService.checkIfSlugAvailable(server, payload.slug);
        if (!isAvail) {
          return errResp({ slugError: defaults.errors.slugDupe });
        }

        payload.author = request.auth.credentials.username;
        const resultPageId = await pagesService.create(payload);
        const own = request.yar.get('own') || {};
        own[resultPageId] = true;
        request.yar.set('own', own);
        return h.redirect(`/${payload.slug}`);
      } catch (err) {
        return errResp(err);
      }
    }
  });
};

exports.plugin = {
  name: 'web/home',
  dependencies: ['services/pages'],
  register
};
