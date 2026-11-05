const Handlebars = require('handlebars');

module.exports = function (msg, options) {
  let result;
  const tag = options.hash.tag || 'span';
  if (msg) {
    result = new Handlebars.SafeString('<' + tag + ' class="error">' + Handlebars.Utils.escapeExpression(msg) + '</' + tag + '>');
  }

  return result;
};
