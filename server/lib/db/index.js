const path = require('path');
const mysql = require('mysql2');
const { Umzug } = require('umzug');
const Storage = require('./umzugStorage');

const register = async function (server, options) {
  const pool = mysql.createPool({
    host: options.host,
    port: options.port,
    user: options.user,
    password: options.pass,
    database: options.db,
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: options.connectionLimit || 10
  }).promise();

  const logger = function (msg) {
    server.log(['db'], msg);
  };

  const genericQuery = async function (query, values) {
    if (options.debug) {
      logger(query);
    }
    const [rows] = await pool.query(query, values === undefined ? [] : values);
    return rows;
  };

  server.expose('escape', mysql.escape);
  server.expose('genericQuery', genericQuery);

  server.ext('onPostStop', () => pool.end());

  const migrator = new Umzug({
    context: { genericQuery },
    storage: new Storage({ genericQuery }),
    logger: {
      info: logger,
      warn: logger,
      error: logger,
      debug: logger
    },
    migrations: {
      glob: ['migrations/*.js', { cwd: __dirname }],
      // keep the historical names (including ".js") so applied migrations still match
      resolve: ({ name, path: filepath, context }) => {
        const migration = require(filepath);
        return {
          name: path.basename(name),
          up: () => migration.up({ context }),
          down: () => migration.down({ context })
        };
      }
    }
  });

  try {
    const migrations = await migrator.up();
    server.log(['info', 'db'], 'executed ' + migrations.length + ' migrations');
  } catch (err) {
    server.log(['error', 'db', 'migrations'], err);
    throw err;
  }
};

exports.plugin = {
  name: 'db',
  register
};
