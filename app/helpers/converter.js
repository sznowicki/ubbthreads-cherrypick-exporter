const encoding = require('encoding');
const config = require('../helpers/config');
const fromCharset = config.getSetting('mysql.realCharset');

/**
 * Converts ugly encoding given in config to utf-8
 * @param {string} blah
 * @returns {string} UTF-8 encoded string
 */
function toUtf8(blah) {
  if (fromCharset.toLowerCase() === 'utf-8') {
    return blah;
  }
  return encoding.convert(blah, 'UTF-8', fromCharset).toString();
}

module.exports = {
  toUtf8
};