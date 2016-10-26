"use strict";
const dbs = require('../db/all-dbs');

function getAttachments(postId) {
  return new Promise((resolve, reject) => {
    dbs.getAllDbs()
      .then(dbs => {
        console.log(postId);
        dbs.mongo.collection('attachments').find({pid: postId}).toArray((err, rows) => {
          if (err) {
            return reject(err);
          }

          return resolve(rows);
        });
      })
      .catch(e => {
        return reject(e);
      });
  });
}

module.exports = {
  getAttachments
};