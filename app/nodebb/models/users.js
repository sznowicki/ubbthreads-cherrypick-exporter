"use strict";
/**
 *
 */
function getBBUidFromUid(mongo, uid) {
  return new Promise((resolve, reject) => {
    mongo.collection('users').find({uid: uid}).toArray((err, users) => {
      if (err || !users.length) {
        return reject(err);
      }

      let bbUid = users[0].bbUid;
      return resolve(bbUid);
    });
  });
}

module.exports = {
  getBBUidFromUid
};