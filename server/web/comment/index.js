'use strict';

const Boom = require('@hapi/boom');

const register = (server) => {
  const commentsService = server.plugins['services/comments'];

  server.route({
    method: 'GET',
    options: {
      auth: {
        mode: 'try',
        strategy: 'session'
      }
    },
    path: '/comment/delete/{commentId}',
    handler: async (request) => {
      if (!request.yar.get('admin')) {
        throw Boom.unauthorized('Unauthorized');
      }

      await commentsService.delete(request.params.commentId);
      return 'Comment deleted';
    }
  });
};

exports.plugin = {
  name: 'web/comment',
  dependencies: ['services/comments'],
  register
};
