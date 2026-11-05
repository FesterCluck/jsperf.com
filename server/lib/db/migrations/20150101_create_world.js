module.exports = {
  up: function ({ context: { genericQuery } }) {
    return genericQuery(`
      CREATE TABLE IF NOT EXISTS migrations (
        id int NOT NULL AUTO_INCREMENT,
        name varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
        tstamp timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  },

  down: function ({ context: { genericQuery } }) {
    return genericQuery('DROP TABLE migrations;');
  }
};
