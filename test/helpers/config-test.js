const chai = require('chai');
const should = chai.should();
const config = require('../../app/helpers/config');

describe('Mysql config test', function() {
  it('Should give all required properties for mysql', function() {
    const keyToCheck = [
      'host',
      'dbname',
      'username',
      'password',
      'prefix'
    ];
    keyToCheck.forEach(val => {
      config.getSetting(`mysql.${val}`).should.be.a('string');
    });
  });
});