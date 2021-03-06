
function initGlobals() {

  // global variables
  window.ZoneEnum = {
    BATTLEFIELD : 1,
    HAND : 2,
    LIBRARY : 3,
    GRAVEYARD : 4,
    EXILE : 5
  };
  
  window.MessageEnum = {
    ME: 1,
    OPPONENT: 2,
    SYSTEM: 3
  };
  
  window.ZTOP = 100000000;
  window.ZWIDTH = 10000;

  window.g_opponent_name = "unknown";
  window.g_turn_player = false;
  window.g_turn_phase = 0;
  window.g_life = 0;
  window.g_life_opp = 0;
  window.g_poison = 0;
  window.g_poison_opp = 0;

  window.g_directory = [];
  window.g_library = [ [], [] ];
  window.g_graveyard = [ [], [] ];
  window.g_exile = [ [], [] ];
  window.g_hand = [ [], [] ];

  window.g_shiftHeld = false;
  window.g_rcmenuActive = false;
  window.g_rcCardId = -1;
}


function setClientIOCallbacks() {

  g_client_io.on('duplicate_user_connect', function() {
    alert('You have entered the room in a separate window, disconnecting this instance.');
    
    // FIXME test to make sure this actually severs the socket connection
    g_client_io.disconnect();
  });

  g_client_io.on('initialize_gamestate', function(data) {
    
    g_opponent_name = data.opponent;

    // iterate over all the cards in the gamestate array, assigning card ownership based on data.role
    for (var i = 0; i < data.gamestate.cards.length; i++) {
      var card = data.gamestate.cards[i];
      var is_owner = (data.role === card.owner);
      generateCard(is_owner, card.imageurl, card.imageurl2, card.frametype, card.x, card.y, card.faceDown, card.tapped, card.flipped, card.transformed, card.counters);
    }

    // move each player's cards to various zones depending on the zone array contents
    for (var playerIndex = 0; playerIndex <= 1; playerIndex++) {

      for (var i = 0; i < data.gamestate.zones[playerIndex].hand.length; i++) {
       var cid = data.gamestate.zones[playerIndex].hand[i];
       moveCardToZone(cid, ZoneEnum.HAND, false, false);
      }

      for (var i = 0; i < data.gamestate.zones[playerIndex].library.length; i++) {
        var cid = data.gamestate.zones[playerIndex].library[i];
        moveCardToZone(cid, ZoneEnum.LIBRARY, false, false);
      }

      for (var i = 0; i < data.gamestate.zones[playerIndex].graveyard.length; i++) {
        var cid = data.gamestate.zones[playerIndex].graveyard[i];
        moveCardToZone(cid, ZoneEnum.GRAVEYARD, false, false);
      }

      for (var i = 0; i < data.gamestate.zones[playerIndex].exile.length; i++) {
        var cid = data.gamestate.zones[playerIndex].exile[i];
        var faceDown = g_directory[cid].faceDown;
        moveCardToZone(cid, ZoneEnum.EXILE, faceDown, false);
      }
    }

    var opp_index = 0;
    if (data.role === 0)
      opp_index = 1;
    if (data.role === data.gamestate.turn_player)
      g_turn_player = true;
    g_turn_phase = data.gamestate.turn_phase;
    if (g_turn_player) {
      switch (g_turn_phase) {
        case 0:
          $("#phase_my_0").addClass("phase_label_active");
          break;
        case 1:
          $("#phase_my_1").addClass("phase_label_active");
          break;
        case 2:
          $("#phase_my_2").addClass("phase_label_active");
          break;
        case 3:
          $("#phase_my_3").addClass("phase_label_active");
          break;
        case 4:
          $("#phase_my_4").addClass("phase_label_active");
          break;
        case 5:
          $("#phase_my_5").addClass("phase_label_active");
          break;
        case 6:
          $("#phase_my_6").addClass("phase_label_active");
          break;
      }
    }
    else {
      switch (g_turn_phase) {
        case 0:
          $("#phase_opp_0").addClass("phase_label_active");
          break;
        case 1:
          $("#phase_opp_1").addClass("phase_label_active");
          break;
        case 2:
          $("#phase_opp_2").addClass("phase_label_active");
          break;
        case 3:
          $("#phase_opp_3").addClass("phase_label_active");
          break;
        case 4:
          $("#phase_opp_4").addClass("phase_label_active");
          break;
        case 5:
          $("#phase_opp_5").addClass("phase_label_active");
          break;
        case 6:
          $("#phase_opp_6").addClass("phase_label_active");
          break;
      }
    }

    g_life = data.gamestate.life[data.role];
    g_life_opp = data.gamestate.life[opp_index];
    g_poison = data.gamestate.poison[data.role];
    g_poison_opp = data.gamestate.poison[opp_index];
    updateStatusBox();
 
    enableInteractivity();
  });


  g_client_io.on('chat_message', function(data){
      addChatMessage(MessageEnum.OPP, data.msg);
  });


  g_client_io.on('card_moved', function(data) {

    moveCardToZone(data.cid, data.toZone, data.faceDown, false);
    if (data.toZone === ZoneEnum.BATTLEFIELD) {
      updateCardBFPosition(data.cid, data.x, data.y);
    }
  });

  g_client_io.on('card_changed', function(data) {

    var card = g_directory[data.cid];
    
    if (card.faceDown != data.faceDown)
      changeCardStateFace(data.cid);
    if (card.tapped != data.tapped)
      changeCardStateTap(data.cid);
    if (card.flipped != data.flipped)
      changeCardStateFlip(data.cid);
    if (card.transformed != data.transformed)
      changeCardStateTransform(data.cid);
    if (card.counters != data.counters)
      changeCardStateCounters(data.cid, data.counters);
  });

  g_client_io.on('advance_phase', function(data) {
    advancePhase();
  });

  g_client_io.on('life_changed', function(data) {
    g_life_opp = data.val;
    updateStatusBox();
    addChatMessage(MessageEnum.SYSTEM, g_opponent_name + '\'s life total set to ' + p_val + '.');
  });
  
  g_client_io.on('poison_changed', function(data) {
    g_poison_opp = data.val;
    updateStatusBox();
    addChatMessage(MessageEnum.SYSTEM, g_opponent_name + '\'s poison counters set to ' + p_val + '.');
  });
}


