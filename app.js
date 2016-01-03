var express = require('express');
var app = express();

var path = require('path');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

var passport = require('passport');
var login = require('./middleware/login-session.js');
var routes = require('./middleware/routes.js');

login(app, passport);
routes(app, passport);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});

module.exports = app;


// this is some scaffolding to get socket.io to work
/*
var express = require('express')
var app = express();
var http_server = require('http').Server(app);
var server_io = require('socket.io')(http_server);

app.use(express.static('public'));

app.get('/', function(req, res){
  res.sendFile(__dirname + '/game.html');
});

server_io.on('connection', function(socket){

  console.log('a user connected.');

  socket.on('chat message', function(msg){
    console.log('message: ' + msg);
    server_io.emit('chat message', msg);
  });

  socket.on('disconnect', function(){
  	console.log('a user disconnected.');
  });
});

http_server.listen(3000, function(){
  console.log('listening on localhost:3000...');
});

*/