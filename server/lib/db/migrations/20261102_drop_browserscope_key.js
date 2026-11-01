module.exports = {
  up: function ({ context: { genericQuery } }) {
    // dropping the column also removes the unique index on it
    return genericQuery('ALTER TABLE pages DROP COLUMN browserscopeID;');
  },

  down: function ({ context: { genericQuery } }) {
    return genericQuery(`
      ALTER TABLE pages
        ADD COLUMN browserscopeID varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER revision,
        ADD UNIQUE KEY browserscopeID (browserscopeID);
    `);
  }
};
