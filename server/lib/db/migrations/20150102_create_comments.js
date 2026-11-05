module.exports = {
  up: function ({ context: { genericQuery } }) {
    return genericQuery(`
      CREATE TABLE IF NOT EXISTS comments (
        id int NOT NULL AUTO_INCREMENT,
        pageID int NOT NULL,
        author varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
        authorEmail varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
        authorURL varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
        content mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
        ip varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
        published datetime NOT NULL,
        PRIMARY KEY (id),
        KEY pageID (pageID)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  },

  down: function ({ context: { genericQuery } }) {
    return genericQuery('DROP TABLE comments;');
  }
};
