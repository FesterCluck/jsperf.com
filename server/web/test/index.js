'use strict';

const Boom = require('@hapi/boom');
const hljs = require('highlight.js');
const regex = require('../../lib/regex');
const ownership = require('../../lib/ownership');
const schema = require('../../lib/schema');
const basePath = require('../../lib/basePath');
const defaults = require('../../lib/defaults');
const complexity = require('../../lib/complexity');
const userAgent = require('../../lib/userAgent');
const clientIp = require('../../lib/clientIp');

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

        const isOwn = ownership.isOwner(request, page);

        return {
          headTitle: page.title,
          benchmark: true,
          showAtom: {
            slug: basePath.slug(request)
          },
          jsClass: true,
          // Don’t let robots index non-published test cases
          noIndex: page.visible === 'n' && isOwn,
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

      const ip = clientIp(request);
      const comment = await commentsService.create(model.page.id, ip, result.value);
      model.page.comments.push(comment);
      return h.view('test/index', model);
    }
  });

  // allows the owner to publish a test making it visible to the public
  server.route({
    method: 'POST',
    path: '/{testSlug}/{rev}/publish',
    options: {
      auth: {
        mode: 'try',
        strategy: 'session'
      }
    },
    handler: async (request, h) => {
      try {
        const values = await pagesService.getBySlug(request.params.testSlug, request.params.rev);
        const page = values[0];

        if (!ownership.isOwner(request, page)) {
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

  // The page's own code (preparation HTML, setup, teardown and the tests) is untrusted, so it runs here, in a
  // document that browsers sandbox into an opaque origin: no cookies, storage or access to the rest of the site
  // even when this URL is opened directly. `allow-scripts` is the only permission it gets.
  server.route({
    method: 'GET',
    path: '/{testSlug}/{rev}/frame',
    options: {
      // the page embeds this document, so it may be framed by the same origin
      security: { xframe: 'sameorigin' }
    },
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

      return h
        .view('test/frame', { page }, { layout: false })
        .header('Content-Security-Policy', 'sandbox allow-scripts');
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
