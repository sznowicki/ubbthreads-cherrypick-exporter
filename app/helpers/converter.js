"use strict";

const encoding = require('encoding');
const config = require('../helpers/config');
const fromCharset = config.getSetting('mysql.realCharset');
const toMarkdown = require('to-markdown');
const stripTags = require('striptags')

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
/**
 * Converts html to markdown
 * @param string
 */
function toMD(string) {
  return toMarkdown(string);
}
/**
 * Converts ubb post content to nodebb
 *
 * @param string
 */
function ubbContentToNodebb(string) {
  let content = string;
  content = toMarkdown(string);
  content = stripTags(content, '<br><a><img><p>');

  return content;
}

module.exports = {
  toUtf8,
  toMD,
  ubbContentToNodebb
};