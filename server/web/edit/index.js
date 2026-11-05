'use strict';

const Boom = require('@hapi/boom');
const Hoek = require('@hapi/hoek');
const basePath = require('../../lib/basePath');
const defaults = require('../../lib/defaults');
const ownership = require('../../lib/ownership');
const schema = require('../../lib/schema');

const register = (server) => {
  const pagesService = server.plugins['services/pages'];

  server.route({
    method: 'GET',
    options: {
      auth: {
        mode: 'try',
        strategy: 'session'
      }
    },
    path: '/{testSlug}/{rev}/edit',
    handler: async (request, h) => {
      let values;
      try {
        values = await pagesService.getBySlug(request.params.testSlug, request.params.rev);
      } catch (err) {
        if (err.message === 'Not found') {
          throw Boom.notFound('The page was not found');
        }
        throw err;
      }

      const page = values[0];
      page.test = values[1];
      page.revision = values[2];
      const isOwn = ownership.isOwner(request, page);

      return h.view('edit/index', {
        headTitle: page.title,
        benchmark: false,
        mainJS: true,
        showAtom: {
          slug: basePath.slug(request)
        },
        jsClass: true,
        isOwn,
        page,
        mediumTextLength: defaults.mediumTextLength
      });
    }
  });

  server.route({
    method: 'POST',
    path: '/{testSlug}/{rev}/edit',
    options: {
      auth: {
        strategy: 'session'
      }
    },
    handler: async (request, h) => {
      const errResp = (errObj) => {
        if (errObj.message) {
          errObj.genError = errObj.message;
        }

        const page = Hoek.applyToDefaults(defaults.testPageContext, request.payload, { nullOverride: true });
        Hoek.merge(page, errObj);
        return h.view('edit/index', {
          headTitle: page.title,
          benchmark: false,
          mainJS: true,
          showAtom: {
            slug: basePath.slug(request)
          },
          jsClass: true,
          page,
          mediumTextLength: defaults.mediumTextLength
        }).code(400);
      };

      // the URL decides which page is edited and the session decides who is credited, never the form
      request.payload.slug = request.params.testSlug;
      request.payload.author = request.auth.credentials.username;
      request.payload.authorGitHub = request.auth.credentials.username;

      const { error, value: pageWithTests } = schema.testPage.validate(request.payload);
      if (error) {
        const errObj = {};
        server.log(['error'], error);
        if (error.details[0].path[0] === 'title') {
          errObj.titleError = defaults.errors.title;
        } else {
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

      try {
        const values = await pagesService.getBySlug(request.params.testSlug, request.params.rev);
        const prevPage = values[0];
        const update = ownership.isOwner(request, prevPage);

        if (!update) {
          // a fork becomes a new, unpublished revision owned by whoever made it; they can publish it later
          pageWithTests.visible = 'n';
          pageWithTests.userID = request.auth.credentials.id;
        }

        const resultingRevision = await pagesService.edit(pageWithTests, update, prevPage.maxRev, prevPage.id);
        const r = resultingRevision > 1 ? `/${resultingRevision}` : '';

        return h.redirect(basePath.url(request, `/${request.params.testSlug}${r}`));
      } catch (err) {
        return errResp(err);
      }
    }
  });

  server.route({
    method: 'GET',
    path: '/{testSlug}/edit',
    handler: (request, h) => h.redirect(basePath.url(request, `/${request.params.testSlug}/1/edit`))
  });
};

exports.plugin = {
  name: 'web/edit',
  dependencies: ['services/pages'],
  register
};
