const pages = require('../seeds/testuser');

const author = {
  author: 'Test User',
  authorGitHub: 'testuser',
  authorEmail: 'testuser@example.com',
  authorURL: 'https://example.com'
};

module.exports = {
  up: function (genericQuery) {
    // sequential on purpose: keeps the connection count at one and preserves ids in seed order
    return pages.reduce(function (chain, seed) {
      return chain
        .then(() => genericQuery('SELECT id FROM pages WHERE slug = ? LIMIT 1', [seed.slug]))
        .then(function (rows) {
          if (rows.length > 0) {
            return null;
          }

          const page = Object.assign({
            slug: seed.slug,
            title: seed.title,
            info: seed.info,
            initHTML: seed.initHTML,
            setup: seed.setup,
            teardown: seed.teardown,
            visible: 'y',
            published: new Date()
          }, author);

          return genericQuery('INSERT INTO pages SET ?', [page]).then(function (result) {
            return seed.test.reduce(function (testChain, test) {
              return testChain.then(() => genericQuery('INSERT INTO tests SET ?', [{
                pageID: result.insertId,
                title: test.title,
                code: test.code,
                defer: test.defer
              }]));
            }, Promise.resolve());
          });
        });
    }, Promise.resolve());
  },

  down: function (genericQuery) {
    const slugs = pages.map((seed) => seed.slug);

    return genericQuery('DELETE FROM tests WHERE pageID IN (SELECT id FROM pages WHERE authorGitHub = ? AND slug IN (?))', ['testuser', slugs])
      .then(() => genericQuery('DELETE FROM pages WHERE authorGitHub = ? AND slug IN (?)', ['testuser', slugs]));
  }
};