function generateCard(p_owned, p_image, p_image2, p_frame, p_x, p_y, p_faceDown, p_tapped, p_flipped, p_transformed, p_counters) {

  // 'static' counter for incrementing card IDs
  if (typeof generateCard.numGenerated == 'undefined') {
    generateCard.numGenerated = 0;
  }

  var cid = generateCard.numGenerated++;

  // outer card element for positional changes
  var handleElement = document.createElement("div");
  handleElement.id = "h" + cid;
  if (p_owned) {
    handleElement.setAttribute("class", "cardhandle cardhandle_owned rcmenu_target");
  }
  else {
    handleElement.setAttribute("class", "cardhandle cardhandle_upsidedown");
  }

  // inner card element for visual changes
  var canvasElement = document.createElement("div");
  canvasElement.id = cid;
  canvasElement.setAttribute("class", "cardcanvas");
  canvasElement.setAttribute("data-toggle", "context");

  handleElement.appendChild(canvasElement);
  if (p_owned) {
    document.getElementById("my_battlefield").appendChild(handleElement);
  }
  else {
    document.getElementById("opp_battlefield").appendChild(handleElement);
  }

  var $cardCanvas = $("#" + cid);
  var $cardHandle = $("#h" + cid);

  var cardEntry = {
    canvas : $cardCanvas,
    handle : $cardHandle,
    imgSrc : "url(" + p_image + ")",
    imgSrc2 : "url(" + p_image2 + ")",
    frame : p_frame,
    owned : p_owned,
    zone : ZoneEnum.BATTLEFIELD,
    faceDown : p_faceDown,
    tapped : false,
    flipped : false,
    transformed : p_transformed,
    counters : 0
  };
  
  g_directory.push(cardEntry);

  $cardCanvas.css("zIndex", 10); // FIXME

  if (p_tapped)
    changeCardStateTap(cid);
  if (p_flipped)
    changeCardStateFlip(cid);
  if (p_counters !== 0)
    changeCardStateCounters(cid, p_counters);

  updateCardFace(cid);
  updateCardBFPosition(cid, p_x, p_y);
}


// return the cid given a jquery handle to an element
function getCID($element) {
  var cid = 0;
  var id = $element.attr("id");
  if (id[0] === 'h') {
    cid = parseInt(id.substring(1));
  }
  else {
    cid = parseInt(id);
  }
  return cid;
}


function changeCardStateTap(p_cid) {
  var card = g_directory[p_cid];
  if (!card.tapped) {
    card.tapped = true;
    card.canvas.addClass("cardcanvas_tapped");
  }
  else {
    card.tapped = false;
    card.canvas.removeClass("cardcanvas_tapped");
  }
}


function changeCardStateFace(p_cid) {
  var card = g_directory[p_cid];
  card.faceDown = !card.faceDown;
  updateCardFace(p_cid);
}


