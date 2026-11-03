'use strict';

const defaults = require('../lib/defaults');

const name = 'repositories/tests';
const table = 'tests';

const register = (server, options) => {
  const db = server.plugins.db;
  const columns = ['pageID', 'title', 'defer', 'code', 'complexity'];

  // JSON column: NULL until the test has been analyzed
  const json = (value) => (value ? db.escape(JSON.stringify(value)) : 'NULL');

  server.expose('bulkCreate', function (pageID, tests) {
    let values = [];
    for (let i = 0, tl = tests.length; i < tl; i++) {
      const test = tests[i];
      values.push('(' + db.escape(pageID) + ', ' + db.escape(test.title) + ', ' + db.escape(test.defer) + ', ' + db.escape(test.code) + ', ' + json(test.complexity) + ')');
    }

    values = values.join(', ');

    return db.genericQuery('INSERT INTO ?? (??) VALUES ' + values, [table, columns])
      .then(function (result) {
        if (result.affectedRows !== tests.length) {
          throw new Error('Not all tests inserted');
        }
      });
  });

  server.expose('bulkUpdate', function (pageID, tests, isOwn) {
    const queries = [];

    tests.forEach(test => {
      // setting existing test title and code to blank indicates it should be deleted
      // Joi converts this to the default ...
      if (test.title === defaults.deleteMe && test.code === defaults.deleteMe) {
        // ... if it's theirs to delete ...
        if (isOwn && test.testID) {
          server.log('info', `deleting test ${test.testID} from page ${pageID}`);
          queries.push(db.genericQuery('DELETE FROM ?? WHERE pageID = ? AND testID = ?', [table, pageID, test.testID]));
        }
        // ... otherwise skip over the test
      } else {
        if (isOwn && test.testID) {
          queries.push(db.genericQuery('UPDATE ?? SET title = ?, defer = ?, code = ?, complexity = ? WHERE pageID = ? AND testID = ?', [table, test.title, test.defer, test.code, test.complexity ? JSON.stringify(test.complexity) : null, pageID, test.testID]));
        } else {
          queries.push(db.genericQuery('INSERT INTO ?? (??) VALUES (?, ?, ?, ?, ?)', [table, columns, pageID, test.title, test.defer, test.code, test.complexity ? JSON.stringify(test.complexity) : null]));
        }
      }
    });

    return Promise.all(queries).then((results) => {
      server.log(['debug'], `${name}::bulkUpdate results - ${JSON.stringify(results)}`);
      results.forEach((result) => {
        server.log(['debug'], `${name}::bulkUpdate result - ${JSON.stringify(result)}`);
        if (result.affectedRows !== 1) {
          throw new Error('Not all tests inserted');
        }
      });

      return Promise.resolve(results);
    });
  });

  server.expose('setComplexity', function (testID, complexity) {
    return db.genericQuery('UPDATE ?? SET complexity = ? WHERE testID = ?', [table, JSON.stringify(complexity), testID]);
  });

  server.expose('findByPageID', function (pageID) {
    server.log(['debug'], `${name}::findByPageID: ${JSON.stringify(arguments)}`);

    return db.genericQuery('SELECT * FROM ?? WHERE pageID = ?', [table, pageID]);
  });
};

exports.plugin = {
  name,
  dependencies: ['db'],
  register
};
