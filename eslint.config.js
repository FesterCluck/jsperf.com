'use strict';

const neostandard = require('neostandard');

module.exports = [
  {
    ignores: ['node_modules/**', 'public/**', 'client/**', 'coverage*/**', 'tmp*/**', 'gulpfile.js', 'test/e2e/**']
  },
  ...neostandard({ semi: true }),
  {
    // lab derives its coverage parser options from this config and needs babel to not look for a babel config file
    languageOptions: {
      parserOptions: { requireConfigFile: false }
    }
  }
];
