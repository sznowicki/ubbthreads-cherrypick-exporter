"use strict";
const mysql = require('./mysql');
const mongo = require('./mongo');

let mongoConnection;
let mysqlConnection;

const connectionsPromise = new Promise((resolve, reject) => {
  mongo.getConnection()
    .then(db => {
      mongoConnection = db;
      if (mysqlConnection) {
        resolve({
          mongo: mongoConnection,
          mysql: mysqlConnection
        })
      }
    })
    .catch(err => {
      reject(err);
    });

  mysql.getConnection()
    .then((db) => {
      mysqlConnection = db;
      if (mongoConnection) {
        resolve({
          mongo: mongoConnection,
          mysql: mysqlConnection
        })
      }
    })
    .catch(err => {
      reject(err);
    });
});

/**
 *
 * @returns {Promise}
 */
function getAllDbs() {
  return connectionsPromise;
}

module.exports = {
  getAllDbs
};