const Handlebars = require('handlebars');

module.exports = function (msg, options) {
  let result;
  const tag = options.hash.tag || 'span';
  if (msg) {
    result = new Handlebars.SafeString('<' + tag + ' class="error">' + msg + '</' + tag + '>');
  }

  return result;
};
