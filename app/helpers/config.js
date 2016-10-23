const fs = require('fs');
const _ = require('lodash');
const path = require('app-root-path');
const configFileLocation = path.resolve('./config.json');
const parsedConfig = JSON.parse(fs.readFileSync(configFileLocation, 'UTF-8'));

module.exports = {
  getSetting: function(key) {
    const value = _.get(parsedConfig, key);
    if (typeof value === 'undefined') {
      throw new Error(`Undefined setting value for: ${key}`);
    }

    return value;
  }
};