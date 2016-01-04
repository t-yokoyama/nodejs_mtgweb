module.exports = function(app, server) {

  var io = require('socket.io')(server);

  var lobby_io = io.of('/lobby');
  lobby_io.on('connection', function(socket){

    console.log('a user connected.');

    socket.on('chat message', function(msg){
      console.log('message: ' + msg);
      lobby_io.emit('chat message', msg);
    });

    socket.on('disconnect', function(){
      console.log('a user disconnected.');
    });
  });

  var gameplay_io = io.of('/gameplay');
  lobby_io.on('connection', function(socket){
    // FIXME
  });

}