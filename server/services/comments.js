'use strict';

const name = 'services/comments';
const register = (server, options) => {
  const commentsRepo = server.plugins['repositories/comments'];

  server.expose('create', async function (pageID, ip, payload) {
    server.log(['debug'], `${name}::create: ${JSON.stringify(arguments)}`);

    const comment = {
      pageID,
      author: payload.author,
      authorEmail: payload.authorEmail,
      authorURL: payload.authorURL,
      authorGitHub: payload.authorGitHub,
      content: payload.message,
      ip,
      published: new Date()
    };

    const id = await commentsRepo.create(comment);
    return Object.assign(comment, { id });
  });

  server.expose('delete', function (commentId) {
    server.log(['debug'], `${name}::delete: ${JSON.stringify(arguments)}`);

    return commentsRepo.delete(commentId);
  });
};

exports.plugin = {
  name,
  dependencies: ['repositories/comments'],
  register
};
