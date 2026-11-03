const pages = require('../seeds/testuser');

const author = {
  author: 'Test User',
  authorGitHub: 'testuser',
  authorEmail: 'testuser@example.com',
  authorURL: 'https://example.com'
};

module.exports = {
  // sequential on purpose: keeps the connection count at one and preserves ids in seed order
  up: async function ({ context: { genericQuery } }) {
    for (const seed of pages) {
      const rows = await genericQuery('SELECT id FROM pages WHERE slug = ? LIMIT 1', [seed.slug]);
      if (rows.length > 0) {
        continue;
      }

      const result = await genericQuery('INSERT INTO pages SET ?', [Object.assign({
        slug: seed.slug,
        title: seed.title,
        info: seed.info,
        initHTML: seed.initHTML,
        setup: seed.setup,
        teardown: seed.teardown,
        visible: 'y',
        published: new Date()
      }, author)]);

      for (const test of seed.test) {
        await genericQuery('INSERT INTO tests SET ?', [{
          pageID: result.insertId,
          title: test.title,
          code: test.code,
          defer: test.defer
        }]);
      }
    }
  },

  down: async function ({ context: { genericQuery } }) {
    const slugs = pages.map((seed) => seed.slug);

    await genericQuery('DELETE FROM tests WHERE pageID IN (SELECT id FROM pages WHERE authorGitHub = ? AND slug IN (?))', ['testuser', slugs]);
    await genericQuery('DELETE FROM pages WHERE authorGitHub = ? AND slug IN (?)', ['testuser', slugs]);
  }
};
