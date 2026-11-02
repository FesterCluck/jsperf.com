'use strict';

/* eslint no-template-curly-in-string: 0 */
module.exports = {
  slug: 'testuser-formatting-dates-as-iso-8601',
  title: 'Formatting dates as ISO 8601',
  info: 'Producing ISO 8601 output from a Date.',
  initHTML: '',
  setup: [
    'var stamp = new Date(Date.UTC(2020, 5, 15, 12, 30, 45));',
    'var out;'
  ].join('\n'),
  teardown: '',
  test: [
    {
      title: 'ISO 8601',
      defer: 'n',
      code: [
        'out = stamp.toISOString();'
      ].join('\n')
    },
    {
      title: 'manual padding',
      defer: 'n',
      code: [
        'function pad(v) {',
        '  return v < 10 ? \'0\' + v : String(v);',
        '}',
        'out = stamp.getUTCFullYear() + \'-\' + pad(stamp.getUTCMonth() + 1) + \'-\' + pad(stamp.getUTCDate());'
      ].join('\n')
    },
    {
      title: 'JSON.stringify',
      defer: 'n',
      code: [
        'out = JSON.stringify(stamp);'
      ].join('\n')
    }
  ]
};
