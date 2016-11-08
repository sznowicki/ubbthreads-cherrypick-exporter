
const chai = require('chai');
const should = chai.should();
const AllDbs = require('../../../app/db/all-dbs');
const Pid2bbpid = require('../../../app/nodebb/models/pid2bbpid');

describe("Pid2bbpid", function() {
  it('should give bbpid', function(done) {
    AllDbs.getAllDbs()
      .then(dbs => {
        pid2bbpid = new Pid2bbpid(dbs.mongo);
        pid2bbpid.getbbPid(611212)
          .then(bbpid => {
            (bbpid).should.be.a('number');
            done();
          })
          .catch(err => {
            throw err;
          })
      })
      .catch(err => {
        throw err;
      })
  });
  it('should give bbpid even with number as string', function(done) {
    AllDbs.getAllDbs()
      .then(dbs => {
        pid2bbpid = new Pid2bbpid(dbs.mongo);
        pid2bbpid.getbbPid('' + 611212)
          .then(bbpid => {
            (bbpid).should.be.a('number');
            done();
          })
          .catch(err => {
            throw err;
          })
      })
      .catch(err => {
        throw err;
      })
  });
});