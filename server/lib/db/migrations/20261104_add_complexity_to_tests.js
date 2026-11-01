// Static Big-O estimate of each test (see server/lib/complexity.js). NULL = not analyzed yet; such rows
// are analyzed and stored the first time their page is viewed, so this migration needs no backfill.
module.exports = {
  up: function ({ context: { genericQuery } }) {
    return genericQuery('ALTER TABLE tests ADD COLUMN complexity JSON NULL DEFAULT NULL;');
  },

  down: function ({ context: { genericQuery } }) {
    return genericQuery('ALTER TABLE tests DROP COLUMN complexity;');
  }
};
