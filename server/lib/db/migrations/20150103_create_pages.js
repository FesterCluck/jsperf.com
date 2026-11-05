module.exports = {
  up: function ({ context: { genericQuery } }) {
    return genericQuery(`
      CREATE TABLE IF NOT EXISTS pages (
        id int NOT NULL AUTO_INCREMENT,
        slug varchar(55) COLLATE utf8mb4_unicode_ci NOT NULL,
        revision int NOT NULL DEFAULT 1,
        browserscopeID varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
        title varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
        info mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
        setup mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
        teardown mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
        initHTML mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
        visible enum('y','n') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'y',
        author varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
        authorEmail varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
        authorURL varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
        hits bigint NOT NULL DEFAULT 0,
        published datetime NOT NULL,
        updated timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY browserscopeID (browserscopeID),
        KEY slugRev (slug, revision),
        KEY updated (updated),
        KEY author (author),
        KEY visible (visible)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  },

  down: function ({ context: { genericQuery } }) {
    return genericQuery('DROP TABLE pages;');
  }
};
