const mysql = require('../../app/db/mysql');
const chai = require('chai');
const assert = chai.assert;

describe('Mysql connection factory test', function () {
  it('should give working mysql connection', function (done) {
    mysql.getConnection()
      .then((connection) => {
        connection.query("SELECT 1;", (err, rows) => {
          assert(err === null);
          done();
        });
      })
      .catch(() => {
        assert(false, 'Connection failed');
        done();
      });
  });
  it('should query something simple', function(done) {
    mysql.getConnection()
      .then(connection => {
        connection.query("SELECT 2", (err, rows) => {
          assert(err === null);
          done();
        });
      })
  })
});