'use strict';

/* eslint no-template-curly-in-string: 0 */
module.exports = {
  slug: 'testuser-formatting-dates-as-epoch-milliseconds',
  title: 'Formatting dates as epoch milliseconds',
  info: 'Producing epoch milliseconds output from a Date.',
  initHTML: '',
  setup: [
    'var stamp = new Date(Date.UTC(2020, 5, 15, 12, 30, 45));',
    'var out;'
  ].join('\n'),
  teardown: '',
  test: [
    {
      title: 'epoch milliseconds',
      defer: 'n',
      code: [
        'out = String(stamp.getTime());'
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
