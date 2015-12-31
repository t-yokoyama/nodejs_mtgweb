var express = require('express');
var db = require('../database/db.js');

var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('dummy', { title: 'MTG Web' });
});

router.get('/gameplay', function(req, res, next) {

  db.query(
    'SELECT c.imageurl, dl.qty FROM cards c, decks d, decklists dl WHERE d.id = dl.deck_id AND dl.card_id = c.id AND d.id = $1::int',
    ['1'], // deck id
    function(err, result) {
      if (err) {
        return console.error('error running query', err);
      }
      res.render('gameplay', {decklist: result.rows});
    });
});

module.exports = router;
