var expressSession = require('express-session');
var flash = require('connect-flash');
var LocalStrategy = require('passport-local').Strategy;
var db = require('../database/db.js');
var bcrypt = require('bcrypt-nodejs');

var isValidPassword = function(passwordHash, password) {
  return bcrypt.compareSync(password, passwordHash);
}

var createHash = function(password) {
  return bcrypt.hashSync(password, bcrypt.genSaltSync(10), null);
}

module.exports = function(app, passport) {

  app.use(expressSession({secret: 'mySecretKey'})); // FIXME
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(flash());

  passport.serializeUser(function(user, done) {
    done(null, user);
  });

  passport.deserializeUser(function(user, done) {
    done(null, user);
  });

  passport.use('login', new LocalStrategy({
      usernameField: 'username',
      passwordField: 'password',
      passReqToCallback : true
    },
    function(req, username, password, done) {
      console.log('searching database for user (login)');

      db.query(
        'SELECT * FROM users u WHERE u.username = $1::text',
        [username],
        function(err, result) {
          if (err) {
            return console.error('error running query', err);
          }

          if (result.rows.length < 1) {
            console.log('user not found with username ' + username);
            return done(null, false,
                        req.flash('loginMessage', 'User not found'));
          }

          if (!isValidPassword(result.rows[0].password, password)) {
            console.log('invalid password');
            return done(null, false,
                        req.flash('loginMessage', 'Invalid password'));
          }

          console.log('login success');
          var user = { id: result.rows[0].id,
                       username: username,
                       password: result.rows[0].password,
                       email: result.rows[0].email }
          return done(null, user);
        }
      );
    }
  ));

  passport.use('signup', new LocalStrategy({
      usernameField: 'username',
      passwordField: 'password',
      passReqToCallback : true
    },
    function(req, username, password, done) {

      findOrCreateUser = function() {
        console.log('searching database for user (signup)');

        db.query(
          'SELECT u.password FROM users u WHERE u.username = $1::text',
          [username],
          function(err, result) {
            if (err) {
              return console.error('error running query', err);
            }

            if (result.rows.length > 0) {
              console.log('user already exists: ' + username);
              return done(null, false,
                          req.flash('signupMessage', 'User already exists'));
            }

            var passwordHash = createHash(password);
            var email = req.body.email;
            db.query(
              'INSERT INTO users (username, password, email) VALUES ($1::text, $2::text, $3::text) RETURNING id',
              [username, passwordHash, email],
              function(err, result) {
                if (err) {
                  return console.error('error running query', err);
                }

                console.log('user registration successful');
                var user = { id: result.rows[0].id,
                             username: username,
                             password: passwordHash,
                             email: email }
                return done(null, user);
              }
            );

          }
        );

      };

      // delay execution of findOrCreateUser()
      process.nextTick(findOrCreateUser);
  }));

}
