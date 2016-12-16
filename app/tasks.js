"use strict";

const config = require('./helpers/config');
const forums = config.getSetting('forumsToExport');
const allDbs = require('./db/all-dbs');
const converter = require('./helpers/converter');
const prefix = config.getSetting('mysql.prefix');
const fs = require('fs');

/**
 * Reads ubb forums and saves all
 * important data to mongo.
 * @param {function} cb
 */
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
            /**
             * Current row
             * @type {Object}
             */
            let row = rows[0];
            /**
             * Forum represantation which will be saved to mongo
             * @type {Object}
             */
            let forum = {};

            /**
             * Object preparation
             */
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

            if (forumIteration === forums.length - 1) {
              cb(forums);
            }
          });
      });
    })
    .catch(e => {
      throw e;
    });
}

/**
 * Gets all topics from mysql with replies and saves
 * them to mongo as one document
 * @param {Array} forums
 * @param {function} cb
 */
function makeForumsTopics(forums, cb) {
  allDbs.getAllDbs()
    .then(dbs => {
      /**
       * All postIds which were exported.
       * Will be passed to callback
       * @type {Array}
       */
      let exportedPostIds = [];
      console.log('Topics export starts');
      console.log('Dropping old collection.');
      dbs.mongo.collection('topics').drop();

      const forumsLength = forums.length;
      let forumsDone = 0;
      /*
       * This is fast, no need for memory management, can go async.
       */
      forums.forEach(forumId => {
        dbs.mysql.query(
          `
          SELECT TOPIC_ID
          FROM ${prefix}TOPICS 
          WHERE FORUM_ID = ${forumId}
          LIMIT 0, 99999999999
         `,
          function (err, rows) {
            copy(0);
            function copy(iteration) {
              let row = rows[iteration];
              dbs.mysql.query(
                `
                SELECT * 
                FROM ${prefix}POSTS
                WHERE TOPIC_ID = ${row.TOPIC_ID}
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
                    // post it topic
                    if (!post.POST_PARENT_ID) {
                      topic.postId = post.POST_ID;
                      topic.uid = post.USER_ID;
                      topic.time = post.POST_POSTED_TIME;
                      topic.subject = converter.toUtf8(post.POST_SUBJECT);
                      topic.body = converter.toUtf8(post.POST_BODY);
                      return;
                    }
                    // post is reply
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
                  iteration++;

                  if (!rows[iteration]) {
                    forumsDone++;
                    // all done, calling callback
                    if (forumsDone === forumsLength) {
                      return cb(exportedPostIds);
                    }
                    return;
                  }
                  return copy(iteration);
                }
              )
            }
          }
        )
      });
    })
    .catch(e => {
      console.log(e);
      throw e;
    });
}

function makeAttachments(postIds, cb) {
  allDbs.getAllDbs()
    .then(dbs => {
      console.log('Attachments export starts');
      console.log('Posts with attachments:');

      if (!postIds.length) {
        console.log('No posts with attachments');
        cb();
      }

      console.log('Dropping old collection.');
      dbs.mongo.collection('attachments').drop();

      const postIdsLength = postIds.length;
      let postIdsDone = 0;

      // starting one by one, to have control over memory
      return copy(0);

      function copy(iteration) {
        dbs.mysql.query(
          `
          SELECT * FROM ${prefix}FILES
          WHERE POST_ID = ${postIds[iteration]}
          `,
          function (err, rows) {
            if (err || !rows || !rows.length) {
              console.log('No files for this post. ' + postIds[iteration]);
              return done();
            }

            let rowsDone = 0;
            rows.forEach((row, i) => {
              if (!row.FILE_NAME) {
                console.log('No  file name, skipping.');
                return;
              }
              let file = {
                pid: row.POST_ID,
                name: converter.toUtf8(row.FILE_NAME),
                type: row.FILE_TYPE
              };
              dbs.mongo.collection('attachments').insertOne(file, function(err, result){
                rowsDone++;
                if (rowsDone === rows.length) {
                  return done();
                }
              });
            });

            function done() {
              postIdsDone++;
              console.log('Progress' + parseInt(postIdsDone / postIdsLength * 100) + '%');
              iteration++;
              // all files for export done, calling callback
              if (!postIds[iteration]) {
                return cb()
              }
              // calling next iteration
              return copy(iteration);
            }
          });
      }
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

      let postIdsDone = 0;
      let usersExported = [];
      // starting one by one, to have control over memory
      copy(0);

      function copy(iteration) {
        dbs.mysql.query(
          `
          SELECT * FROM ${prefix}USERS WHERE USER_ID IN(
            SELECT 
              USER_ID 
              FROM ${prefix}POSTS
              WHERE POST_ID = ${postIds[iteration]}
           )
          `,
          function (err, rows) {
            if (err) {
              throw err;
            }
            // always one user for post
            let row = rows[0];
            // preferably user_display_name for export since this was also visible one
            let alias = row.USER_DISPLAY_NAME ? row.USER_DISPLAY_NAME : row.USER_LOGIN_NAME;
            alias = converter.toUtf8(alias);

            // check if user already saved
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

            return done();

            function done() {
              postIdsDone++;
              iteration++;
              // nothing to do left, calling callback
              if (!postIds[iteration]) {
                return cb();
              }
              // calling next iteration
              copy(iteration);
            }
          }
        );
      }
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