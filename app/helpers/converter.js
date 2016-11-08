"use strict";

const encoding = require('encoding');
const config = require('../helpers/config');
const fromCharset = config.getSetting('mysql.realCharset');
const toMarkdown = require('to-markdown');
const stripTags = require('striptags');
const jsdom = require('jsdom');
const urlParse = require('url-parse');
const queryString = require('query-string');
const url = require('url');
const markdown = require('markdown').markdown;

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
  // unwrapped, often fail
  let content = `<div>${string}</div>`;
  content = content.replace(/\<\<GRAEMLIN_URL\>\>/g, 'GRAEMLIN_URL');
  //content = toMarkdown(content);
  //content = markdown.toHTML(content);
  //content = toMarkdown(content);
  //content = markdown.toHTML(content);
  /**
   *
   * @type {Pid2bbpid}
   */
  let pid2bbpid = data.pid2bbpid;
  return jsdom.env(
    content,
    ["http://code.jquery.com/jquery.js"],
    function (err, window) {
      if (err) {
        console.error(content);
        console.error(err);
      }
      let $ = window.$;
      $('img').each(function () {
        let $img = $(this);
        if (
          $img.attr('src').indexOf('GRAEMLIN_URL') > -1
          || $img.attr('src').indexOf('graemlins') > -1
        ) {
          $img.remove();
          return;
        }
      });
      let elementsToConvert = $('a, img');
      return convertElement(0);
      function convertElement(iteration) {
        let $el = $(elementsToConvert[iteration]);
        let href = '';
        let attr = '';
        try {
          if ($el.get(0).tagName.toLowerCase() === 'img') {
            attr = 'src';
          } else {
            attr = 'href';
          }
          let href = $el.attr(attr);
          let parsed = url.parse(href, true);
          if (!parsed.query) {
            return next();
          }
          let parsedQuery = parsed.query;
          if (
            parsedQuery.ubb
            && parsedQuery.ubb.toLowerCase() === 'download'
            && parsedQuery.Number
            && parsedQuery.filename
          ) {
            let fid = parsedQuery.Number;
            let filenameArr = parsedQuery.filename.split('.');
            if (filenameArr.length  < 2) {
              throw new Error('Attachment with invalid link');
            }
            let ext = filenameArr[filenameArr.length - 1];
            href = `//files.filedomain/${fid}.${ext}`;
            return done(attr, href);
          } else if (parsedQuery.Number && !parsedQuery.Board) {
            return pid2bbpid.getbbPid(parsedQuery.Number)
              .then(pid => {
                href = `/post/${pid}`;
                return done(attr, href);
              })
              .catch(err => {
                console.log('Invalid link. Skipping: ' + href);
                return done();
              });
          }
          return done();
        } catch (e) {
          console.log('Invalid link. Skipping: ' + href);
          return done();
        }
        function done(attr, href) {
          if (attr) {
            $el.attr(attr, href);
          }
          iteration++;
          if (typeof elementsToConvert[iteration] === 'undefined') {
            return next();
          }
          convertElement(iteration);
        }
      }

      function next() {
        data.files.forEach(file => {
          let $el;
          let src = `//files.filedomain/${file.name.replace(/\s/g, '%20')}`;

          if (['jpg', 'jpeg', 'png', 'gif', 'bmp'].indexOf(file.type) > -1) {
            $el = $(`<img src="${src}" class="attachment-img">`);
          } else {
            $el = $(`<a href="${src}" class="attachment-file">`);
          }
          $('body').append($el);
        });
        content = $('body').html();
        content = content.replace(/zlosnik|złośnik/g, 'zlosniki');
        content = content.replace(/Jarek23|jarek23/g, 'PanJarek');
        content = content.replace(/Yakub|yakub|Jakubek|jakubek/g, 'PanJJakub');
        content = content.replace(/szulczyk|Szulczyk/g, 'PanJarek');
        content = content.replace(/filedomain/g, 'zlosniki.pl');
        content = toMarkdown(content);
        content = stripTags(content, '<br><a><img><p>');
        return cb(content);
      }
    }
  );
}

module.exports = {
  toUtf8,
  toMD,
  ubbContentToNodebb
};