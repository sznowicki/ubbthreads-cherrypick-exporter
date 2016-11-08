"use strict";
const jsdom = require('jsdom');

const config = require('../helpers/config');
const token = config.getSetting('nodebbApiMasterToken');
const nodebbApiUrl = config.getSetting('nodebbApiUrl');
const nodebbUrl = config.getSetting('nodebbWebsiteUrl');
const nodebbMasterUser = config.getSetting('nodebbMasterUserId');

const nodeClientProto = require('node-rest-client').Client;
const client = new nodeClientProto();

const defaultHeaders = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
};

function createCategories(forums, cb) {
  const nodebbForums = [];
  let forumsAdded = 0;

  forums.forEach(forum => {
    const nodeCategory = {
      name: forum.FORUM_TITLE,
      description: forum.FORUM_DESCRIPTION
    };
    client.post(
      nodebbApiUrl + '/categories',
      {
        headers: defaultHeaders,
        data: {
          _uid: nodebbMasterUser,
          name: nodeCategory.name,
          description: nodeCategory.description
        }
      },
      function (data, response) {
        if (data.code !== 'ok') {
          throw new Error('Could not create category: ' + forum.FORUM_TITLE);
        }

        data.payload.FORUM_ID = forum.FORUM_ID;

        nodebbForums.push(data.payload);
        forumsAdded++;
        if (forumsAdded === forums.length) {
          cb(nodebbForums);
        }
      });
  });
}

function createUsers(dbs, users, cb) {
  const newUsers = [];
  const usersLength = users.length;
  let usersAdded = 0;
  return client.post(
    nodebbApiUrl + '/groups',
    {
      headers: defaultHeaders,
      data: {
        _uid: nodebbMasterUser,
        name: 'Imported users ' + new Date().toString(),
        private: false
      }
    },
    function (data) {
      if (data.code !== 'ok') {
        console.error(data);
        throw new Error('Could not create group');
      }
      let group = data.payload;
      let groupSlug = group.slug;

      return copyUser(0);

      function copyUser(i) {
        const user = users[i];
        const nodebbUser = {
          _uid: nodebbMasterUser,
          username: user.alias.replace(/\W/g, '')
        };
        client.get(
          nodebbUrl + '/user/' + nodebbUser.username.toLowerCase(),
          function (data, res) {
            const statusCode = res.statusCode;
            if (statusCode !== 200) {
              let username = nodebbUser.username;
              if (!username || username.length < 3) {
                nodebbUser.username = nodebbUser.username + new Date().getTime();
              }
              return client.post(
                nodebbApiUrl + '/users',
                {
                  headers: defaultHeaders,
                  data: nodebbUser
                },
                function (data) {
                  if (data.code !== 'ok') {
                    console.log(nodebbUser);
                    console.log(data);
                    throw new Error('Could not create user: ' + nodebbUser.username);
                  }
                  newUsers.push({
                    uid: data.payload.uid,
                    oldUid: user.uid
                  });
                  client.post(
                    nodebbApiUrl + `/groups/${groupSlug}/membership`,
                    {
                      headers: defaultHeaders,
                      data: {
                        _uid: data.payload.uid
                      }
                    },
                    function (postData, res) {
                      if (postData.code !== 'ok') {
                        throw new Error('User could not join the group: ' + nodebbUser.username);
                      }
                      usersAdded++;
                      console.log('User created, progress: ' + Math.round((usersAdded / usersLength) * 100) + '%');
                      return updateUser(user.uid, data.payload.uid);

                    }
                  )
                }
              )
            } else {
              const body = data.toString();
              jsdom.env(
                body,
                ["http://code.jquery.com/jquery.js"],
                function (err, window) {
                  if (err) {
                    throw err;
                  }
                  const uid = window.$('[data-uid]').data('uid');
                  if (!uid) {
                    throw new Error('No uid found for user');
                  }
                  newUsers.push({
                    uid: uid,
                    oldUid: user.uid,
                  });

                  usersAdded++;
                  console.log('User skipped, progress: ' + Math.round((usersAdded / usersLength) * 100) + '%');
                  return updateUser(user.uid, uid);
                }
              );

            }
          }
        );
        function done() {
          i++;
          if (!users[i]) {
            return cb(newUsers);
          }
          copyUser(i);
        }

        function updateUser(oldUid, bbUid) {
          if (!oldUid) {
            throw new Error('No old uid provided');
          }
          dbs.mongo.collection('users').updateOne(
            {
              uid: oldUid
            },
            {
              $set: {
                bbUid: bbUid
              }
            },
            function(err, result) {
              if (err) {
                console.error(err);
                throw new Error('Update user failed for ' . newUser.oldUid);
              }

              return done();
            }
          )
        }
      }
    }
  );
}

function createPost(postData, topicId, cb) {
  let path = '/topics';
  let data = {
    content: postData.content,
    _uid: postData._uid,
    timestamp: postData.timestamp,
  };

  if (topicId) {
    path += '/' + topicId;
  } else {
    data.cid = postData.cid;
    data.title =  postData.title;
  }
  client.post(
    nodebbApiUrl + path,
    {
      headers: defaultHeaders,
      data: data,
    },
    function (data) {
      if (data.code !== 'ok') {
        console.log(data);
        throw new Error('Could not create post: ' + postData.title);
      }
      if (topicId) {
        console.log(data.payload.topic.title);
      }
      cb(data.payload);
    }
  );
}

function updatePost(pid, _uid, content) {
  return new Promise((resolve, reject) => {
    client.put(
      nodebbApiUrl + '/posts/' + pid,
      {
        headers: defaultHeaders,
        data: {
          content,
          _uid
        }
      },
      function(data) {
        console.log('Post updated');
        if (data.code !== 'ok') {
          console.log('reject');
          return reject(data)
        }
        return resolve();
      }
    )
  });
}

module.exports = {
  createCategories,
  createUsers,
  createPost,
  updatePost,
};