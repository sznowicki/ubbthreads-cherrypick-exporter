"use strict";

const encoding = require('encoding');
const config = require('../helpers/config');
const fromCharset = config.getSetting('mysql.realCharset');
const toMarkdown = require('to-markdown');
const stripTags = require('striptags');
const jsdom = require('jsdom');
const urlParse = require('url-parse');
const queryString = require('query-string');

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
function ubbContentToNodebb(string, data, cb) {

  let content = string;
  jsdom.env(
    content,
    ["http://code.jquery.com/jquery.js"],
    function(err, window) {
      let $ = window.$;
      $('img').each(function() {
        let $img = $(this);
        if ($img.attr('src').indexOf('GRAEMLIN_URL') > -1) {
          $img.remove();
          return;
        }
      });
      $('a').each(function(){
        let $el = $(this);
        let href = $el.attr('href');
        let parsed = urlParse(href);
        if (parsed.query) {
          let parsedQuery = queryString.parse(parsed.query);
          if (parsedQuery.Number && data.postsMapping[parsedQuery.Number]) {
            let pid = data.postsMapping[parsedQuery.Number];
            href = `/post/${pid}`;
          }
        }
        $el.attr('href', href);
      });
      data.files.forEach(file => {
        let $el;
        let src = `//files.zlosniki.pl/${file.name}`;

        if (['jpg', 'jpeg', 'png', 'gif', 'bmp'].indexOf(file.type) > -1) {
          $el = $(`<img src="${src}" class="attachment-img">`);
        } else {
          $el = $(`<a href="${src}" class="attachment-file">`);
        }
        $('body').append($el);
      });
      content = $('body').html();
      content = toMarkdown(content);
      content = stripTags(content, '<br><a><img><p>');
      return cb(content);
    }
  );
}

module.exports = {
  toUtf8,
  toMD,
  ubbContentToNodebb
};