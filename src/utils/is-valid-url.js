const URL = require("url").URL;

module.exports = function (s) {
  const urlPattern = /^\s*(((http|https):\/\/)?([a-zA-Z\d][-\w\.]*)\.([a-zA-Z\.]{2,6})([-\/\w\p{L}\.~,;:%&=?!+$#*@\(?\)?]*)\/?)\s*$/
  return urlPattern.test(s);
};