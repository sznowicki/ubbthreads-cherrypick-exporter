"use strict";
const tasks = require('./app/nodebb-tasks');
console.log('hello');
tasks.makeUsers((newUsers) => {
  console.log('Users done');
  tasks.makeCategories(() => {
    console.log('Categories done');
    tasks.makeThreads(() => {
      console.log('Threads done');
      tasks.convertContents(() => {
        console.log('All done!');
        process.exit();
      });
    });
  });
});
