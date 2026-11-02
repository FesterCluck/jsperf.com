'use strict';

/* eslint no-template-curly-in-string: 0 */
module.exports = {
  slug: 'testuser-enumerating-an-object-with-50-keys',
  title: 'Enumerating an object with 50 keys',
  info: 'Different ways to walk the own enumerable properties of an object with 50 keys.',
  initHTML: '',
  setup: [
    'var total = 50;',
    'var obj = {};',
    'for (var i = 0; i < total; i++) {',
    '  obj[\'key\' + i] = i;',
    '}',
    'var acc = 0;'
  ].join('\n'),
  teardown: '',
  test: [
    {
      title: 'for...in with hasOwnProperty',
      defer: 'n',
      code: [
        'acc = 0;',
        'for (var key in obj) {',
        '  if (Object.prototype.hasOwnProperty.call(obj, key)) {',
        '    acc += obj[key];',
        '  }',
        '}'
      ].join('\n')
    },
    {
      title: 'Object.keys',
      defer: 'n',
      code: [
        'acc = 0;',
        'var keys = Object.keys(obj);',
        'for (var i = 0; i < keys.length; i++) {',
        '  acc += obj[keys[i]];',
        '}'
      ].join('\n')
    },
    {
      title: 'Object.values',
      defer: 'n',
      code: [
        'acc = 0;',
        'var values = Object.values(obj);',
        'for (var i = 0; i < values.length; i++) {',
        '  acc += values[i];',
        '}'
      ].join('\n')
    },
    {
      title: 'Object.entries',
      defer: 'n',
      code: [
        'acc = 0;',
        'Object.entries(obj).forEach(function (entry) {',
        '  acc += entry[1];',
        '});'
      ].join('\n')
    }
  ]
};
