'use strict';

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
    path: '/{testSlug}/{rev}/delete',
    handler: async (request, h) => {
      const context = {
        message: '',
        headTitle: 'Delete'
      };

      if (!request.yar.get('admin')) {
        context.message = 'You do not have permissions to delete a test';
        return h.view('delete/index', context).code(401);
      }

      const { testSlug, rev } = request.params;
      const deletedRevisions = await pagesService.deleteBySlug(testSlug, rev);

      if (deletedRevisions === 1) {
        context.message = `Deleted revision ${rev}`;
      } else if (deletedRevisions > 1) {
        context.message = `Deleted ${deletedRevisions} revisions`;
      } else {
        context.message = 'Could not delete';
      }

      return h.view('delete/index', context);
    }
  });
};

exports.plugin = {
  name: 'web/delete',
  dependencies: ['services/pages'],
  register
};
