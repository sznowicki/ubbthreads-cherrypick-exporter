"use strict";

const config = require('./helpers/config');
const forums = config.getSetting('forumsToExport');
const allDbs = require('./db/all-dbs');

const converter = require('./helpers/converter');
const prefix = config.getSetting('mysql.prefix');

const fs = require('fs');
const attachmentsHost = config.getSetting('attachmentsPath');

function makeForums(cb) {
  const keysToExport = [
    'FORUM_TITLE',
    'FORUM_DESCRIPTION',
    'FORUM_ID'
  ];
  const keysToUtf = [
    'FORUM_TITLE',
    'FORUM_DESCRIPTION'
  ];

  allDbs.getAllDbs()
    .then(dbs => {
      console.log('Databases ready. Export starts');

      console.log('Dropping old collection.');
      dbs.mongo.collection('forums').drop();

      forums.forEach((forumId, forumIteration) => {
        dbs.mysql.query(
          `SELECT * FROM ${prefix}FORUMS WHERE FORUM_ID = ${forumId}`,
          function (err, rows) {
            let row = rows[0];
            let forum = {};

            keysToExport.forEach(key => {
              let val = row[key];
              if (keysToUtf.indexOf(key) !== -1) {
                val = converter.toUtf8(val);
              }
              forum[key] = val;
            });

            console.log('Inserting forum:');
            console.log(forum.FORUM_TITLE);

            dbs
              .mongo
              .collection('forums')
              .insertOne(forum);
            if (forumIteration === forums.length -1) {
              cb(forums);
            }
          });
      });
    })
    .catch(e => {
      throw e;
    });
}

function makeForumsTopics(forums, cb) {
  allDbs.getAllDbs()
    .then(dbs => {
      let exportedPostIds = [];
      console.log('Topics export starts');
      console.log('Dropping old collection.');
      dbs.mongo.collection('topics').drop();

      const forumsLength = forums.length;
      let forumsDone = 0;
      forums.forEach(forumId => {
        console.log(forumId);
        dbs.mysql.query(
          `
          SELECT POST_ID
          FROM ${prefix}TOPICS 
          WHERE FORUM_ID = ${forumId}
          LIMIT 0, 99999999999
         `,
          function (err, rows) {
            const rowsLength = rows.length;
            let rowsDone = 0;
            rows.forEach((row) => {
              dbs.mysql.query(
                `
                SELECT * 
                FROM ${prefix}POSTS
                WHERE POST_ID = ${row.POST_ID}
                OR POST_PARENT_ID = ${row.POST_ID}
                ORDER BY POST_POSTED_TIME ASC
                LIMIT 0, 99999999999
                `,
                function (err, posts) {
                  let topic = {
                    uid: null,
                    fid: forumId,
                    time: null,
                    subject: null,
                    body: null,
                    replies: []
                  };
                  posts.forEach(post => {
                    exportedPostIds.push(post.POST_ID);
                    if (!post.POST_PARENT_ID) {
                      topic.postId = post.POST_ID;
                      topic.uid = post.USER_ID;
                      topic.time = post.POST_POSTED_TIME;
                      topic.subject = converter.toUtf8(post.POST_SUBJECT);
                      topic.body = converter.toUtf8(post.POST_BODY);
                      return;
                    }
                    let sanePost = {
                      postId: post.POST_ID,
                      uid: post.USER_ID,
                      time: post.POST_POSTED_TIME,
                      subject: converter.toUtf8(post.POST_SUBJECT),
                      body: converter.toUtf8(post.POST_BODY)
                    };
                    topic.replies.push(sanePost);
                  });
                  console.log('Inserting topic for forum: ' + forumId);
                  console.log('Topic subject: ' + topic.subject);
                  console.log('Topic postID: ' + topic.postId);

                  dbs.mongo.collection('topics').insertOne(topic);
                  rowsDone++;
                  if (rowsDone === rowsLength) {
                    forumsDone++;
                  }
                  if (forumsDone === forumsLength) {
                    return cb(exportedPostIds);
                  }
                }
              )
            });
          }
        )
      });
    })
    .catch(e => {
      throw e;
    })
}

function makeAttachments(postIds, cb) {
  allDbs.getAllDbs()
    .then(dbs => {
      console.log('Attachments export starts');
      console.log('Posts with attachments:');
      console.log(postIds);
      if (!postIds.length) {
        console.log('No posts with attachments');
        cb();
      }
      console.log('Dropping old collection.');
      dbs.mongo.collection('attachments').drop();

      const postIdsLength = postIds.length;
      let postIdsDone = 0;
      postIds.forEach(pid => {
        dbs.mysql.query(
          `
          SELECT * FROM ${prefix}FILES
          WHERE POST_ID = ${pid}
          `,
          function(err, rows) {
            if (err || !rows || !rows.length) {
              postIdsDone++;
              return;
            }
            const rowsLength = rows.length;
            let rowsDone = 0;
            rows.forEach(row => {
              if (!row.FILE_NAME) {
                console.log('No  file name, skipping.');
                return done();
              }
              fs.readFile(attachmentsHost + row.FILE_NAME, 'base64', function (err,data) {
                if (err){
                  console.log('Attachments download error for postID' + pid);
                  console.log(err);
                  return done();
                }
                console.log('saving attachment:' + row.FILE_NAME);
                let file = {
                  pid: row.POST_ID,
                  name: converter.toUtf8(row.FILE_NAME),
                  body: data
                };
                dbs.mongo.collection('attachments').insertOne(file);
                return done();
              });

              function done() {
                rowsDone++;

                if (rowsDone === rowsLength) {
                  postIdsDone++;
                }

                console.log('Progress' + parseInt(postIdsDone / postIdsLength * 100) + '%')

                if (postIdsDone === postIdsLength) {
                  cb();
                }
              }

            });
          }
        )
      });
    })
    .catch(e => {
      throw e;
    });
}

function makeUsers(postIds, cb) {
  allDbs.getAllDbs()
    .then(dbs => {
      console.log('Starting users');
      console.log('Dropping old collection');
      dbs.mongo.collection('users').drop();
      const postIdsLength = postIds.length;
      let postIdsDone = 0;
      let usersExported = [];
      postIds.forEach(postId => {
        dbs.mysql.query(
          `
          SELECT * FROM ${prefix}USERS WHERE USER_ID IN(
            SELECT 
              USER_ID 
              FROM ${prefix}POSTS
              WHERE POST_ID = ${postId}
           )
          `,
          function(err, rows) {
            if (err) {
              throw err;
            }
            rows.forEach(row => {
              let alias = row.USER_DISPLAY_NAME ? row.USER_DISPLAY_NAME : row.USER_LOGIN_NAME;
              alias = converter.toUtf8(alias);

              if (usersExported.indexOf(row.USER_ID) > -1) {
                console.log('User skipped ' + alias);
                return done();
              }

              usersExported.push(row.USER_ID);
              let user = {
                uid: row.USER_ID,
                alias: alias
              };
              dbs.mongo.collection('users').insertOne(user);
              console.log('User added ' + alias);

              done();
              function done() {
                postIdsDone++;
                if (postIdsDone === postIdsLength) {
                  cb();
                }
              }
            });
          }
        );
      });
    })
    .catch(e => {
      throw e;
    })
}

module.exports = {
  makeForums,
  makeForumsTopics,
  makeAttachments,
  makeUsers
};