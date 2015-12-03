var express = require('express');
var pg = require('pg');

var router = express.Router();


/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('dummy', { title: 'MTG Web' });
});


router.get('/gameplay', function(req, res, next) {
  
  var conString = "postgres://postgres:password@localhost/mtgtestdb";
  pg.connect(conString, function(err, client, done) {
    if (err) {
      return console.error('error fetching client from pool', err);
    }
    client.query(
      'SELECT c.imageurl, dl.qty FROM cards c, decks d, decklists dl WHERE d.id = dl.deck_id AND dl.card_id = c.id AND d.id = $1::int',
      ['1'], // deck id
      function(err, result) {
        done();
        if (err) {
          return console.error('error running query', err);
        }
        res.render('gameplay', {decklist: result.rows});
      }
    ); // client.query()
  }); // pg.connect()
}); // router.get()


module.exports = router;
