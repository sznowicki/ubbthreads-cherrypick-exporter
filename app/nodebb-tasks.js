"use strict";
const nodebbApi = require('./api/nodebb');
const allDbs = require('./db/all-dbs');
const converter = require('./helpers/converter');
const attachments = require('./model/attachments');
const NodeBBUsers = require('./nodebb/models/users');

const Pid2bbpid = require('./nodebb/models/pid2bbpid');

function makeCategories(cb) {
  allDbs.getAllDbs()
    .then(dbs => {
      dbs.mongo.collection('forums').find({ bbCid: { $exists: false } }).toArray((err, forums) => {
        if (err) {
          throw err;
        }
        if (!forums.length) {
          return cb();
        }
        nodebbApi.createCategories(forums, (nodebbForums) => {
          let done = 0;
          if (nodebbForums) {
            nodebbForums.forEach(function (forum) {
              dbs.mongo.collection('forums').updateOne(
                {
                  FORUM_ID: forum.FORUM_ID
                },
                {
                  $set: {
                    bbCid: forum.cid
                  }
                },
                function (err) {
                  if (err) {
                    console.error(err);
                    throw new Error('Category creation failed.')
                  }
                  done++;
                  if (done === nodebbForums.length) {
                    return cb();
                  }
                }
              )
            });
          }
          return cb();
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
      dbs.mongo.collection('users').find({ bbUid: { $exists: false } }).toArray((err, users) => {
        if (!users.length) {
          return cb();
        }
        nodebbApi.createUsers(dbs, users, (usersAdded) => {
          return cb();
        });
      });
    })
    .catch(err => {
      throw err;
    })
}

function makeThreads(cb) {
  allDbs.getAllDbs()
    .then(dbs => {
      /**
       *
       * @type {Pid2bbpid}
       */
      const pid2bbpid = new Pid2bbpid(dbs.mongo);
      return process();
      function process() {
        dbs.mongo.collection('topics').find({ bbPid: { $exists: false } }).limit(1).toArray((err, topics) => {
          if (err) {
            console.error(err);
            throw new Error('Could not get topics');
          }
          if (!topics.length) {

            return cb();
          }
          console.log('\x1b[34m', `${topics.length}`, '\x1b[0m');
          const topicData = topics[0];
          if (!topicData.uid || !topicData.subject) {
            console.log('INVALID TOPIC. SKIPPING');
            return dbs.mongo.collection('topics').removeOne(
              {
                _id: topicData._id
              },
              function () {
                return done();
              }
            );
          }

          NodeBBUsers.getBBUidFromUid(dbs.mongo, topicData.uid)
            .then(bbUid => {
              dbs.mongo.collection('forums').find({ FORUM_ID: topicData.fid }).toArray((err, forum) => {
                if (err) {
                  console.error(err);
                  throw new Error('Error geting forum.');
                }
                let bbCid = forum[0].bbCid;

                let topic = {
                  cid: bbCid,
                  _uid: bbUid,
                  title: topicData.subject,
                  timestamp: topicData.time * 1000,
                  content: 'DUMMY CONTENT',
                  tags: [
                    'import'
                  ]
                };

                nodebbApi.createPost(topic, null, payload => {
                  const bbTid = payload.topicData.tid;
                  const bbPid = payload.postData.pid;

                  pid2bbpid.insert(topicData.postId, bbPid);

                  dbs.mongo.collection('topics').updateOne(
                    { postId: topicData.postId },
                    {
                      $set: {
                        bbTid,
                        bbPid
                      }
                    },
                    function (err) {
                      if (err) {
                        console.error(err);
                        throw new Error('Could not create topic (bbPid : ' + bbPid + ')');
                      }

                      if (!topicData.replies.length) {
                        return done();
                      }

                      sendReply(0);
                      function sendReply(i) {
                        let replyData = topicData.replies[i];
                        if (!replyData.uid || !replyData.body) {
                          console.log('INVALID REPLY SKIPPING');
                          return replyDone();
                        }

                        NodeBBUsers.getBBUidFromUid(dbs.mongo, replyData.uid)
                          .then(bbUid => {
                            let reply = {
                              _uid: bbUid,
                              title: replyData.subject,
                              content: 'emptyemptyemptyemptyemptyemptyemptyemptyempty',
                              timestamp: replyData.time * 1000,
                              tags: [
                                'import'
                              ]
                            };

                            nodebbApi.createPost(reply, bbTid, payload => {
                              pid2bbpid.insert(replyData.postId, payload.pid);
                              return replyDone();
                            });
                          })
                          .catch(err => {
                            console.error(err);
                            throw new Error(`Could get bbUid for: ${replyData.uid}`);
                          });

                        function replyDone() {
                          i++;
                          if (!topicData.replies[i]) {
                            return done();
                          }
                          return sendReply(i);
                        }
                      }
                    }
                  );
                });
              });
            })
            .catch(err => {
              console.error(err);
              throw new Error('Could not get user for topic');
            });

          function done() {
            return process();
          }
        });
      }
    })
    .catch(err => {
      throw err;
    })
}

function convertContents(cb) {
  allDbs.getAllDbs()
    .then(dbs => {
      /**
       *
       * @type {Pid2bbpid}
       */
      const pid2bbpid = new Pid2bbpid(dbs.mongo);
      return process();
      function process() {
        dbs.mongo.collection('topics').find({ converted: { $exists: false } }).limit(1).toArray((err, topics) => {
          if (!topics.length) {
            console.log('Nothing to convert. Bye');
            return cb();
          }
          let topic = topics[0];

          NodeBBUsers.getBBUidFromUid(dbs.mongo, topic.uid)
            .then(bbuid => {
              let uid = bbuid;
              let pid = topic.bbPid;
              attachments.getAttachments(topic.postId)
                .then(files => {
                  converter.ubbContentToNodebb(topic.body, { files, pid2bbpid }, (newContent) => {
                    nodebbApi.updatePost(pid, uid, newContent)
                      .then(() => {
                        if (!topic.replies.length) {
                          return doneReplies();
                        }
                        return convertReply(0);
                      })
                      .catch(err => {
                        console.error(err);
                        throw new Error(`Could not update topic: (bbpid: ${pid}`);
                      });

                    function convertReply(i) {
                      let reply = topic.replies[i];
                      if (!reply.uid || !reply.body) {
                        console.log('INVALID REPLY SKIPPING');
                        return done();
                      }
                      NodeBBUsers.getBBUidFromUid(dbs.mongo, reply.uid)
                        .then(bbuid => {
                          pid2bbpid.getbbPid(reply.postId)
                            .then(bbpid => {
                              attachments.getAttachments(reply.postId)
                                .then(files => {
                                  converter.ubbContentToNodebb(reply.body, {
                                    files,
                                    pid2bbpid
                                  }, newContent => {
                                    nodebbApi.updatePost(bbpid, bbuid, newContent)
                                      .then(() => {
                                        i++;
                                        if (!topic.replies[i]) {
                                          return doneReplies();
                                        }
                                        return convertReply(i);
                                      })
                                      .catch(err => {
                                        console.error(err);
                                        throw new Error(`Could not update reply: bbpid: ${bbpid}`);
                                      });
                                  });
                                })
                                .catch(err => {
                                  console.error(err);
                                  throw new Error(`Could not get attachments for reply: postID: ${reply.postId}`);
                                });
                            })
                            .catch(err => {
                              console.error(err);
                              console.log('No bbpid for reply. Skipping');
                              i++;
                              if (!topic.replies[i]) {
                                return doneReplies();
                              }
                              return convertReply(i);
                            });
                        })
                        .catch(err => {
                          console.error(err);
                          throw new Error(`bbuid not found for topic (postId: ${topic.postId}), postId: ${reply.postId}`);
                        });

                    }

                    function doneReplies() {
                      dbs.mongo.collection('topics').updateOne(
                        {
                          postId: topic.postId
                        },
                        {
                          $set: {
                            converted: true
                          }
                        },
                        function (err, result) {
                          if (err) {
                            console.error(err);
                            throw new Error(`Could not convert topic (postId: ${topic.postId})`);
                          }

                          console.log(`Finished topic: ${topic.postId}`);

                          return process();
                        }
                      );

                    }
                  });
                })
                .catch(err => {
                  throw err;
                });
            })
            .catch(err => {
              console.error(err);
              throw new Error(`Could not convert topic, not user. (postId: ${topic.postId}`);
            });
        });
      }
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