function changeCardStateFlip(p_cid) {
  var card = g_directory[p_cid];
  if (!card.flipped) {
    card.flipped = true;
    if (card.owned)
      card.handle.addClass("cardhandle_upsidedown");
    else
      card.handle.removeClass("cardhandle_upsidedown");
  }
  else {
    card.flipped = false;
    if (card.owned)
      card.handle.removeClass("cardhandle_upsidedown");
    else
      card.handle.addClass("cardhandle_upsidedown");
  }
}


function changeCardStateTransform(p_cid) {
  var card = g_directory[p_cid];
  card.transformed = !card.transformed;
  updateCardFace(p_cid);
}


function changeCardStateCounters(p_cid, p_val) {
  var card = g_directory[p_cid];
  card.counters = p_val;
  if (card.counters === 0) {
    card.canvas.html("");
  }
  else {
    card.canvas.html("+ " + card.counters);
  }
}


function emitCardState(p_cid) {
  var card = g_directory[p_cid];
  g_client_io.emit('card_changed', { cid: p_cid,
                                     faceDown: card.faceDown,
                                     tapped: card.tapped,
                                     flipped: card.flipped,
                                     transformed: card.transformed,
                                     counters: card.counters
                                   });
}


function moveCardToZone(p_cid, p_toZone, p_shiftHeld, p_notifyServer) {

  var card = g_directory[p_cid];
  var $cardCanvas = card.canvas;
  var ownerIndex = (card.owned) ? 0 : 1;

  // update card position (regardless of zone change)
  updateCardPosition(p_cid, p_toZone);

  var fromZone = card.zone;

  // notify server/opponent of state change
  if (p_notifyServer) {
    
    if (p_toZone === ZoneEnum.BATTLEFIELD) {

      var $cardElement = $("#h" + p_cid);
      g_client_io.emit('card_moved', { cid: p_cid,
                                       fromZone: fromZone,
                                       toZone: ZoneEnum.BATTLEFIELD,
                                       x: $cardElement.position().left,
                                       y: $cardElement.position().top,
                                       faceDown: p_shiftHeld
                                     });
    }
    else if (fromZone != p_toZone) {

      g_client_io.emit('card_moved', { cid: p_cid,
                                       fromZone: fromZone,
                                       toZone: p_toZone,
                                       faceDown: p_shiftHeld
                                     });
    }
  }

  if (fromZone === p_toZone) {

    // the only time we'd need to re-draw anything when a card doesn't
    // change zones is moving a 'hand' card around; refresh the hand
    if (p_toZone === ZoneEnum.HAND) {
      refreshHand(ownerIndex);
    }

    // if a card didn't change zones, there is no work to be done now
    return;
  }

  var refHand = false;
  var refLibrary = false;
  var refGraveyard = false;
  var refExile = false;

  // remove card from its old zone array
  var pos;
  switch(fromZone) {

    case ZoneEnum.BATTLEFIELD:
      // do nothing
      break;

    case ZoneEnum.HAND:
      pos = g_hand[ownerIndex].indexOf(p_cid);
      g_hand[ownerIndex].splice(pos, 1);
      refHand = true;
      break;

    case ZoneEnum.LIBRARY:
      pos = g_library[ownerIndex].indexOf(p_cid);
      g_library[ownerIndex].splice(pos, 1);
      refLibrary = true;
      break;

    case ZoneEnum.GRAVEYARD:
      pos = g_graveyard[ownerIndex].indexOf(p_cid);
      g_graveyard[ownerIndex].splice(pos, 1);
      refGraveyard = true;
      break;

    case ZoneEnum.EXILE:
      pos = g_exile[ownerIndex].indexOf(p_cid);
      g_exile[ownerIndex].splice(pos, 1);
      $cardCanvas.removeClass("cardcanvas_exiled");
      refExile = true;
      break;
  }

  // switch on dest zone, then add to new array
  var resetState = false;
  var turnFaceDown = false;
  switch(p_toZone) {

    case ZoneEnum.BATTLEFIELD:
      resetState = false;
      turnFaceDown = p_shiftHeld;
      break;

    case ZoneEnum.HAND:
      g_hand[ownerIndex].push(p_cid);
      resetState = true;
      turnFaceDown = false;
      refHand = true;
      break;

    case ZoneEnum.LIBRARY:
      g_library[ownerIndex].push(p_cid);
      resetState = true;
      turnFaceDown = false;
      refLibrary = true;
      break;

    case ZoneEnum.GRAVEYARD:
      g_graveyard[ownerIndex].push(p_cid);
      resetState = true;
      turnFaceDown = false;
      refGraveyard = true;
      break;

    case ZoneEnum.EXILE:
      g_exile[ownerIndex].push(p_cid);
      resetState = true;
      turnFaceDown = p_shiftHeld;
      $cardCanvas.addClass("cardcanvas_exiled");
      refExile = true;
      break;
  }

  // update directory
  card.zone = p_toZone;
  card.faceDown = turnFaceDown;
  if (resetState) {
    if (card.tapped) {
      changeCardStateTap(p_cid);
    }
    if (card.flipped) {
      changeCardStateFlip(p_cid);
    }
    card.transformed = false;
    if (card.counters !== 0) {
      changeCardStateCounters(p_cid, 0);
    }
  }

  updateCardFace(p_cid);

  // refresh display on both to/from zones
  if (refHand) {
    refreshHand(ownerIndex);
  }
  if (refLibrary) {
    refreshLibrary(ownerIndex);
  }
  if (refGraveyard) {
    refreshGraveyard(ownerIndex);
  }
  if (refExile) {
    refreshExile(ownerIndex);
  }

  if (fromZone === ZoneEnum.LIBRARY || p_toZone === ZoneEnum.LIBRARY)
    updateStatusBox();

}


