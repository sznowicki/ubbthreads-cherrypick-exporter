"use strict";

const MongoClient = require('mongodb').MongoClient;
const mongodbUrl = 'mongodb://localhost:27017';

const Mongo = function() {
  let connection;

  this.getConnection = () => {
    return new Promise((resolve, reject) => {
      if (connection) {
        return resolve(connection);
      }
      MongoClient.connect(
        mongodbUrl + '/ubbthreads-cherrypick-exporter',
        (err, db) =>  {
          if (err) {
            return reject(err);
          }
          connection = db;
          return resolve(db);
        }
      );
    });
  };

  return this;
};

module.exports = new Mongo();