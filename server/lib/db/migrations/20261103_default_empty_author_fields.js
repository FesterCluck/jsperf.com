// Strict sql_mode (the MySQL 8 default) rejects inserts that omit NOT NULL columns without a default
module.exports = {
  up: async function ({ context: { genericQuery } }) {
    await genericQuery(`
      ALTER TABLE pages
        ALTER COLUMN authorEmail SET DEFAULT '',
        ALTER COLUMN authorURL SET DEFAULT '',
        ALTER COLUMN authorGitHub SET DEFAULT '';
    `);
    await genericQuery(`
      ALTER TABLE comments
        ALTER COLUMN authorEmail SET DEFAULT '',
        ALTER COLUMN authorURL SET DEFAULT '',
        ALTER COLUMN authorGitHub SET DEFAULT '';
    `);
  },

  down: async function ({ context: { genericQuery } }) {
    await genericQuery('ALTER TABLE pages ALTER COLUMN authorEmail DROP DEFAULT, ALTER COLUMN authorURL DROP DEFAULT, ALTER COLUMN authorGitHub DROP DEFAULT;');
    await genericQuery('ALTER TABLE comments ALTER COLUMN authorEmail DROP DEFAULT, ALTER COLUMN authorURL DROP DEFAULT, ALTER COLUMN authorGitHub DROP DEFAULT;');
  }
};
