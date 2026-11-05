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
};

exports.plugin = {
  name,
  dependencies: ['db'],
  register
};
