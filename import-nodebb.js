"use strict";
const tasks = require('./app/nodebb-tasks');

tasks.makeUsers((newUsers) => {
  console.log(newUsers);
  tasks.makeCategories((newCategories) => {
    tasks.makeThreads(newUsers, newCategories, (postsMapping) => {
      console.log('result');
      console.log(postsMapping);
      tasks.convertContents(newUsers, postsMapping, () => {
        process.exit();
      });
    });
  });
});
