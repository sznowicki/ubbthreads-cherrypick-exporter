"use strict";
const nodebbApi = require('./api/nodebb');
const allDbs = require('./db/all-dbs');
const converter = require('./helpers/converter');

function makeCategories(cb) {
  allDbs.getAllDbs()
    .then(dbs => {
      dbs.mongo.collection('forums').find({}).toArray((err, forums) => {
        if (err) {
          throw err;
        }
        nodebbApi.createCategories(forums, (nodebbForums) => {
          cb(nodebbForums);
        });
      });

    })
    .catch(err => {
      throw err;
    });
}

function makeUsers(cb) {
  allDbs.getAllDbs()
    .then(dbs => {
      dbs.mongo.collection('users').find({}).toArray((err, users) => {
        nodebbApi.createUsers(users, (usersAdded) => {
          cb(usersAdded);
        });
      });
    })
    .catch(err => {
      throw err;
    })
}

function makeThreads(newUsers, newCategories, cb) {
  allDbs.getAllDbs()
    .then(dbs => {
      dbs.mongo.collection('topics').find({}).toArray((err, topics) => {

        sendTopic(0);
        function sendTopic(iteration) {
          const topicData = topics[iteration];

          let topic = {
            cid: newCategories[topicData.fid].cid,
            _uid: newUsers[topicData.uid].uid,
            title: topicData.subject,
            content: converter.ubbContentToNodebb(topicData.body),
            tags: [
              'import'
            ]
          };

          nodebbApi.createPost(topic, null, payload => {
            const tid = payload.topicData.tid;
            if (!topicData.replies.length) {
              return done();
            }

            sendReply(0);
            function sendReply(i) {
              let replyData = topicData.replies[i];
              let reply = {
                _uid: newUsers[replyData.uid].uid,
                title: replyData.subject,
                content: converter.ubbContentToNodebb(replyData.body),
                tags: [
                  'import'
                ]
              };
              nodebbApi.createPost(reply, tid, payload => {
                i++;
                if (!topic.replies || !topic.replies[i]) {
                  return done();
                }
                return sendReply(i);
              });
            }

            function done() {
              iteration++;
              if (!topics[iteration]) {
                return cb();
              }
              return sendTopic(iteration);
            }
          });
        }
      });
    })
    .catch(err => {
      throw err;
    })
}

module.exports = {
  makeCategories,
  makeUsers,
  makeThreads
};