function updateCardPosition(p_cid, p_toZone) {

  var $cardHandle = g_directory[p_cid].handle;
  if (g_directory[p_cid].owned) {

    switch(p_toZone) {
  
      case ZoneEnum.HAND:
        $cardHandle.css("top", "auto");
        $cardHandle.css("bottom", $("#hand").css("bottom"));
        $cardHandle.css("left", "0px");
        $cardHandle.css("right", "auto");
        break;
  
      case ZoneEnum.LIBRARY:
        $cardHandle.css("top", $("#library").css("top"));
        $cardHandle.css("bottom", "auto");
        $cardHandle.css("left", $("#library").css("left"));
        $cardHandle.css("right", "auto");
        break;
  
      case ZoneEnum.GRAVEYARD:
        $cardHandle.css("top", $("#graveyard").css("top"));
        $cardHandle.css("bottom", "auto");
        $cardHandle.css("left", $("#graveyard").css("left"));
        $cardHandle.css("right", "auto");
        break;
  
      case ZoneEnum.EXILE:
        $cardHandle.css("top", $("#exile").css("top"));
        $cardHandle.css("bottom", "auto");
        $cardHandle.css("left", "auto");
        $cardHandle.css("right", $("#exile").css("right"));
        break;
    }
  }
  else {
  
    switch(p_toZone) {
  
      case ZoneEnum.HAND:
        $cardHandle.css("top", $("#opp_hand").css("top"));
        $cardHandle.css("bottom", "auto");
        $cardHandle.css("left", "0px");
        $cardHandle.css("right", "auto");
        break;
  
      case ZoneEnum.LIBRARY:
        $cardHandle.css("top", "auto");
        $cardHandle.css("bottom", $("#opp_library").css("bottom"));
        $cardHandle.css("left", $("#opp_library").css("left"));
        $cardHandle.css("right", "auto");
        break;
  
      case ZoneEnum.GRAVEYARD:
        $cardHandle.css("top", "auto");
        $cardHandle.css("bottom", $("#opp_graveyard").css("bottom"));
        $cardHandle.css("left", $("#opp_graveyard").css("left"));
        $cardHandle.css("right", "auto");
        break;
  
      case ZoneEnum.EXILE:
        $cardHandle.css("top", "auto");
        $cardHandle.css("bottom", $("#opp_exile").css("bottom"));
        $cardHandle.css("left", "auto");
        $cardHandle.css("right", $("#opp_exile").css("right"));
        break;
    }
    
  }
}


function updateCardBFPosition(p_cid, p_x, p_y) {

  var $cardHandle = g_directory[p_cid].handle;
  if (g_directory[p_cid].owned) {
    $cardHandle.css("top", p_y + "px");
    $cardHandle.css("bottom", "auto");
    $cardHandle.css("left", p_x + "px");
    $cardHandle.css("right", "auto");
  }
  else {
    $cardHandle.css("top", "auto");
    $cardHandle.css("bottom", p_y + "px");
    $cardHandle.css("left", p_x + "px");
    $cardHandle.css("right", "auto");
  }
}


