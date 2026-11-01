'use strict';

const Boom = require('@hapi/boom');

const getUpdatedDate = (results) => {
  if (results.length === 0) {
    return new Date();
  }

  return results[0].updated;
};

const atomHeaders = (response, updated) => response
  .header('Content-Type', 'application/atom+xml;charset=UTF-8')
  .header('Last-Modified', updated.toString());

const register = (server) => {
  const pagesRepo = server.plugins['repositories/pages'];

  server.route({
    method: 'GET',
    path: '/browse',
    handler: async (request, h) => {
      const context = {
        headTitle: 'Browse test cases',
        showAtom: {
          slug: 'browse'
        }
      };
      const key = {
        segment: 'browse',
        id: 'browse'
      };

      const cached = await server.plugins.cache.get(key);
      if (cached) {
        server.log('debug', 'cache hit on /browse');
        // massage data for template
        cached.item.forEach((r) => {
          r.published = new Date(r.published);
          r.updated = new Date(r.updated);
        });
        context.pages = cached.item;
        return h.view('browse/index', context);
      }

      server.log('debug', 'cache miss on /browse');
      try {
        const rows = await pagesRepo.getLatestVisible(250);
        context.pages = rows;
        await server.plugins.cache.set(key, rows, 60000);
      } catch (err) {
        context.genError = 'Sorry. Could not find tests to browse.';
      }

      return h.view('browse/index', context);
    }
  });

  server.route({
    method: 'GET',
    path: '/browse.atom',
    handler: async (request, h) => {
      const rows = await pagesRepo.getLatestVisible(20);
      const updated = getUpdatedDate(rows);

      return atomHeaders(h.view('browse/index-atom', {
        updated: updated.toISOString(),
        pages: rows
      }, {
        layout: false
      }), updated);
    }
  });

  server.route({
    method: 'GET',
    path: '/browse/{authorGitHub}',
    handler: async (request, h) => {
      const rows = await pagesRepo.getLatestVisibleForAuthor(request.params.authorGitHub);
      if (rows.length === 0) {
        throw Boom.notFound('The author was not found');
      }

      return h.view('browse/author', {
        headTitle: `Test cases by ${request.params.authorGitHub}`,
        showAtom: {
          slug: `browse/${request.params.authorGitHub}`
        },
        author: request.params.authorGitHub,
        pages: rows
      });
    }
  });

  server.route({
    method: 'GET',
    path: '/browse/{authorGitHub}.atom',
    handler: async (request, h) => {
      const rows = await pagesRepo.getLatestVisibleForAuthor(request.params.authorGitHub);
      const updated = getUpdatedDate(rows);

      return atomHeaders(h.view('browse/author-atom', {
        author: request.params.authorGitHub,
        update: updated.toISOString,
        pages: rows
      }, {
        layout: false
      }), updated);
    }
  });
};

exports.plugin = {
  name: 'web/browse',
  dependencies: ['repositories/pages', 'cache'],
  register
};
