"use strict";
const tasks = require('./app/tasks');

console.log('makeForums starting');

tasks.makeForums((forums) => {
  console.log('make forums done');
  tasks.makeForumsTopics(forums, (exportedPostIds) => {
    tasks.makeUsers(exportedPostIds, () => {
      tasks.makeAttachments(exportedPostIds, () => {
        console.log('All done. Exiting.');
        process.exit();
      });
    });
  });
});



