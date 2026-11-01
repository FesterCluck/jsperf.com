module.exports = {
  up: function ({ context: { genericQuery } }) {
    return genericQuery(`
      CREATE TABLE IF NOT EXISTS tests (
        testID int NOT NULL AUTO_INCREMENT,
        pageID int NOT NULL,
        title varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
        code mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
        defer enum('y','n') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'n',
        PRIMARY KEY (testID),
        KEY pageID (pageID)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  },

  down: function ({ context: { genericQuery } }) {
    return genericQuery('DROP TABLE tests;');
  }
};
