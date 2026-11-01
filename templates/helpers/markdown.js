const MarkdownIt = require('markdown-it');
const hljs = require('highlight.js');
const sanitizeHtml = require('sanitize-html');
const Handlebars = require('handlebars');

const md = new MarkdownIt({
  html: true,
  linkify: true,
  highlight: (code, lang) => {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
      } catch (e) {}
    }
    return '';
  }
});

const sanitizeOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 'span']),
  allowedAttributes: Object.assign({}, sanitizeHtml.defaults.allowedAttributes, {
    code: ['class'],
    span: ['class'],
    img: ['src', 'alt', 'title', 'width', 'height']
  })
};

module.exports = (content) => new Handlebars.SafeString(sanitizeHtml(md.render(String(content || '')), sanitizeOptions));
