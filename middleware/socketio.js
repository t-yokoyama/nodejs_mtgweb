module.exports = function(app, server) {

  var io = require('socket.io')(server);

  var lobby_io = io.of('/lobby');
  lobby_io.on('connection', function(socket){

    console.log('a client connected.');

    socket.on('user_join', function(user){
      console.log('user joined chat: ' + user);

      // FIXME update server-side list of users

      // FIXME exclude duplicate users

      lobby_io.emit('user_join', user);
      lobby_io.emit('sys_message', 'user ' + user + ' has entered the lobby.');
    });

    socket.on('chat_message', function(data){
      console.log('message: ' + data.msg);
      lobby_io.emit('chat_message', data);
    });

    socket.on('disconnect', function(){
      console.log('a client disconnected.');

      // FIXME message: "#username left the lobby"

      // FIXME update server-side list of users

      // FIXME refresh chat user lists
    });
  });

  var gameplay_io = io.of('/gameplay');
  lobby_io.on('connection', function(socket){
    // FIXME
  });

}