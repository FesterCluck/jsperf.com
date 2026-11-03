// Ownership belongs to an account. Pages created before this column existed have no owner (NULL), so
// nobody can claim them by registering a matching username.
module.exports = {
  up: function ({ context: { genericQuery } }) {
    return genericQuery('ALTER TABLE pages ADD COLUMN userID int unsigned NULL DEFAULT NULL, ADD KEY userID (userID);');
  },

  down: function ({ context: { genericQuery } }) {
    return genericQuery('ALTER TABLE pages DROP KEY userID, DROP COLUMN userID;');
  }
};
