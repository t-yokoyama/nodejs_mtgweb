
function initGlobals() {

  // global variables
  window.ZoneEnum = {
    BATTLEFIELD : 1,
    HAND : 2,
    LIBRARY : 3,
    GRAVEYARD : 4,
    EXILE : 5
  };
  
  window.ZTOP = 100000000;
  window.ZWIDTH = 10000;

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
  
    // iterate over all the cards in the gamestate array, assigning card ownership based on data.role
    for (var i = 0; i < data.gamestate.cards.length; i++) {
      var card = data.gamestate.cards[i];
      var is_owner = (data.role === card.owner);
      generateCard(is_owner, card.imageurl, card.x, card.y, card.faceDown, card.tapped, card.flipped, card.transformed, card.counters);
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
        var faceDown = !g_directory[cid].faceUp;
        moveCardToZone(cid, ZoneEnum.EXILE, faceDown, false);
      }
    }
    
    enableInteractivity();
  });

  g_client_io.on('card_moved', function(data) {

    moveCardToZone(data.cid, data.toZone, data.faceDown, false);
    if (data.toZone === ZoneEnum.BATTLEFIELD) {
      updateCardBFPosition(data.cid, data.x, data.y);
    }
  });

}

function generateCard(p_owned, p_image, p_x, p_y, p_faceDown, p_tapped, p_flipped, p_transformed, p_counters) {

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
    owned: p_owned,
    zone : ZoneEnum.BATTLEFIELD,
    faceDown : p_faceDown,
    tapped : p_tapped,
    flipped : p_flipped,
    transformed : p_transformed,
    numCounters : p_counters
  };
  
  g_directory.push(cardEntry);

  $cardCanvas.css("zIndex", 10); // FIXME
  if (p_faceDown) {
    $cardCanvas.css("background-image", "url(images/back.jpg)");
  }
  else {
    $cardCanvas.css("background-image", "url(" + p_image + ")");
  }

  // FIXME apply visual effects of flipped/transformed/morphed etc here

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


function moveCardToZone(p_cid, p_toZone, p_shiftHeld, p_notifyServer) {

  var $cardCanvas = g_directory[p_cid].canvas;
  var ownerIndex = (g_directory[p_cid].owned) ? 0 : 1;

  // update card position (regardless of zone change)
  updateCardPosition(p_cid, p_toZone);

  var fromZone = g_directory[p_cid].zone;

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
  var turnFaceUp;
  switch(p_toZone) {

    case ZoneEnum.BATTLEFIELD:
      turnFaceUp = !p_shiftHeld;
      break;

    case ZoneEnum.HAND:
      g_hand[ownerIndex].push(p_cid);
      turnFaceUp = (g_directory[p_cid].owned);
      refHand = true;
      break;

    case ZoneEnum.LIBRARY:
      g_library[ownerIndex].push(p_cid);
      turnFaceUp = false;
      refLibrary = true;
      break;

    case ZoneEnum.GRAVEYARD:
      g_graveyard[ownerIndex].push(p_cid);
      turnFaceUp = true;
      refGraveyard = true;
      break;

    case ZoneEnum.EXILE:
      g_exile[ownerIndex].push(p_cid);
      turnFaceUp = !p_shiftHeld;
      $cardCanvas.addClass("cardcanvas_exiled");
      refExile = true;
      break;
  }

  $cardCanvas.removeClass("cardcanvas_tapped");

  // update directory
  g_directory[p_cid].zone = p_toZone;
  g_directory[p_cid].tapped = false;
  g_directory[p_cid].flipped = false;
  g_directory[p_cid].transformed = false;
  g_directory[p_cid].numCounters = 0;

  // toggle face up/down as appropriate
  if (!g_directory[p_cid].faceDown && !turnFaceUp) {
    $cardCanvas.css("background-image", "url(images/back.jpg)");
    g_directory[p_cid].faceDown = true;
  }
  else if (g_directory[p_cid].faceDown && turnFaceUp) {
    $cardCanvas.css("background-image", g_directory[p_cid].imgSrc);
    g_directory[p_cid].faceDown = false;
  }

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
      moveCardToZone(getCID(ui.draggable),
                     ZoneEnum.BATTLEFIELD,
                     g_shiftHeld,
                     true);
    }
  });

  $("#hand").droppable({
    accept: ".cardhandle_owned",
    greedy: true,
    hoverClass: "zone_hover",
    drop: function( event, ui ) {
      moveCardToZone(getCID(ui.draggable),
                     ZoneEnum.HAND,
                     g_shiftHeld,
                     true);
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
      moveCardToZone(getCID(ui.draggable),
                     ZoneEnum.GRAVEYARD,
                     g_shiftHeld,
                     true);
    }
  });

  $("#exile").droppable({
    accept: ".cardhandle_owned",
    greedy: true,
    hoverClass: "zone_hover",
    drop: function( event, ui ) {
      moveCardToZone(getCID(ui.draggable),
                     ZoneEnum.EXILE,
                     g_shiftHeld,
                     true);
    }
  });

  // highlight a card upon mouse hover; in the event of a right-click,
  // hand off the responsibility to unhighlight to the right-click menu
  $(".cardhandle").hover(
    function() {
      if (!g_rcmenuActive) {
        var cid = getCID($(this));
        highlightCard(cid);
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
    var card = g_directory[cid];
    if (card.zone === ZoneEnum.BATTLEFIELD) {
      if (!card.tapped) {
        card.tapped = true;
        card.canvas.addClass("cardcanvas_tapped");
      }
      else {
        card.tapped = false;
        card.canvas.removeClass("cardcanvas_tapped");
      }
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
    menu.css({zIndex:200000001, left:left, top:top})
      .on('contextmenu', function() { return false; });

    // cover rest of page with invisible div that when clicked will cancel the popup.
    var bg = $('<div></div>')
      .css({left:0, top:0, width:'100%', height:'100%', position:'absolute', zIndex:200000000})
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

}

function createRCMenu(e) {

  var menuTitle = undefined;
  var menuItems = [
    { label:'Some Item',     icon:'images/icons/shopping-basket.png',     action:function() { alert('clicked 1') } },
    { label:'Another Thing', icon:'images/icons/receipt-text.png',        action:function() { alert('clicked 2') } },
    null, // divider
    { label:'Blah Blah',     icon:'images/icons/book-open-list.png',      action:function() { alert('clicked 3') } }
  ];

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



