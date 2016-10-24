"use strict";
const tasks = require('./app/nodebb-tasks');

tasks.makeUsers((newUsers) => {
  console.log(newUsers);
  process.exit();
  tasks.makeCategories((newCategories) => {
    console.log(newUsers);
    console.log(newCategories);

      process.exit();
  });
});
