module.exports = function(app, server) {

  var io = require('socket.io')(server);

  var gameid_counter = 0;
  var users_by_sid = {};        // elements: { userid, username, color }
  var sockids_by_uname = {};
  var dupdata_by_uid = {};      // elements: { num_sockets, colorid }
  var games = {};               // FIXME

  var lobby_io = io.of('/lobby');
  lobby_io.on('connection', function(socket){

    console.log('a client connected.');



    socket.on('user_join', function(data) {
      console.log('user joined chat: ' + data.username);

      // rename user if already in the lobby
      if (dupdata_by_uid[data.userid]) {
        lobby_io.emit('sys_message', 'user ' + data.username + ' has connected to the lobby in another window, creating another user instance.');
      	dupdata_by_uid[data.userid].num_sockets++;
      	data.username = data.username + '-' + dupdata_by_uid[data.userid].num_sockets;
      	data.color = color_array[dupdata_by_uid[data.userid].colorid];
      }
      else {
      	var cid = getNextColor(dupdata_by_uid);
        dupdata_by_uid[data.userid] = { num_sockets: 1,
        	                              colorid: cid };
        data.color = color_array[cid];
      }

      // send list of existing users to client (starting with ourself)
      socket.emit('user_init', data);
      for(var sid in users_by_sid) {
        socket.emit('user_join', users_by_sid[sid]);
      }

      // add client to user list of all other users
      socket.broadcast.emit('user_join', data);

      // update server-side data structures
      users_by_sid[socket.id] = data;
      sockids_by_uname[data.username] = socket.id;

      lobby_io.emit('sys_message', 'user ' + data.username + ' has entered the lobby.');
    });



    socket.on('chat_message', function(data){
      console.log('chat message: ' + data.username + ": " + data.msg);
      lobby_io.emit('chat_message', data);
    });



    socket.on('disconnect', function(){
      console.log('a client disconnected.');

      var disconnect_uid = -1;
      var disconnect_uname = "UNINITIALIZED";
      if (users_by_sid[socket.id]) {
        socket.broadcast.emit('user_exit', users_by_sid[socket.id]);
        socket.broadcast.emit('sys_message', 'user ' + users_by_sid[socket.id].username + ' has left the lobby.');
        disconnect_uid = users_by_sid[socket.id].userid;
        disconnect_uname = users_by_sid[socket.id].username;
        delete users_by_sid[socket.id];
        delete sockids_by_uname[disconnect_uname];

        // check if all instances of this user have disconnected to update the hash
        var match_found = false;
        for (var key in users_by_sid) {
          if (users_by_sid[key].userid === disconnect_uid) {
            match_found = true;
            break;
          }
        }
        if (!match_found) {
          delete dupdata_by_uid[disconnect_uid];
        }
      }

      // FIXME think about whether we want to allow games sessions to persist after their players have disconnected from lobby
      // FIXME if we do, we need to add checks in all the state machine logic to check and allow for socket ids not being found in server data structures
      for (var gid in games) {
        var survivor_sid = -1;
        if (socket.id == games[gid].sender_sid) {
          survivor_sid = games[gid].recipient_sid;
        }
        else if (socket.id == games[gid].recipient_sid) {
          survivor_sid = games[gid].sender_sid;
        }
        if (survivor_sid != -1) {
          lobby_io.connected[survivor_sid].emit('sys_message', 'automatically canceling game with user ' + disconnect_uname + ' due to user disconnect.');
          lobby_io.connected[survivor_sid].emit('game_canceled', { gameid: gid });
          delete games[gid];
          console.log('automatically canceling game (' + gid + ').');
        }
      }
    });



    socket.on('initiate_game', function(data) {

      // we have to generate the game id server-side to ensure global uniqueness
      var gid = gameid_counter++;

      console.log('an initiate_game request was made (' + gid + ').');

      // FIXME add error checks for failing to find in arrays?

      var sender_username = users_by_sid[socket.id].username;
      var recipient_sid = sockids_by_uname[data.recipient_username];
      var r_socket = lobby_io.connected[recipient_sid];

      // FIXME should this be broadcast to everyone?
      socket.emit('sys_message', 'you have challenged user ' + data.recipient_username + ' to a game.');
      r_socket.emit('sys_message', 'user ' + sender_username + ' has challenged you to a game.');

      socket.emit('game_sent', { gameid: gid });
      r_socket.emit('game_received', { gameid: gid });

      games[gid] = { sender_sid: socket.id,
                     recipient_sid: recipient_sid,
                     sender_state: 'game_sent',
                     recipient_state: 'game_received' };
                     
      // FIXME check for existing games between the two users and disallow multiple?
    });



    socket.on('cancel_game', function(data) {
      console.log('game canceled (' + data.gameid + ').');
      
      if (games[data.gameid]) {

        // determine which side sent the cancel request to construct the proper system messages        
        var sid1;
        var sid2;
        if (socket.id == games[data.gameid].sender_sid) {
          sid1 = games[data.gameid].sender_sid
          sid2 = games[data.gameid].recipient_sid
        }
        else {
          sid1 = games[data.gameid].recipient_sid
          sid2 = games[data.gameid].sender_sid
        }
        var uname1 = users_by_sid[sid1].username;
        var uname2 = users_by_sid[sid2].username;
        var socket1 = lobby_io.connected[sid1];
        var socket2 = lobby_io.connected[sid2];

        // FIXME should this be broadcast to everyone?
        socket1.emit('sys_message', 'you have canceled your game with user ' + uname1 + '.');
        socket2.emit('sys_message', 'user ' + uname2 + ' has canceled their game with you.');

        socket1.emit('game_canceled', { gameid: data.gameid });
        socket2.emit('game_canceled', { gameid: data.gameid });
        
        delete games[data.gameid];
      }
    });



    socket.on('decline_game', function(data) {
      console.log('game declined (' + data.gameid + ').');

      if (games[data.gameid]) {
        var sender_sid = games[data.gameid].sender_sid
        var s_socket = lobby_io.connected[sender_sid];
        var sender_uname = users_by_sid[sender_sid].username;
        var recipient_uname = users_by_sid[socket.id].username;

        // FIXME should this be broadcast to everyone?
        socket.emit('sys_message', 'you have declined user ' + sender_uname + '\'s challenge.');
        s_socket.emit('sys_message', 'user ' + recipient_uname + ' has declined your challenge.');

        socket.emit('game_canceled', { gameid: data.gameid });
        s_socket.emit('game_canceled', { gameid: data.gameid });
        
        delete games[data.gameid];
      }
    });



    socket.on('accept_game', function(data) {
      console.log('game accepted (' + data.gameid + ').');
      
      // FIXME check against multiple duplicate requests (user may rapidclick)
    });



    // FIXME disconnect all user instances from chat when user logs out of site
  });



  var gameplay_io = io.of('/gameplay');
  gameplay_io.on('connection', function(socket){
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

var getNextColor = function (used_colors) {

  // 'static' counter for incrementing color IDs
  if (typeof getNextColor.counter == 'undefined') {
    getNextColor.counter = 0;
  }

  // if all users have left the lobby, reset the color counter
  if (used_colors.length === 0) {
    getNextColor.counter = 0; // start at 1, 0 is an error index
    return getNextColor.counter;
  }
  
  // if we are past max capacity, start reusing assigned colors
  if (used_colors.length >= color_array.length) {
  	return ++getNextColor.counter;
  }

  // there is at least one unused color- find it
  while (true) {
    if (getNextColor.counter >= color_array.length) {
      getNextColor.counter = 0;
    }
    var used = false;
    for (var key in used_colors) {
      if (used_colors[key].colorid === getNextColor.counter) {
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

