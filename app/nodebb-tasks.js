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
  const postsMapping = {};
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
            content: 'emptyemptyemptyemptyemptyemptyemptyempty',
            tags: [
              'import'
            ]
          };

          nodebbApi.createPost(topic, null, payload => {
            const tid = payload.topicData.tid;

            postsMapping[topicData.postId] = payload.postData.pid;
            console.log('topic id');
            console.log(topicData.postId);

            if (!topicData.replies.length) {
              return done();
            }

            sendReply(0);
            function sendReply(i) {
              let replyData = topicData.replies[i];

              let reply = {
                _uid: newUsers[replyData.uid].uid,
                title: replyData.subject,
                content: 'emptyemptyemptyemptyemptyemptyemptyemptyempty',
                tags: [
                  'import'
                ]
              };

              nodebbApi.createPost(reply, tid, payload => {
                postsMapping[replyData.postId] = payload.pid;
                i++;
                if (!topicData.replies[i]) {
                  return done();
                }
                return sendReply(i);
              });
            }

            function done() {
              iteration++;
              if (!topics[iteration]) {
                return cb(postsMapping);
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

function convertContents(newUsers, postsMapping, cb) {
  allDbs.getAllDbs()
    .then(dbs => {
      dbs.mongo.collection('topics').find({}).toArray((err, topics) => {
        convertTopic(0);
        function convertTopic(iteration) {
          let topic = topics[iteration];
          let uid = newUsers[topic.uid].uid;
          let pid = postsMapping[topic.postId];
          converter.ubbContentToNodebb(topic.body, (newContent) => {
            nodebbApi.updatePost(pid, uid, newContent);

            if (!topic.replies.length) {
              return doneReplies();

            }

            return convertReply(0);

            function doneReplies() {
              setTimeout(function() {
                iteration++;
                console.log(iteration);
                if (!topics[iteration]) {
                  return cb();
                }
                return convertTopic(iteration);
              }, 100);
            }
            function convertReply(i) {
              let reply = topic.replies[i];
              let uid = newUsers[reply.uid].uid;
              let pid = postsMapping[reply.postId];

              converter.ubbContentToNodebb(reply.body, newContent => {
                nodebbApi.updatePost(pid, uid, newContent);
                i++;
                if (!topic.replies[i]) {
                  return doneReplies();
                }

                return convertReply(i);
              });
            }

          });
        }
      });
    })
    .catch(e => {
      throw e;
    });
}

module.exports = {
  makeCategories,
  makeUsers,
  makeThreads,
  convertContents
};