function updateCardFace(p_cid) {
  
  // there are potentially three faces to show
  var showBack = false;
  var showAlt = false;

  var card = g_directory[p_cid];

  switch(card.zone) {

    case ZoneEnum.BATTLEFIELD:
      if (card.faceDown) {
        showBack = true;
      }
      else if (card.transformed) {
        showAlt = true;
      }
      break;

    case ZoneEnum.HAND:
      showBack = !card.owned;
      break;

    case ZoneEnum.LIBRARY:
      showBack = true;
      break;

    case ZoneEnum.GRAVEYARD:
      // always show face up
      break;

    case ZoneEnum.EXILE:
      showBack = card.faceDown;
      break;
  }

  if (showBack) {
    card.canvas.css("background-image", "url(images/back.jpg)");
  }
  else if (showAlt) {
    card.canvas.css("background-image", card.imgSrc2);
  }
  else {
    card.canvas.css("background-image", card.imgSrc);
  }
}


function refreshLibrary(p_ownerIndex) {
  var offset = $("#library").offset();
  if (p_ownerIndex == 1) {
    offset = $("#opp_library").offset();
  }
  var z = offset.top * ZWIDTH + offset.left;
  var numCards = g_library[p_ownerIndex].length;
  for (var i = 0; i < numCards; i++) {
    var cid = g_library[p_ownerIndex][i];
    var $cardHandle = g_directory[cid].handle;
    if (i === numCards - 1) {
      $cardHandle.show()
      $cardHandle.css("zIndex", z);
    }
    else if (i === numCards - 2) {
      $cardHandle.show()
      $cardHandle.css("zIndex", z - 1);
    }
    else {
      $cardHandle.hide()
    }
  }
}


function refreshGraveyard(p_ownerIndex) {
  var offset = $("#graveyard").offset();
  if (p_ownerIndex == 1) {
    offset = $("#opp_graveyard").offset();
  }
  var z = offset.top * ZWIDTH + offset.left;
  var numCards = g_graveyard[p_ownerIndex].length;
  for (var i = 0; i < numCards; i++) {
    var cid = g_graveyard[p_ownerIndex][i];
    var $cardHandle = g_directory[cid].handle;
    if (i === numCards - 1) {
      $cardHandle.show()
      $cardHandle.css("zIndex", z);
    }
    else if (i === numCards - 2) {
      $cardHandle.show()
      $cardHandle.css("zIndex", z - 1);
    }
    else {
      $cardHandle.hide()
    }
  }
}


function refreshExile(p_ownerIndex) {
  var offset = $("#exile").offset();
  if (p_ownerIndex == 1) {
    offset = $("#opp_exile").offset();
  }
  var z = offset.top * ZWIDTH + offset.left;
  var numCards = g_exile[p_ownerIndex].length;
  for (var i = 0; i < numCards; i++) {
    var cid = g_exile[p_ownerIndex][i];
    var $cardHandle = g_directory[cid].handle;
    if (i === numCards - 1) {
      $cardHandle.show()
      $cardHandle.css("zIndex", z);
    }
    else if (i === numCards - 2) {
      $cardHandle.show()
      $cardHandle.css("zIndex", z - 1);
    }
    else {
      $cardHandle.hide()
    }
  }
}


function refreshHand(p_ownerIndex) {
  var offset = $("#hand").offset();
  var totalWidth = $("#hand").width() - 100;
  if (p_ownerIndex == 1) {
    offset = $("#opp_hand").offset();
    totalWidth = $("#opp_hand").width() - 100;
  }
  var zbase = offset.top * ZWIDTH;
  var numCards = g_hand[p_ownerIndex].length;
  for (var i = 0; i < numCards; i++) {
    var cid = g_hand[p_ownerIndex][i];
    var $cardHandle = g_directory[cid].handle;
    var left = Math.floor(i * Math.min(totalWidth / (numCards - 1), 100));
    $cardHandle.css("left", left);
    $cardHandle.css("zIndex", zbase + left);
  }
}


function highlightCard(p_cid) {
  g_directory[p_cid].canvas.addClass("cardcanvas_hover");
  g_directory[p_cid].handle.css("zIndex", ZTOP);
}


function unhighlightCard(p_cid) {
  g_directory[p_cid].canvas.removeClass("cardcanvas_hover");
  var offset = g_directory[p_cid].handle.offset();
  g_directory[p_cid].handle.css("zIndex", offset.top * ZWIDTH + offset.left);
}


function zoomCard(p_cid) {
  var card = g_directory[p_cid];
  var show = false;

  switch(card.zone) {

    case ZoneEnum.BATTLEFIELD:
      // always show own cards, show opponent's face up cards
      if (card.owned || !card.faceDown)
        show = true;
      break;

    case ZoneEnum.HAND:
      // always show cards in own hand, never opponent's
      show = card.owned;
      break;

    case ZoneEnum.LIBRARY:
      // library cards should always be hidden
      show = false;
      break;

    case ZoneEnum.GRAVEYARD:
      // always show graveyard cards
      show = true;
      break;

    case ZoneEnum.EXILE:
      // don't even show own cards if face down
      show = !card.faceDown;
      break;
  }

  if (show) {
    var $zoom = $("#zoom_box");
    if (card.transformed)
      $zoom.css("background-image", card.imgSrc2);
    else $zoom.css("background-image", card.imgSrc);
  }
}

