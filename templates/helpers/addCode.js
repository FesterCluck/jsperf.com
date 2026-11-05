const Handlebars = require('handlebars');

// Titles are user input: escape everything, then turn `backticked` spans into <code> elements.
module.exports = function (str) {
  const text = String(str == null ? '' : str);
  const escape = Handlebars.Utils.escapeExpression;
  let result = '';
  let last = 0;

  for (const match of text.matchAll(/`([^`]*)`/g)) {
    result += escape(text.slice(last, match.index)) + '<code>' + escape(match[1]) + '</code>';
    last = match.index + match[0].length;
  }

  return new Handlebars.SafeString(result + escape(text.slice(last)));
};
