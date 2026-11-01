const Handlebars = require('handlebars');
const hljs = require('highlight.js');

module.exports = function (code, lang) {
  const result = hljs.highlight(code, { language: lang, ignoreIllegals: true });
  return new Handlebars.SafeString('<pre><code class="' + lang + '">' + result.value + '</code></pre>');
};
