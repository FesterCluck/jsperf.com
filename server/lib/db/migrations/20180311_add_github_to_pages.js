module.exports = {
  up: function ({ context: { genericQuery } }) {
    return genericQuery(`
      ALTER TABLE pages ADD COLUMN authorGitHub varchar(39) NOT NULL AFTER author, ADD INDEX gh_username (authorGitHub);
    `);
  },

  down: function ({ context: { genericQuery } }) {
    return genericQuery(`
      ALTER TABLE pages DROP COLUMN authorGithub, DROP INDEX gh_username;
    `);
  }
};
