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
  const nodebbForums = {};
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

        nodebbForums[data.payload.FORUM_ID] = data.payload;
        forumsAdded++;
        if (forumsAdded === forums.length) {
          cb(nodebbForums);
        }
      });
  });
}

function createUsers(users, cb) {
  const newUsers = {};
  let usersAdded = 0;
  return client.post(
    nodebbApiUrl + '/groups',
    {
      headers: defaultHeaders,
      data: {
        _uid: nodebbMasterUser,
        name: 'Imported users ' + new Date().toString()
      }
    },
    function (data) {
      if (data.code !== 'ok') {
        throw new Error('Could not create group');
      }
      let group = data.payload;
      let groupSlug = group.slug;

      users.forEach((user, i) => {
        const nodebbUser = {
          _uid: nodebbMasterUser,
          username: user.alias.replace(/\W/g, '')
        };
        setTimeout(function () {
          client.get(
            nodebbUrl + '/user/' + nodebbUser.username.toLowerCase(),
            function (data, res) {
              const statusCode = res.statusCode;
              if (statusCode !== 200) {
                return client.post(
                  nodebbApiUrl + '/users',
                  {
                    headers: defaultHeaders,
                    data: nodebbUser
                  },
                  function (data) {
                    if (data.code !== 'ok') {
                      throw new Error('Could not create user: ' + nodebbUser.username);
                    }
                    newUsers[user.uid] = {
                      uid: data.payload.uid,
                      oldUid: user.uid
                    };
                    client.post(
                      nodebbApiUrl + `/groups/${groupSlug}/membership`,
                      {
                        headers: defaultHeaders,
                        data: {
                          _uid: newUsers[user.uid].uid
                        }
                      },
                      function (data, res) {
                        if (data.code !== 'ok') {
                          throw new Error('User could not join the group: ' + nodebbUser.username);
                        }
                        usersAdded++;
                        if (usersAdded === users.length) {
                          cb(newUsers);
                        }
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
                    newUsers[user.uid] = {
                      uid: uid,
                      oldUid: user.uid,
                    };
                    usersAdded++;
                    if (usersAdded === users.length) {
                      cb(newUsers);
                    }
                  }
                );

              }
            }
          );
        }, i * 100);
      });
    }
  );
}

function createPost(postData, topicId, cb) {
  let path = '/topics';
  let data = {
    content: postData.content,
    _uid: postData._uid,
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
      console.log(nodebbApiUrl + path);
      console.log(data);
      if (data.code !== 'ok') {
        throw new Error('Could not create post: ' + postData.title);
      }
      cb(data.payload);
    }
  );
}

module.exports = {
  createCategories,
  createUsers,
  createPost
};