function addChatMessage(p_type, p_msg) {
  var li;
  switch(p_type) {
    case MessageEnum.ME:
      li = '<li class="message_item_me"><strong>' + g_username + '</strong>: ' + p_msg + '</li>';
      break;
    case MessageEnum.OPPONENT:
      li = '<li class="message_item_opp"><strong>' + g_opponent_name + '</strong>: ' + p_msg + '</li>';
      break;
    case MessageEnum.SYSTEM:
      li = '<li class="system">' + p_msg + '</li>';
      break;
  }

  $('#message_list').append(li);
  $('#chat_messages').animate({ scrollTop: $('#chat_messages')[0].scrollHeight}, 1000);
}

function advancePhase() {
  var desc = 'Entering ';
  if (g_turn_player) {
    switch (g_turn_phase) {
      case 0:
        $("#phase_my_0").removeClass("phase_label_active");
        $("#phase_my_1").addClass("phase_label_active");
        desc += g_username + '\'s upkeep phase.';
        break;
      case 1:
        $("#phase_my_1").removeClass("phase_label_active");
        $("#phase_my_2").addClass("phase_label_active");
        desc += g_username + '\'s draw phase.';
        break;
      case 2:
        $("#phase_my_2").removeClass("phase_label_active");
        $("#phase_my_3").addClass("phase_label_active");
        desc += g_username + '\'s main phase 1.';
        break;
      case 3:
        $("#phase_my_3").removeClass("phase_label_active");
        $("#phase_my_4").addClass("phase_label_active");
        desc += g_username + '\'s combat phase.';
        break;
      case 4:
        $("#phase_my_4").removeClass("phase_label_active");
        $("#phase_my_5").addClass("phase_label_active");
        desc += g_username + '\'s main phase 2.';
        break;
      case 5:
        $("#phase_my_5").removeClass("phase_label_active");
        $("#phase_my_6").addClass("phase_label_active");
        desc += g_username + '\'s end phase.';
        break;
      case 6:
        $("#phase_my_6").removeClass("phase_label_active");
        $("#phase_opp_0").addClass("phase_label_active");
        desc += g_opponent_name + '\'s untap phase.';
        break;
    }
  }
  else {
    switch (g_turn_phase) {
      case 0:
        $("#phase_opp_0").removeClass("phase_label_active");
        $("#phase_opp_1").addClass("phase_label_active");
        desc += g_opponent_name + '\'s upkeep phase.';
        break;
      case 1:
        $("#phase_opp_1").removeClass("phase_label_active");
        $("#phase_opp_2").addClass("phase_label_active");
        desc += g_opponent_name + '\'s draw phase.';
        break;
      case 2:
        $("#phase_opp_2").removeClass("phase_label_active");
        $("#phase_opp_3").addClass("phase_label_active");
        desc += g_opponent_name + '\'s main phase 1.';
        break;
      case 3:
        $("#phase_opp_3").removeClass("phase_label_active");
        $("#phase_opp_4").addClass("phase_label_active");
        desc += g_opponent_name + '\'s combat phase.';
        break;
      case 4:
        $("#phase_opp_4").removeClass("phase_label_active");
        $("#phase_opp_5").addClass("phase_label_active");
        desc += g_opponent_name + '\'s main phase 2.';
        break;
      case 5:
        $("#phase_opp_5").removeClass("phase_label_active");
        $("#phase_opp_6").addClass("phase_label_active");
        desc += g_opponent_name + '\'s end phase.';
        break;
      case 6:
        $("#phase_opp_6").removeClass("phase_label_active");
        $("#phase_my_0").addClass("phase_label_active");
        desc += g_username + '\'s untap phase.';
        break;
    }
  }
  
  if (++g_turn_phase == 7) {
    g_turn_phase = 0;
    g_turn_player = !g_turn_player;
  }

  addChatMessage(MessageEnum.SYSTEM, desc);
}

function updateStatusBox() {
  $("#my_life").html(g_life);
  $("#opp_life").html(g_life_opp);
  $("#my_poison").html(g_poison);
  $("#opp_poison").html(g_poison_opp);
  $("#my_libsize").html(g_library[0].length);
  $("#opp_libsize").html(g_library[1].length);
}


