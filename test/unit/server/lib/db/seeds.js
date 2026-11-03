const Lab = require('@hapi/lab');
const Code = require('@hapi/code');
const schema = require('../../../../../server/lib/schema');
const seeds = require('../../../../../server/lib/db/seeds/testuser');
const migration = require('../../../../../server/lib/db/migrations/20261105_seed_testuser_pages');

const lab = exports.lab = Lab.script();

lab.experiment('testuser seed pages', () => {
  lab.test('there are many seed pages', () => {
    Code.expect(seeds.length).to.be.above(100);
  });

  lab.test('every seed satisfies the test page schema', () => {
    seeds.forEach((seed) => {
      const result = schema.testPage.validate(seed);
      Code.expect(result.error, seed.slug).to.not.exist();
    });
  });

  lab.test('slugs are unique', () => {
    const slugs = seeds.map((seed) => seed.slug);
    Code.expect(new Set(slugs).size).to.equal(slugs.length);
  });

  lab.experiment('migration', () => {
    lab.test('inserts every page and its tests', async () => {
      const queries = [];
      let nextId = 0;
      const genericQuery = async (sql, values) => {
        queries.push({ sql, values });
        return sql.indexOf('SELECT') === 0 ? [] : { insertId: ++nextId };
      };

      await migration.up({ context: { genericQuery } });
      const pageInserts = queries.filter((q) => q.sql === 'INSERT INTO pages SET ?');
      const testInserts = queries.filter((q) => q.sql === 'INSERT INTO tests SET ?');
      const expectedTests = seeds.reduce((sum, seed) => sum + seed.test.length, 0);

      Code.expect(pageInserts.length).to.equal(seeds.length);
      Code.expect(testInserts.length).to.equal(expectedTests);
      Code.expect(pageInserts[0].values[0].authorGitHub).to.equal('testuser');
      Code.expect(testInserts[0].values[0].pageID).to.equal(1);
    });

    lab.test('skips pages that already exist', async () => {
      const queries = [];
      const genericQuery = async (sql) => {
        queries.push(sql);
        return [{ id: 1 }];
      };

      await migration.up({ context: { genericQuery } });
      Code.expect(queries.every((sql) => sql.indexOf('SELECT') === 0)).to.be.true();
    });

    lab.test('down removes tests then pages', async () => {
      const queries = [];
      const genericQuery = async (sql, values) => {
        queries.push({ sql, values });
        return {};
      };

      await migration.down({ context: { genericQuery } });
      Code.expect(queries.length).to.equal(2);
      Code.expect(queries[0].sql).to.startWith('DELETE FROM tests');
      Code.expect(queries[1].sql).to.startWith('DELETE FROM pages');
      Code.expect(queries[1].values[1].length).to.equal(seeds.length);
    });
  });
});
