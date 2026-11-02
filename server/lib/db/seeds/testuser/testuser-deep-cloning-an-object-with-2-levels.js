'use strict';

/* eslint no-template-curly-in-string: 0 */
module.exports = {
  slug: 'testuser-deep-cloning-an-object-with-2-levels',
  title: 'Deep cloning an object with 2 levels',
  info: 'Different deep clone techniques on a nested structure 2 levels deep.',
  initHTML: '',
  setup: [
    'var depth = 2;',
    'function build(level) {',
    '  if (level === 0) {',
    '    return { leaf: true, values: [1, 2, 3], label: \'end\' };',
    '  }',
    '  return { level: level, left: build(level - 1), tags: ["a", "b"] };',
    '}',
    'var original = build(depth);',
    'var clone;',
    'function manualClone(value) {',
    '  if (value === null || typeof value !== \'object\') {',
    '    return value;',
    '  }',
    '  if (Array.isArray(value)) {',
    '    return value.map(manualClone);',
    '  }',
    '  var out = {};',
    '  Object.keys(value).forEach(function (key) {',
    '    out[key] = manualClone(value[key]);',
    '  });',
    '  return out;',
    '}'
  ].join('\n'),
  teardown: '',
  test: [
    {
      title: 'JSON round trip',
      defer: 'n',
      code: [
        'clone = JSON.parse(JSON.stringify(original));'
      ].join('\n')
    },
    {
      title: 'recursive clone',
      defer: 'n',
      code: [
        'clone = manualClone(original);'
      ].join('\n')
    },
    {
      title: 'Object.assign (shallow baseline)',
      defer: 'n',
      code: [
        'clone = Object.assign({}, original);'
      ].join('\n')
    }
  ]
};
