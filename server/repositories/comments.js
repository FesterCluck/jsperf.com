'use strict';

const name = 'repositories/comments';
const table = 'comments';

const register = (server, options) => {
  server.expose('findByPageID', function (pageID) {
    server.log(['debug'], `${name}::findByPageID: ${JSON.stringify(arguments)}`);

    return server.plugins.db.genericQuery(
      'SELECT * FROM ?? WHERE pageID = ? ORDER BY published ASC',
      [table, pageID]
    );
  });

  server.expose('create', function (payload) {
    server.log(['debug'], `${name}::create: ${JSON.stringify(arguments)}`);

    return server.plugins.db.genericQuery('INSERT INTO ?? SET ?', [table, payload])
      .then(result => result.insertId);
  });

  server.expose('delete', function (commentId) {
    server.log(['debug'], `${name}::delete: ${JSON.stringify(arguments)}`);

    return server.plugins.db.genericQuery('DELETE FROM ?? WHERE id = ?', [table, commentId]);
  });
};

exports.plugin = {
  name,
  dependencies: ['db'],
  register
};
