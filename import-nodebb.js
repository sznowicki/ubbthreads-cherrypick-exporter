"use strict";
const tasks = require('./app/nodebb-tasks');

tasks.makeUsers((newUsers) => {
  console.log(newUsers);
  tasks.makeCategories((newCategories) => {
    console.log(newUsers);
    console.log(newCategories);
    tasks.makeThreads(newUsers, newCategories, () => {
      process.exit();
    });
  });
});
