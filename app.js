var express = require('express');
var app = express();
var server = require('http').Server(app);

// app configuration

var path = require('path');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// middleware modules

var passport = require('passport');
var login = require('./middleware/login-session.js');
var routes = require('./middleware/routes.js');
var socketio = require('./middleware/socketio.js');

login(app, passport);
routes(app, passport);
socketio(app, server);


// this needs to be server.listen and not app.listen for socket.io
server.listen(process.env.PORT || 3000, process.env.IP || "0.0.0.0", function(){
  var addr = server.address();
  console.log("Server listening at", addr.address + ":" + addr.port);
});


module.exports = app;
