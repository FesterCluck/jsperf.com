module.exports = {
  up: function ({ context: { genericQuery } }) {
    return genericQuery(`
      CREATE TABLE IF NOT EXISTS users (
        id int unsigned NOT NULL AUTO_INCREMENT,
        username varchar(39) COLLATE utf8mb4_unicode_ci NOT NULL,
        passwordHash varchar(255) NOT NULL,
        created datetime NOT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY username (username)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  },

  down: function ({ context: { genericQuery } }) {
    return genericQuery('DROP TABLE users;');
  }
};
