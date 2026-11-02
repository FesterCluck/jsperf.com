'use strict';

/* eslint no-template-curly-in-string: 0 */
module.exports = {
  slug: 'testuser-building-a-list-of-1000-dom-nodes',
  title: 'Building a list of 1000 DOM nodes',
  info: 'Creates 1000 list items using different DOM construction techniques.',
  initHTML: '<div id="host"></div>',
  setup: [
    'var count = 1000;',
    'var host = document.getElementById(\'host\');'
  ].join('\n'),
  teardown: [
    'host.innerHTML = \'\';'
  ].join('\n'),
  test: [
    {
      title: 'innerHTML string',
      defer: 'n',
      code: [
        'var html = \'<ul>\';',
        'for (var i = 0; i < count; i++) {',
        '  html += \'<li>\' + i + \'</li>\';',
        '}',
        'html += \'</ul>\';',
        'host.innerHTML = html;'
      ].join('\n')
    },
    {
      title: 'createElement and appendChild',
      defer: 'n',
      code: [
        'var list = document.createElement(\'ul\');',
        'for (var i = 0; i < count; i++) {',
        '  var item = document.createElement(\'li\');',
        '  item.textContent = i;',
        '  list.appendChild(item);',
        '}',
        'host.appendChild(list);'
      ].join('\n')
    },
    {
      title: 'DocumentFragment',
      defer: 'n',
      code: [
        'var fragment = document.createDocumentFragment();',
        'for (var i = 0; i < count; i++) {',
        '  var item = document.createElement(\'li\');',
        '  item.textContent = i;',
        '  fragment.appendChild(item);',
        '}',
        'var list = document.createElement(\'ul\');',
        'list.appendChild(fragment);',
        'host.appendChild(list);'
      ].join('\n')
    },
    {
      title: 'insertAdjacentHTML',
      defer: 'n',
      code: [
        'var markup = \'\';',
        'for (var i = 0; i < count; i++) {',
        '  markup += \'<li>\' + i + \'</li>\';',
        '}',
        'host.insertAdjacentHTML(\'beforeend\', \'<ul>\' + markup + \'</ul>\');'
      ].join('\n')
    }
  ]
};
