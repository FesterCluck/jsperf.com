const table = 'migrations';

// umzug 3 storage: methods receive objects ({ name, path, context })
class CustomStorage {
  constructor (options) {
    this.genericQuery = options.genericQuery;
  }

  async logMigration ({ name }) {
    await this.genericQuery('INSERT INTO ?? SET ?', [table, { name }]);
  }

  async unlogMigration ({ name }) {
    await this.genericQuery('DELETE FROM ?? WHERE `name` = ? LIMIT 1;', [table, name]);
  }

  async executed () {
    try {
      const rows = await this.genericQuery('SELECT name FROM ?? ORDER BY id ASC;', [table]);
      return rows.map((r) => r.name);
    } catch (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') {
        // first run
        return [];
      }

      throw err;
    }
  }
}

module.exports = CustomStorage;
