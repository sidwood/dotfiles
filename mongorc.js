/* global db:true */
'use strict';

/**
 * A customisation of the mongo shell prompt.
 */
var prompt = function() {
  if (typeof db === 'undefined') {
    return '(nodb)> ';
  }

  // Check the last db operation
  try {
    db.runCommand({ getLastError: 1 });
  }
  catch (e) {
    print(e);
  }

  return db + '> ';
};
