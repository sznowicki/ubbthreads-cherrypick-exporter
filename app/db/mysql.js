"use strict";

const mysql = require('mysql');
const configHelper = require('../helpers/config');

const MysqlConnection = function() {
  let connection;
  let config;

  this.getConnection = () => {
    return new Promise((resolve, reject) => {
      if (connection) {
        return resolve(connection);
      }

      connection = mysql.createConnection({
        host     : config.host,
        user     : config.username,
        password : config.password,
        database : config.dbname
      });

      return resolve(connection);
    });
  };

  init();

  return this;

  function init() {
    config = configHelper.getSetting('mysql');
  }
};

module.exports = new MysqlConnection();