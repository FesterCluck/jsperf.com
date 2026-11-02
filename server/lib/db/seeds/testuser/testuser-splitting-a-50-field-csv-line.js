'use strict';

/* eslint no-template-curly-in-string: 0 */
module.exports = {
  slug: 'testuser-splitting-a-50-field-csv-line',
  title: 'Splitting a 50 field CSV line',
  info: 'Parsing a comma separated line with 50 fields.',
  initHTML: '',
  setup: [
    'var fields = 50;',
    'var parts = [];',
    'for (var i = 0; i < fields; i++) {',
    '  parts.push(\'value\' + i);',
    '}',
    'var line = parts.join(\',\');',
    'var result;'
  ].join('\n'),
  teardown: '',
  test: [
    {
      title: 'split',
      defer: 'n',
      code: [
        'result = line.split(\',\');'
      ].join('\n')
    },
    {
      title: 'regex split',
      defer: 'n',
      code: [
        'result = line.split(/,/);'
      ].join('\n')
    },
    {
      title: 'indexOf scanning',
      defer: 'n',
      code: [
        'result = [];',
        'var start = 0;',
        'var end;',
        'while ((end = line.indexOf(\',\', start)) !== -1) {',
        '  result.push(line.slice(start, end));',
        '  start = end + 1;',
        '}',
        'result.push(line.slice(start));'
      ].join('\n')
    },
    {
      title: 'match',
      defer: 'n',
      code: [
        'result = line.match(/[^,]+/g);'
      ].join('\n')
    },
    {
      title: 'replace callback',
      defer: 'n',
      code: [
        'result = [];',
        'line.replace(/[^,]+/g, function (field) {',
        '  result.push(field);',
        '});'
      ].join('\n')
    }
  ]
};
