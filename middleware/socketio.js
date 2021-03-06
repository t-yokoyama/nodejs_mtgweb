var db = require('../database/db.js');

module.exports = function(app, server) {

  var io = require('socket.io')(server);

  // this must be kept in sync with the client-side definition
  var ZoneEnum = {
    BATTLEFIELD : 1,
    HAND : 2,
    LIBRARY : 3,
    GRAVEYARD : 4,
    EXILE : 5
  };
  
  // FIXME prefix these with g_
  var gameid_counter = 1000;
  var users_by_sid = {};        // elements: { userid, username, color }
  var sockids_by_uname = {};
  var dupdata_by_uid = {};      // elements: { num_sockets, colorid }
  var games = {};               // FIXME

  var lobby_io = io.of('/lobby');
  lobby_io.on('connection', function(socket){

    console.log('a client connected to the lobby.');



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
      console.log('a client disconnected from the lobby.');

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
        if (socket.id == games[gid].sender_lobby_sid) {
          survivor_sid = games[gid].recipient_lobby_sid;
        }
        else if (socket.id == games[gid].recipient_lobby_sid) {
          survivor_sid = games[gid].sender_lobby_sid;
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
      var recipient_lobby_sid = sockids_by_uname[data.recipient_username];
      var r_socket = lobby_io.connected[recipient_lobby_sid];

      // FIXME should this be broadcast to everyone?
      socket.emit('sys_message', 'you have challenged user ' + data.recipient_username + ' to a game.');
      r_socket.emit('sys_message', 'user ' + sender_username + ' has challenged you to a game.');

      socket.emit('game_sent', { gameid: gid });
      r_socket.emit('game_received', { gameid: gid });

      var sender_uid = users_by_sid[socket.id].userid;
      var recipient_uid = users_by_sid[recipient_lobby_sid].userid;

      games[gid] = { sender_uid: sender_uid,
                     sender_lobby_sid: socket.id,
                     sender_did: -1,
                     sender_state: 'CHALLENGE_SENT',
                     sender_game_sid: -1,
                     recipient_uid: recipient_uid,
                     recipient_lobby_sid: recipient_lobby_sid,
                     recipient_did: -1,
                     recipient_state: 'CHALLENGE_RECEIVED',
                     recipient_game_sid: -1,
                     gamestate: { turn_player: 0,
                                  turn_phase: 0,
                                  life: [20, 20],
                                  poison: [0, 0],
                                  cards: [],
                                  zones: [ { hand: [], library: [], graveyard: [], exile: [] } ,
                                           { hand: [], library: [], graveyard: [], exile: [] } ] } };


      // FIXME check for existing games between the two users and disallow multiple?
      // FIXME add sideboard-pregame option checkbox
    });



    socket.on('cancel_game', function(data) {
      console.log('game canceled (' + data.gameid + ').');
      
      if (games[data.gameid]) {

        // determine which side sent the cancel request to construct the proper system messages        
        var sid1;
        var sid2;
        if (socket.id == games[data.gameid].sender_lobby_sid) {
          sid1 = games[data.gameid].sender_lobby_sid;
          sid2 = games[data.gameid].recipient_lobby_sid;
        }
        else {
          sid1 = games[data.gameid].recipient_lobby_sid;
          sid2 = games[data.gameid].sender_lobby_sid;
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
      else {
        
        // this will let a user locally close a session if they get disconnected from the server
        // then reconnected- their game would have been removed from the games array
        socket.emit('game_canceled', { gameid: data.gameid });
      }
    });



    socket.on('decline_game', function(data) {
      console.log('game declined (' + data.gameid + ').');

      if (games[data.gameid]) {
        var sender_lobby_sid = games[data.gameid].sender_lobby_sid;
        var s_socket = lobby_io.connected[sender_lobby_sid];
        var sender_uname = users_by_sid[sender_lobby_sid].username;
        var recipient_uname = users_by_sid[socket.id].username;

        // FIXME should this be broadcast to everyone?
        socket.emit('sys_message', 'you have declined user ' + sender_uname + '\'s challenge.');
        s_socket.emit('sys_message', 'user ' + recipient_uname + ' has declined your challenge.');

        socket.emit('game_canceled', { gameid: data.gameid });
        s_socket.emit('game_canceled', { gameid: data.gameid });
        
        delete games[data.gameid];
      }
      else {
        
        // analogous to the 'cancel_game' socket message
        socket.emit('game_canceled', { gameid: data.gameid });
      }
    });



    socket.on('accept_game', function(data) {
      console.log('game accepted (' + data.gameid + ').');
      
      if (games[data.gameid]) {
        var sender_lobby_sid = games[data.gameid].sender_lobby_sid;
        var s_socket = lobby_io.connected[sender_lobby_sid];
        var sender_uname = users_by_sid[sender_lobby_sid].username;
        var recipient_uname = users_by_sid[socket.id].username;

        games[data.gameid].sender_state = 'CONFIGURING_GAME';
        games[data.gameid].recipient_state = 'CONFIGURING_GAME';

        // FIXME should this be broadcast to everyone?
        socket.emit('sys_message', 'you have accepted user ' + sender_uname + '\'s challenge.');
        s_socket.emit('sys_message', 'user ' + recipient_uname + ' has accepted your challenge.');

        db.query(
          'SELECT d.id, d.deckname FROM decks d WHERE d.user_id = $1::int',
          [users_by_sid[socket.id].userid],
          function(err, result) {
            if (err) {
              return console.error('error running query', err);
            }
            socket.emit('game_accepted', { gameid: data.gameid,
                                           decks: result.rows });
          }
        );

        db.query(
          'SELECT d.id, d.deckname FROM decks d WHERE d.user_id = $1::int',
          [users_by_sid[sender_lobby_sid].userid],
          function(err, result) {
            if (err) {
              return console.error('error running query', err);
            }
            s_socket.emit('game_accepted', { gameid: data.gameid,
                                             decks: result.rows });
          }
        );
      }
      
      // FIXME check against multiple duplicate requests (user may rapidclick)
    });
    
    

    socket.on('configure_game', function(data) {
      console.log('game configured (' + data.gameid + ').');

      if (games[data.gameid]) {
        
        var sender_lobby_sid = games[data.gameid].sender_lobby_sid;
        var recipient_lobby_sid = games[data.gameid].recipient_lobby_sid;
        var sender_uname = users_by_sid[sender_lobby_sid].username;
        var recipient_uname = users_by_sid[recipient_lobby_sid].username;

        if (socket.id == sender_lobby_sid) {
          games[data.gameid].sender_did = data.deckid;
          games[data.gameid].sender_state = 'CONFIGURED';
          socket.emit('sys_message', 'you are ready for your game with user ' + recipient_uname + '.');
          lobby_io.connected[recipient_lobby_sid].emit('sys_message', 'user ' + sender_uname + ' is ready for your game.');
        }
        else {
          games[data.gameid].recipient_did = data.deckid;
          games[data.gameid].recipient_state = 'CONFIGURED';
          socket.emit('sys_message', 'you are ready for your game with user ' + sender_uname + '.');
          lobby_io.connected[sender_lobby_sid].emit('sys_message', 'user ' + recipient_uname + ' is ready for your game.');
        }
        
        // this will disable further deck selection on the client side
        socket.emit('game_configured', { gameid: data.gameid });
        
        if (games[data.gameid].sender_state == 'CONFIGURED' &
            games[data.gameid].recipient_state == 'CONFIGURED') {

          db.query(
            'SELECT c.imageurl, c.imageurl2, c.layout, dl.qty FROM cards c, decks d, decklists dl WHERE d.id = dl.deck_id AND dl.card_id = c.id AND d.id = $1::int',
            [games[data.gameid].sender_did],
            function(err, result1) {
              if (err) {
                return console.error('error running query', err);
              }
              var cid = 0;
              for(var i = 0; i < result1.rows.length; i++) {
                for(var j = 0; j < result1.rows[i].qty; j++) {
                  games[data.gameid].gamestate.cards[cid] = { imageurl: result1.rows[i].imageurl,
                                                              imageurl2: result1.rows[i].imageurl2,
                                                              frametype: result1.rows[i].layout,
                                                              x: 0,
                                                              y: 0,
                                                              faceDown: false,
                                                              tapped: false,
                                                              flipped: false,
                                                              transformed: false,
                                                              counters: 0,
                                                              owner: 0
                                                            };
                  games[data.gameid].gamestate.zones[0].library.push(cid);
                  cid++;
                }
              }

              db.query(
                'SELECT c.imageurl, c.imageurl2, c.layout, dl.qty FROM cards c, decks d, decklists dl WHERE d.id = dl.deck_id AND dl.card_id = c.id AND d.id = $1::int',
                [games[data.gameid].recipient_did],
                function(err, result2) {
                  if (err) {
                    return console.error('error running query', err);
                  }
                  for(var i = 0; i < result2.rows.length; i++) {
                    for(var j = 0; j < result2.rows[i].qty; j++) {
                      games[data.gameid].gamestate.cards[cid] = { imageurl: result2.rows[i].imageurl, 
                                                                  imageurl2: result2.rows[i].imageurl2,
                                                                  frametype: result2.rows[i].layout,
                                                                  x: 0,
                                                                  y: 0,
                                                                  faceDown: false,
                                                                  tapped: false,
                                                                  flipped: false,
                                                                  transformed: false,
                                                                  counters: 0,
                                                                  owner: 1
                                                                };
                      games[data.gameid].gamestate.zones[1].library.push(cid);
                      cid++;
                    }
                  }

                  // both decks have been loaded now, so give the OK to both players to enter the room
                  games[data.gameid].sender_state = 'ROOM_OPENED';
                  games[data.gameid].recipient_state = 'ROOM_OPENED';

                  // FIXME consider using the gameid as a seed to produce a longer ascii guid for the room name
                  console.log('both players ready.');
                  lobby_io.connected[sender_lobby_sid].emit('open_room', { gameid: data.gameid } );
                  lobby_io.connected[recipient_lobby_sid].emit('open_room', { gameid: data.gameid } );

                }
              ); // recipient deck db query
            }
          ); // sender deck db query
        }
      }
    });


    // FIXME disconnect all user instances from chat when user logs out of site
  });



  // FIXME remove this from the release version
  initialize_test_game(games);



  var game1v1_io = io.of('/game1v1');
  game1v1_io.on('connection', function(socket){

    console.log('a client connected to a 1v1 game.');



    socket.on('join_room', function(data) {
      console.log('a user joined room ' + data.roomid);

      socket.room = data.roomid;
      socket.join(data.roomid);

      var role_index = -1;
      var opp_username;
      if (data.userid === games[data.roomid].sender_uid) {
        if (games[data.roomid].sender_game_sid != -1 & socket.id != games[data.roomid].sender_game_sid) {
          console.log('transferring game control to a new client and disconnecting the old one.');
          var old_session = game1v1_io.connected[games[data.roomid].sender_game_sid];
          if (old_session !== undefined) {
            old_session.emit('duplicate_user_connect');
          }
        }
        games[data.roomid].sender_game_sid = socket.id;
        role_index = 0;
        var recipient_lobby_sid = games[data.roomid].recipient_lobby_sid;
        opp_username = users_by_sid[recipient_lobby_sid].username;
      }
      else if (data.userid === games[data.roomid].recipient_uid) {
        if (games[data.roomid].recipient_game_sid != -1 & socket.id != games[data.roomid].recipient_game_sid) {
          console.log('transferring game control to a new client and disconnecting the old one.');
          var old_session = game1v1_io.connected[games[data.roomid].recipient_game_sid];
          if (old_session !== undefined) {
            old_session.emit('duplicate_user_connect');
          }
        }
        games[data.roomid].recipient_game_sid = socket.id;
        role_index = 1;
        var sender_lobby_sid = games[data.roomid].sender_lobby_sid;
        opp_username = users_by_sid[sender_lobby_sid].username;
      }
      
      // FIXME disconnect any other sockets with the same uid to prevent multiple sockets controlling the state of a player


      socket.emit('initialize_gamestate', { gamestate: games[data.roomid].gamestate,
                                            role: role_index,
                                            opponent: opp_username });
    });


    socket.on('chat_message', function(data){
      console.log('game chat message: ' + data.msg);
      socket.broadcast.emit('chat_message', data);
    });


    socket.on('card_moved', function(data) {

      if (socket.room === undefined) {
        console.log('card_moved event received on a socket with undefined roomid.');
        return;
      }

      var role_index = -1;
      if (socket.id === games[socket.room].sender_game_sid) {
        role_index = 0;
      }
      else if (socket.id === games[socket.room].recipient_game_sid) {
        role_index = 1;
      }
      if (role_index === -1) {
        console.log('card_moved event received on a socket with invalid userid.');
        return;
      }

      // switch on from/to zones and remove/add cids
      
      // this behaves like a pointer, modifying zone_array modify the original array object
      var zone_array = undefined;
      switch(data.fromZone) {

        case ZoneEnum.HAND:
          zone_array = games[socket.room].gamestate.zones[role_index].hand;
          break;

        case ZoneEnum.LIBRARY:
          zone_array = games[socket.room].gamestate.zones[role_index].library;
          break;

        case ZoneEnum.GRAVEYARD:
          zone_array = games[socket.room].gamestate.zones[role_index].graveyard;
          break;

        case ZoneEnum.EXILE:
          zone_array = games[socket.room].gamestate.zones[role_index].exile;
          break;
      }
      
      if (zone_array != undefined ) {

        var index = zone_array.indexOf(data.cid);
        if (index === -1) {
          console.log('received an invalid card_moved event.');
          return;
        }
        else
        {
          // remove the element from the array
          zone_array.splice(index, 1);
        }
      }

      switch(data.toZone) {

        case ZoneEnum.HAND:
          games[socket.room].gamestate.zones[role_index].hand.push(data.cid);
          break;

        case ZoneEnum.LIBRARY:
          games[socket.room].gamestate.zones[role_index].library.push(data.cid);
          break;

        case ZoneEnum.GRAVEYARD:
          games[socket.room].gamestate.zones[role_index].graveyard.push(data.cid);
          break;

        case ZoneEnum.EXILE:
          games[socket.room].gamestate.zones[role_index].exile.push(data.cid);
          break;
      }

      var card = games[socket.room].gamestate.cards[data.cid];
      if (data.toZone == ZoneEnum.BATTLEFIELD) {
        card.x = data.x;
        card.y = data.y;
      }
      else {
        card.tapped = false;
        card.flipped = false;
        card.transformed = false;
        card.counters = 0;
      }
      if (data.toZone == ZoneEnum.BATTLEFIELD || data.toZone == ZoneEnum.EXILE) {
        card.faceDown = data.faceDown;
      }
      else {
        card.faceDown = false;
      }

      // FIXME if after testing it turns out this function never fails, move this emit call to the top of the function to reduce latency
      // pass along the message to the other client(s)
      socket.broadcast.emit('card_moved', data);

      console.log('card ' + data.cid + ' was moved: (' + data.fromZone + ' to ' + data.toZone + ').');

    });


    socket.on('card_changed', function(data) {

      if (socket.room === undefined) {
        console.log('card_changed event received on a socket with undefined roomid.');
        return;
      }

      var card = games[socket.room].gamestate.cards[data.cid];
      card.faceDown = data.faceDown;
      card.tapped = data.tapped;
      card.flipped = data.flipped;
      card.transformed = data.transformed;
      card.counters = data.counters;

      socket.broadcast.emit('card_changed', data);

      console.log('card ' + data.cid + '\'s state was changed.');
    });

    socket.on('advance_phase', function(data) {

      if (socket.room === undefined) {
        console.log('advance_phase event received on a socket with undefined roomid.');
        return;
      }

      if (++games[socket.room].gamestate.turn_phase === 7) {
        games[socket.room].gamestate.turn_phase = 0;
        if (games[socket.room].gamestate.turn_player === 0)
          games[socket.room].gamestate.turn_player = 1;
        else games[socket.room].gamestate.turn_player = 0;
      }
      
      socket.broadcast.emit('advance_phase', data);

      console.log('turn phase was advanced.');
    });
    
    socket.on('life_changed', function(data) {

      if (socket.room === undefined) {
        console.log('life_changed event received on a socket with undefined roomid.');
        return;
      }

      var role_index = -1;
      if (socket.id === games[socket.room].sender_game_sid) {
        role_index = 0;
      }
      else if (socket.id === games[socket.room].recipient_game_sid) {
        role_index = 1;
      }
      if (role_index === -1) {
        console.log('life_changed event received on a socket with invalid userid.');
        return;
      }

      games[socket.room].gamestate.life[role_index] = data.val;

      socket.broadcast.emit('life_changed', data);

      console.log('a player\'s life total was changed to ' + data.val + '.');
    });


    socket.on('poison_changed', function(data) {

      if (socket.room === undefined) {
        console.log('poison_changed event received on a socket with undefined roomid.');
        return;
      }

      var role_index = -1;
      if (socket.id === games[socket.room].sender_game_sid) {
        role_index = 0;
      }
      else if (socket.id === games[socket.room].recipient_game_sid) {
        role_index = 1;
      }
      if (role_index === -1) {
        console.log('poison_changed event received on a socket with invalid userid.');
        return;
      }

      games[socket.room].gamestate.poison[role_index] = data.val;

      socket.broadcast.emit('poison_changed', data);

      console.log('a player\'s poison count was changed to ' + data.val + '.');
    });


    socket.on('disconnect', function(){
      console.log('a client disconnected from a 1v1 game.');

      socket.leave(socket.room);
    });

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



// FIXME remove this from the release version
var initialize_test_game = function (games) {

  games[0] = { sender_uid: 1,
               sender_lobby_sid: -1,
               sender_did: -1,
               sender_state: 'ROOM_OPENED',
               sender_game_sid: -1,
               recipient_uid: -1,
               recipient_lobby_sid: -1,
               recipient_did: -1,
               recipient_state: 'ROOM_OPENED',
               recipient_game_sid: -1,
               gamestate: { turn_player: 0,
                            turn_phase: 0,
                            life: [20, 20],
                            poison: [0, 0],
                            cards: [],
                            zones: [ { hand: [], library: [], graveyard: [], exile: [] } ,
                                     { hand: [], library: [], graveyard: [], exile: [] } ] } };

  db.query(
    'SELECT c.imageurl, c.imageurl2, c.layout, dl.qty FROM cards c, decks d, decklists dl WHERE d.id = dl.deck_id AND dl.card_id = c.id AND d.id = $1::int',
    [2],
    function(err, result1) {
      if (err) {
        return console.error('error running query', err);
      }
      var cid = 0;
      for(var i = 0; i < result1.rows.length; i++) {
        for(var j = 0; j < result1.rows[i].qty; j++) {
          games[0].gamestate.cards[cid] = { imageurl: result1.rows[i].imageurl,
                                            imageurl2: result1.rows[i].imageurl2,
                                            frametype: result1.rows[i].layout,
                                            x: 0,
                                            y: 0,
                                            faceDown: false,
                                            tapped: false,
                                            flipped: false,
                                            transformed: false,
                                            counters: 0,
                                            owner: 0
                                          };
          games[0].gamestate.zones[0].library.push(cid);
          cid++;
        }
      }

      db.query(
        'SELECT c.imageurl, c.imageurl2, c.layout, dl.qty FROM cards c, decks d, decklists dl WHERE d.id = dl.deck_id AND dl.card_id = c.id AND d.id = $1::int',
        [1],
        function(err, result2) {
          if (err) {
            return console.error('error running query', err);
          }
          for(var i = 0; i < result2.rows.length; i++) {
            for(var j = 0; j < result2.rows[i].qty; j++) {
              games[0].gamestate.cards[cid] = { imageurl: result2.rows[i].imageurl, 
                                                imageurl2: result2.rows[i].imageurl2,
                                                frametype: result2.rows[i].layout,
                                                x: 0,
                                                y: 0,
                                                faceDown: false,
                                                tapped: false,
                                                flipped: false,
                                                transformed: false,
                                                counters: 0,
                                                owner: 1
                                              };
              games[0].gamestate.zones[1].library.push(cid);
              cid++;
            }
          }
        }
      ); // recipient deck db query
    }
  ); // sender deck db query

}
