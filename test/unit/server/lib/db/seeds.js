const Lab = require('lab');
const Code = require('code');
const Joi = require('joi');
const schema = require('../../../../../server/lib/schema');
const seeds = require('../../../../../server/lib/db/seeds/testuser');
const migration = require('../../../../../server/lib/db/migrations/20260101_seed_testuser_pages');

const lab = exports.lab = Lab.script();

lab.experiment('testuser seed pages', () => {
  lab.test('there are many seed pages', (done) => {
    Code.expect(seeds.length).to.be.above(100);
    done();
  });

  lab.test('every seed satisfies the test page schema', (done) => {
    seeds.forEach((seed) => {
      const result = Joi.validate(seed, schema.testPage);
      Code.expect(result.error, seed.slug).to.not.exist();
    });
    done();
  });

  lab.test('slugs are unique', (done) => {
    const slugs = seeds.map((seed) => seed.slug);
    Code.expect(new Set(slugs).size).to.equal(slugs.length);
    done();
  });

  lab.experiment('migration', () => {
    lab.test('inserts every page and its tests', (done) => {
      const queries = [];
      let nextId = 0;
      const genericQuery = (sql, values) => {
        queries.push({ sql, values });
        if (sql.indexOf('SELECT') === 0) {
          return Promise.resolve([]);
        }
        return Promise.resolve({ insertId: ++nextId });
      };

      migration.up(genericQuery).then(() => {
        const pageInserts = queries.filter((q) => q.sql === 'INSERT INTO pages SET ?');
        const testInserts = queries.filter((q) => q.sql === 'INSERT INTO tests SET ?');
        const expectedTests = seeds.reduce((sum, seed) => sum + seed.test.length, 0);

        Code.expect(pageInserts.length).to.equal(seeds.length);
        Code.expect(testInserts.length).to.equal(expectedTests);
        Code.expect(pageInserts[0].values[0].authorGitHub).to.equal('testuser');
        Code.expect(testInserts[0].values[0].pageID).to.equal(1);
        done();
      }).catch(done);
    });

    lab.test('skips pages that already exist', (done) => {
      const queries = [];
      const genericQuery = (sql, values) => {
        queries.push(sql);
        return Promise.resolve([{ id: 1 }]);
      };

      migration.up(genericQuery).then(() => {
        Code.expect(queries.every((sql) => sql.indexOf('SELECT') === 0)).to.be.true();
        done();
      }).catch(done);
    });

    lab.test('down removes tests then pages', (done) => {
      const queries = [];
      const genericQuery = (sql, values) => {
        queries.push({ sql, values });
        return Promise.resolve({});
      };

      migration.down(genericQuery).then(() => {
        Code.expect(queries.length).to.equal(2);
        Code.expect(queries[0].sql).to.startWith('DELETE FROM tests');
        Code.expect(queries[1].sql).to.startWith('DELETE FROM pages');
        Code.expect(queries[1].values[1].length).to.equal(seeds.length);
        done();
      }).catch(done);
    });
  });
});
