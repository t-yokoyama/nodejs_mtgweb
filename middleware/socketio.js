module.exports = function(app, server) {

  var io = require('socket.io')(server);

  var users = {};
  var userid_hash = {};

  var lobby_io = io.of('/lobby');
  lobby_io.on('connection', function(socket){
    console.log('a client connected.');

    socket.on('user_join', function(data) {
      console.log('user joined chat: ' + data.username);

      // rename user if already in the lobby
      if (userid_hash[data.userid]) {
        lobby_io.emit('sys_message', 'user ' + data.username + ' has connected to the lobby in another window, creating another user instance.');
      	userid_hash[data.userid].num_sockets++;
      	data.username = data.username + '-' + userid_hash[data.userid].num_sockets;
      	data.color = color_array[userid_hash[data.userid].colorid];
      }
      else {
      	var colorid = getNextColor(userid_hash);
        userid_hash[data.userid] = { num_sockets: 1,
        	                         colorid: colorid };
        data.color = color_array[colorid];
        console.log(colorid);
        console.log(data.color);
      }
      socket.emit('user_init', { username: data.username });

      // send list of existing users to client (starting with ourself)
      socket.emit('user_join', data);
      for(var key in users) {
        socket.emit('user_join', users[key]);
      }

      // add client to user list of all other users
      socket.broadcast.emit('user_join', data);

      // update server-side list of users
      users[socket.id] = data;

      lobby_io.emit('sys_message', 'user ' + data.username + ' has entered the lobby.');
    });

    socket.on('chat_message', function(data){
      console.log('message: ' + data.msg);
      lobby_io.emit('chat_message', data);
    });

    socket.on('disconnect', function(){
      console.log('a client disconnected.');

      if (users[socket.id]) {
        socket.broadcast.emit('user_exit', users[socket.id]);
        socket.broadcast.emit('sys_message', 'user ' + users[socket.id].username + ' has left the lobby.');
        var disconnect_userid = users[socket.id].userid;
        delete users[socket.id];

        // check if all instances of this user have disconnected to update the hash
        var match_found = false;
        for (var key in users) {
          if (users[key].userid === disconnect_userid) {
            match_found = true;
            break;
          }
        }
        if (!match_found) {
          delete userid_hash[disconnect_userid];
        }
      }
    });

    // FIXME disconnect from chat when user logs out of site
  });

  var gameplay_io = io.of('/gameplay');
  lobby_io.on('connection', function(socket){
    // FIXME
  });

}

var color_array = ['#ff0000', // red
                   '#0000ff', // blue
                   '#008800', // green
                   '#ccaa00', // marigold
                   '#ff00ff', // purple
                   '#000044', // navy
                   '#ff6600', // orange
                   '#0099cc'  // sky blue 
                  ];

var getNextColor = function (userid_hash) {

  // 'static' counter for incrementing color IDs
  if (typeof getNextColor.counter == 'undefined') {
    getNextColor.counter = 0;
  }

  // if all users have left the lobby, reset the color counter
  if (userid_hash.length === 0) {
    getNextColor.counter = 0; // start at 1, 0 is an error index
    return getNextColor.counter;
  }
  
  // if we are past max capacity, start reusing assigned colors
  if (userid_hash.length >= color_array.length) {
  	return ++getNextColor.counter;
  }

  // there is at least one unused color- find it
  while (true) {
    if (getNextColor.counter >= color_array.length) {
      getNextColor.counter = 0;
    }
    var used = false;
    for (var key in userid_hash) {
      if (userid_hash[key].colorid === getNextColor.counter) {
        used = true;
        break;
      }
    }
    if (used === false) {
      return getNextColor.counter;
    }

    getNextColor.counter++;
  }
  
  return -1; // this should never happen
}

