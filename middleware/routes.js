var db = require('../database/db.js');

module.exports = function(app, passport) {

  /* GET home page. */
  app.get('/', function(req, res) {
    res.render('index');
  });

  /* GET login page. */
  app.get('/login', function(req, res) {
    res.render('login', { loginMessage: req.flash('loginMessage') });
  });

  /* GET signup page. */
  app.get('/signup', function(req, res) {
    res.render('signup', { signupMessage: req.flash('signupMessage') });
  });

  /* GET profile page. */
  app.get('/profile', isLoggedIn, function(req, res) {
    res.render('profile', { user: req.user });
  });

  /* GET lobby page. */
  app.get('/lobby', isLoggedIn, function(req, res) {
    res.render('lobby', { user: req.user });
  });

  /* Handle login POST */
  app.post('/login', passport.authenticate('login', {
    successRedirect: '/lobby',
    failureRedirect: '/login',
    failureFlash : true
  }));

  /* Handle Registration POST */
  app.post('/signup', passport.authenticate('signup', {
    successRedirect: '/lobby',
    failureRedirect: '/signup',
    failureFlash : true
  }));

  /* Handle logout. */
  app.get('/logout', function(req, res) {
    req.logout();
    res.redirect('/');
  });

  // FIXME protect this with authentication
  app.get('/game1v1', function(req, res) {
    res.render('game1v1', { user: req.user });
  });

  // FIXME for testing only
  app.get('/game1v1_test', function(req, res) {
    res.render('game1v1_test');
  });

  // FIXME this is a just a reference
  app.get('/jade_test', function(req, res) {

    db.query(
      'SELECT c.imageurl, dl.qty FROM cards c, decks d, decklists dl WHERE d.id = dl.deck_id AND dl.card_id = c.id AND d.id = $1::int',
      ['1'], // deck id
      function(err, my_result) {
        if (err) {
          return console.error('error running query', err);
        }

        db.query(
          'SELECT c.imageurl, dl.qty FROM cards c, decks d, decklists dl WHERE d.id = dl.deck_id AND dl.card_id = c.id AND d.id = $1::int',
          ['2'], // deck id
          function(err, opp_result) {
            if (err) {
              return console.error('error running query', err);
            }

            res.render('jade_test', {my_decklist: my_result.rows, opp_decklist: opp_result.rows});
          }
        );

      }
    );
  });

}

function isLoggedIn(req, res, next) {

  if (req.isAuthenticated())
    return next();

  res.redirect('/login');
}


