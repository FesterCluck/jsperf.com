'use strict';

const Boom = require('@hapi/boom');
const hljs = require('highlight.js');
const regex = require('../../lib/regex');
const schema = require('../../lib/schema');
const basePath = require('../../lib/basePath');
const defaults = require('../../lib/defaults');
const complexity = require('../../lib/complexity');
const userAgent = require('../../lib/userAgent');

const register = (server, options) => {
  const pagesService = server.plugins['services/pages'];
  const commentsService = server.plugins['services/comments'];

  const getTestPage = (request) => {
    return pagesService.getBySlug(request.params.testSlug, request.params.rev || 1)
      .then(values => {
        const page = values[0];
        page.test = values[1].map((test) => Object.assign({}, test, { complexityView: complexity.present(test.complexity, userAgent.engine(request.headers['user-agent'])) }));
        page.revisions = values[2];
        page.comments = values[3];

        const hasSetupOrTeardown = page.setup.length || page.teardown.length;
        const hasPrep = page.initHTML.length || hasSetupOrTeardown;

        let stripped = false;

        if (hasPrep) {
          const reScripts = new RegExp(regex.script, 'gi');
          stripped = page.initHTML.replace(reScripts, '');

          const swappedScripts = [];

          // highlight the JS inside HTML while highlighting the HTML
          page.initHTMLHighlighted = hljs.highlight(
            page.initHTML.replace(
              reScripts,
              function (match, open, contents, close) {
                // highlight JS inside script tags
                const highlightedContents = hljs.highlight(contents, { language: 'javascript', ignoreIllegals: true }).value;
                // store to put back in place later
                swappedScripts.unshift(highlightedContents.replace(/&nbsp;$/, ''));
                // insert marker to replace shortly
                return open + '@jsPerfTagToken' + close;
              }
            ),
            { language: 'html', ignoreIllegals: true }
          ).value.replace(/@jsPerfTagToken/g, () => swappedScripts.pop());
        }

        // update hits once per page per session
        const hits = request.yar.get('hits') || {};
        if (!hits[page.id]) {
          pagesService.updateHits(page.id)
            .then(function () {
              hits[page.id] = true;
              request.yar.set('hits', hits);
            })
            .catch((err) => {
              server.log(['error'], err);
            });
        }

        const own = request.yar.get('own') || {};
        const isOwn = own[page.id];
        const isAdmin = request.yar.get('admin');

        return {
          headTitle: page.title,
          benchmark: true,
          showAtom: {
            slug: basePath.slug(request)
          },
          jsClass: true,
          isAdmin,
          // Don’t let robots index non-published test cases
          noIndex: page.visible === 'n' && (isOwn || isAdmin),
          pageInit: page.initHTML.includes('function init()'),
          hasPrep,
          hasSetupOrTeardown,
          hasComplexity: page.test.some((test) => test.complexityView),
          stripped,
          page
        };
      })
      .catch((err) => {
        if (err.message === 'Not found') {
          err = Boom.notFound('The page was not found');
        }

        return Promise.reject(err);
      });
  };

  server.route({
    method: 'GET',
    path: '/{testSlug}/{rev?}',
    options: {
      auth: {
        mode: 'try',
        strategy: 'session'
      }
    },
    handler: async (request, h) => {
      const model = await getTestPage(request);
      model.userAgent = userAgent(request.plugins.scooter);
      model.mediumTextLength = defaults.mediumTextLength;
      return h.view('test/index', model);
    }
  });

  // comment route
  server.route({
    method: 'POST',
    path: '/{testSlug}/{rev?}',
    options: {
      auth: {
        mode: 'try',
        strategy: 'session'
      }
    },
    handler: async (request, h) => {
      if (!request.auth.isAuthenticated) {
        throw Boom.unauthorized('Unauthorized');
      }

      const model = await getTestPage(request);
      request.payload.authorGitHub = request.auth.credentials.username;
      const result = schema.comment.validate(request.payload, { abortEarly: false });
      model.mediumTextLength = defaults.mediumTextLength;

      if (result.error) {
        const errObj = {};
        result.error.details.forEach((detail) => {
          const errMsg = defaults.errors.comment[detail.path];
          if (errMsg) {
            errObj[`${detail.path}Error`] = errMsg;
          }
        });
        return h.view('test/index', Object.assign(model, errObj, request.payload));
      }

      const ip = request.headers['x-forwarded-for'] || request.info.remoteAddress;
      const comment = await commentsService.create(model.page.id, ip, result.value);
      model.page.comments.push(comment);
      return h.view('test/index', model);
    }
  });

  // allows owner or admin to publish a test making it visible to the public
  server.route({
    method: 'GET',
    path: '/{testSlug}/{rev}/publish',
    handler: async (request, h) => {
      try {
        const values = await pagesService.getBySlug(request.params.testSlug, request.params.rev);
        const page = values[0];
        const own = request.yar.get('own') || {};
        const isOwn = own[page.id];
        const isAdmin = request.yar.get('admin');

        if (!(isOwn || isAdmin)) {
          // whoever is requesting this doesn't own it so don't let them know it exists
          throw new Error('Not found');
        }

        await pagesService.publish(page.id);
      } catch (err) {
        if (err.message === 'Not found') {
          throw Boom.notFound('The page was not found');
        }
        throw err;
      }

      return h.redirect(basePath.url(request, `/${request.params.testSlug}/${request.params.rev}`));
    }
  });

  server.route({
    method: 'GET',
    path: '/{testSlug}.atom',
    handler: async (request, h) => {
      let values;
      try {
        values = await pagesService.getVisibleBySlugWithRevisions(request.params.testSlug);
      } catch (err) {
        if (err.message === 'Not found') {
          throw Boom.notFound('The page was not found');
        }
        throw err;
      }

      const model = {
        page: values[0],
        revisions: values[1]
      };

      return h
        .view('test/index-atom', model, { layout: false })
        .header('Content-Type', 'application/atom+xml;charset=UTF-8')
        .header('Last-Modified', model.page.updated.toString());
    }
  });
};

exports.plugin = {
  name: 'web/test',
  dependencies: ['services/pages', 'services/comments'],
  register
};