function setLife(p_val) {
  g_life = p_val;
  updateStatusBox();
  addChatMessage(MessageEnum.SYSTEM, g_username + '\'s life total set to ' + p_val + '.');
  g_client_io.emit('life_changed', { val: p_val });
}


function setPoison(p_val) {
  g_poison = p_val;
  updateStatusBox();
  addChatMessage(MessageEnum.SYSTEM, g_username + '\'s poison counters set to ' + p_val + '.');
  g_client_io.emit('poison_changed', { val: p_val });
}


function createRCMenu(e) {

  var menuTitle = undefined;
  var menuItems = [];

  // FIXME conditonally change labels based on card frame type

  var card = g_directory[g_rcCardId];

  var on_battlefield = (card.zone === ZoneEnum.BATTLEFIELD);
  
  var turnLabel = "Turn face down";
  if (card.faceDown)
    turnLabel = "Turn face up";

  menuItems.push({ label: turnLabel,
                   icon:'images/icons/icon1.png',
                   isEnabled: function() { return on_battlefield; },
                   action: function() { changeCardStateFace(g_rcCardId); emitCardState(g_rcCardId); } });
  menuItems.push({ label:'Flip',
                   icon:'images/icons/icon2.png',
                   isEnabled: function() { return (on_battlefield && g_directory[g_rcCardId].frame === 2); },
                   action: function() { changeCardStateFlip(g_rcCardId); emitCardState(g_rcCardId); } });
  menuItems.push({ label:'Transform',
                   icon:'images/icons/icon3.png',
                   isEnabled: function() { return (on_battlefield && g_directory[g_rcCardId].frame === 3); },
                   action: function() { changeCardStateTransform(g_rcCardId); emitCardState(g_rcCardId); } });
  menuItems.push(null);
  menuItems.push({ label:'Add a counter',
                   icon:'images/icons/icon1.png',
                   isEnabled: function() { return on_battlefield; },
                   action: function() { changeCardStateCounters(g_rcCardId, g_directory[g_rcCardId].counters + 1); emitCardState(g_rcCardId); } });
  menuItems.push({ label:'Remove a counter',
                   icon:'images/icons/icon1.png',
                   isEnabled: function() { return (on_battlefield && g_directory[g_rcCardId].counters > 0); },
                   action: function() { changeCardStateCounters(g_rcCardId, g_directory[g_rcCardId].counters - 1); emitCardState(g_rcCardId); } });

  // code below mostly borrowed from jquery-simple-context-menu

  var menu = $('<ul class="contextMenuPlugin"><div class="gutterLine"></div></ul>')
    .appendTo(document.body);
  if (menuTitle) {
    $('<li class="header"></li>').text(menuTitle).appendTo(menu);
  }
  menuItems.forEach(function(item) {
    if (item) {
      var rowCode = '<li><a href="#" class="contextMenuLink"><span class="itemTitle"></span></a></li>';
      var row = $(rowCode).appendTo(menu);
      if(item.icon){
        var icon = $('<img>');
        icon.attr('src', item.icon);
        icon.insertBefore(row.find('.itemTitle'));
      }
      row.find('.itemTitle').text(item.label);
        
      if (item.isEnabled != undefined && !item.isEnabled()) {
          row.addClass('disabled');
      } else if (item.action) {
          row.find('.contextMenuLink').click(function () { item.action(e); });
      }

    } else {
      $('<li class="divider"></li>').appendTo(menu);
    }
  });
  menu.find('.header').text(menuTitle);
  return menu;
}


