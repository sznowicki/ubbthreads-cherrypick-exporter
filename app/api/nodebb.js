"use strict";

const config = require('../helpers/config');
const token = config.getSetting('nodebbApiMasterToken');
const nodebbUrl = config.getSetting('nodebbApiUrl');
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
    console.log(forum);
    const nodeCategory = {
      name: forum.FORUM_TITLE,
      description: forum.FORUM_DESCRIPTION
    };
    client.post(
      nodebbUrl + '/categories',
      {
        headers: defaultHeaders,
        data: {
          _uid: nodebbMasterUser,
          name: nodeCategory.name,
          description: nodeCategory.description
        }
      },
      function(data, response) {
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
  const newUsers = [];
  let usersAdded = 0;
  client.post(
    nodebbUrl + '/groups',
    {
      headers: defaultHeaders,
      data: {
        _uid: nodebbMasterUser,
        name: 'Imported users ' + new Date().toString()
      }
    },
    function(data) {
      if (data.code !== 'ok') {
        throw new Error('Could not create group');
      }
      let group = data.payload;
      console.log(group);
      throw new Error();

      users.forEach(user => {
        const nodebbUser = {
          _uid: nodebbMasterUser,
          username: user.alias.replace(/\W/g, '')
        };
        client.post(
          nodebbUrl + '/users',
          {
            headers: defaultHeaders,
            data: nodebbUser
          },
          function(data) {
            if (data.code !== 'ok') {
              throw new Error('Could not create user: ' + user.alias);
            }
            newUsers[user.uid] = {
              uid: data.payload.uid,
              oldUid: user.uid
            };
            usersAdded++;
            client.post(
              nodebbUrl + ''
            )
            if (usersAdded === users.length) {
              cb(newUsers);
            }
          }
        )
      });
    }
  );
}

function createPost(postData, postParent, cb) {
  let path = '/POST';
  let data = {
    content: postData.content,
    _uid:postData._uid
  };

  if (postParent) {
    path += '/' + postParent;
  } else {
    data.title = postData.title;
    data.cid = postData.cid;
  }

  client.post(
    nodebbUrl + path,
    {
      headers: defaultHeaders,
      data: data,
      function(data) {
        if (data.code !== 'ok') {
          throw new Error('Could not create post: ' + postData.title);
        }
        cb(data.payload);
      }
    }
  )
}

module.exports = {
  createCategories,
  createUsers,
  createPost
};