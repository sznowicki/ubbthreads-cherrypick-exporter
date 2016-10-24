"use strict";
const nodebbApi = require('./api/nodebb');
const allDbs = require('./db/all-dbs');

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
        topics.forEach(topicData => {
          let topic = {
            cid: newCategories[topicData.fid],
            _uid: newUsers[topicData.uid],
            title: topicData.subject,
            content: topicData.body
          };

          nodebbApi.createPost(topic, null, payload => {
            console.log(payload);
          });

        });

      });
    })
    .catch(err => {
      throw err;
    })
}
module.exports = {
  makeCategories,
  makeUsers
};