function enableInteractivity() {

  $(".cardhandle_owned").draggable({ grid: [5, 20],
                                     snap: ".zone",
                                     snapMode: "inner",
                                     snapTolerance: 10,
                                     containment: "#battlefield_wrapper"
  });

  $("#battlefield_wrapper").droppable({
    accept: ".cardhandle_owned",
    drop: function( event, ui ) {
      var cid = getCID(ui.draggable);
      moveCardToZone(cid,
                     ZoneEnum.BATTLEFIELD,
                     g_shiftHeld,
                     true);
      zoomCard(cid);
    }
  });

  $("#hand").droppable({
    accept: ".cardhandle_owned",
    greedy: true,
    hoverClass: "zone_hover",
    drop: function( event, ui ) {
      var cid = getCID(ui.draggable);
      moveCardToZone(cid,
                     ZoneEnum.HAND,
                     g_shiftHeld,
                     true);
      zoomCard(cid);
    }
  });

  $("#library").droppable({
    accept: ".cardhandle_owned",
    greedy: true,
    hoverClass: "zone_hover",
    drop: function( event, ui ) {
      moveCardToZone(getCID(ui.draggable),
                     ZoneEnum.LIBRARY,
                     g_shiftHeld,
                     true);
    }
  });

  $("#graveyard").droppable({
    accept: ".cardhandle_owned",
    greedy: true,
    hoverClass: "zone_hover",
    drop: function( event, ui ) {
      var cid = getCID(ui.draggable);
      moveCardToZone(cid,
                     ZoneEnum.GRAVEYARD,
                     g_shiftHeld,
                     true);
      zoomCard(cid);
    }
  });

  $("#exile").droppable({
    accept: ".cardhandle_owned",
    greedy: true,
    hoverClass: "zone_hover",
    drop: function( event, ui ) {
      var cid = getCID(ui.draggable);
      moveCardToZone(cid,
                     ZoneEnum.EXILE,
                     g_shiftHeld,
                     true);
      zoomCard(cid);
    }
  });

  // highlight a card upon mouse hover; in the event of a right-click,
  // hand off the responsibility to unhighlight to the right-click menu
  $(".cardhandle").hover(
    function() {
      if (!g_rcmenuActive) {
        var cid = getCID($(this));
        highlightCard(cid);
        zoomCard(cid);
      }
    },
    function() {
      if (!g_rcmenuActive) {
        var cid = getCID($(this));
        unhighlightCard(cid);
      }
      // FIXME be sure to call unhighlightCard on an opponent's card that just got moved
  });

  // left mouse click to tap/untap a card
  $(".cardhandle_owned").click(function() {
    var cid = getCID($(this));
    if (g_directory[cid].zone === ZoneEnum.BATTLEFIELD) {
      changeCardStateTap(cid);
      emitCardState(cid);
    }
  });

  // right mouse click to bring up a menu
  $('.rcmenu_target').on('contextmenu', function(e) {

    g_rcmenuActive = true;
    g_rcCardId = getCID($(this));
    highlightCard(g_rcCardId);

    // code below mostly borrowed from jquery-simple-context-menu
    
    var menu = createRCMenu(e).show();
    
    var left = e.pageX + 5, /* nudge to the right, so the pointer is covering the title */
        top = e.pageY;
    if (top + menu.height() >= $(window).height()) {
        top -= menu.height();
    }
    if (left + menu.width() >= $(window).width()) {
        left -= menu.width();
    }

    // create and show menu
    menu.css({zIndex: ZTOP + 2, left:left, top:top})
      .on('contextmenu', function() { return false; });

    // cover rest of page with invisible div that when clicked will cancel the popup.
    var bg = $('<div></div>')
      .css({left:0, top:0, width:'100%', height:'100%', position:'absolute', zIndex: ZTOP + 1})
      .appendTo(document.body)
      .on('contextmenu click', function() {
        // if click or right click anywhere else on page: remove clean up.
        bg.remove();
        menu.remove();
        g_rcmenuActive = false;
        unhighlightCard(g_rcCardId);
        return false;
      });

    // when clicking on a link in menu: clean up (in addition to handlers on link already)
    menu.find('a').click(function() {
      bg.remove();
      menu.remove();
      g_rcmenuActive = false;
      unhighlightCard(g_rcCardId);
    });

    // cancel event, so real browser popup doesn't appear.
    return false;
  });
  
  window.onkeydown = function(e) {
    var key = e.which;
    switch(key) {
      case 16: // 'shift'
        g_shiftHeld = true;
        break;
    }
  }

  window.onkeyup = function(e) {
    var key = e.which;
    switch(key) {
      case 16: // 'shift'
        g_shiftHeld = false;
        break;
    }
  }

  $("#button_life_inc").click(function() {
    if (g_life < 999)
      setLife(g_life + 1);
  });

  $("#button_life_dec").click(function() {
    if (g_life > -999)
      setLife(g_life - 1);
  });

  $("#button_life_set").click(function() {
    var val = $("#life_val").val();
    if (val.length > 0 && val.length < 4) {
      setLife(val);
      $("#life_val").val("");
    }
  });

  $("#button_poison_inc").click(function() {
    if (g_poison < 10)
      setPoison(g_poison + 1);
  });

  $("#button_poison_dec").click(function() {
    if (g_poison > 0)
      setPoison(g_poison - 1);
  });

  $("#button_next_phase").click(function() {
    if (g_turn_player) {
      advancePhase();
      g_client_io.emit('advance_phase');
    }
  });

  $("#message_form").submit(function() {
    if ($("#message_buffer").val() != '') {

      var message = $('#message_buffer').val();
      g_client_io.emit('chat_message', { msg: message });
      $("#message_buffer").val('');
      addChatMessage(MessageEnum.ME, message);
    }
    return false;
  });

  $('#message_send_button').prop('disabled', false);

}


