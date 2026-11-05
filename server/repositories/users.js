'use strict';

const name = 'repositories/users';
const table = 'users';

exports.plugin = {
  name,
  dependencies: ['db'],
  register: (server) => {
    const db = server.plugins.db;

    server.expose('create', async (payload) => {
      const result = await db.genericQuery('INSERT INTO ?? SET ?', [table, payload]);
      return result.insertId;
    });

    server.expose('getByUsername', async (username) => {
      const rows = await db.genericQuery('SELECT * FROM ?? WHERE username = ? LIMIT 1', [table, username]);
      return rows[0];
    });
  }
};
