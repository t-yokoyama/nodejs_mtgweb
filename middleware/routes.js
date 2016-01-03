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

  /* Handle login POST */
  app.post('/login', passport.authenticate('login', {
    successRedirect: '/profile',
    failureRedirect: '/login',
    failureFlash : true
  }));

  /* Handle Registration POST */
  app.post('/signup', passport.authenticate('signup', {
    successRedirect: '/profile',
    failureRedirect: '/signup',
    failureFlash : true
  }));

  /* Handle logout. */
  app.get('/logout', function(req, res) {
    req.logout();
    res.redirect('/');
  });

  // FIXME protect this with authentication
  app.get('/gameplay', function(req, res) {
    db.query(
      'SELECT c.imageurl, dl.qty FROM cards c, decks d, decklists dl WHERE d.id = dl.deck_id AND dl.card_id = c.id AND d.id = $1::int',
      ['1'], // deck id
      function(err, result) {
        if (err) {
          return console.error('error running query', err);
        }
        res.render('gameplay', {decklist: result.rows});
      }
    );
  });

}

function isLoggedIn(req, res, next) {

  if (req.isAuthenticated())
    return next();

  res.redirect('/login');
}


