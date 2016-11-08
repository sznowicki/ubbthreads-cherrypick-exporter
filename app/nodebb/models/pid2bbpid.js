"use strict";
/**
 *
 * @param mongo
 * @returns {Pid2bbpid}
 * @constructor
 */
function Pid2bbpid(mongo) {
  const collectionName = 'pid2bbpid';

  this.insert = function(pid, bbpid) {
    mongo.collection(collectionName).insertOne(
      {
        pid,
        bbpid
      }
    )
  };

  this.getbbPid = function (pid) {
    return new Promise((resolve, reject) => {
      pid = parseInt(pid);
      mongo.collection(collectionName)
        .find({
          pid
        })
        .toArray((err, rows) => {
          if (err || !rows.length) {
            return reject(err);
          }

          return resolve(rows[0].bbpid);
        })
    });
  };

  return this;
}

module.exports = Pid2bbpid;
