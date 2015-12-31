var pg = require('pg');

var conString = "postgres://postgres:password@localhost/mtgtestdb";

var query = function(text, values, cb) {
  pg.connect(conString, function(err, client, done) {
    client.query(text, values, function(err, result) {
      done();
      cb(err, result);
    })
  });
}

module.exports.query = query;
