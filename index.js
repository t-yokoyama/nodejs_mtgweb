var express = require('express')
var app = express();
var http_server = require('http').Server(app);
var server_io = require('socket.io')(http_server);
var pg = require('pg');

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

