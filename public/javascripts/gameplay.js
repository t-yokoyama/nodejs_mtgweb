
function generateCard(image) {

  // 'static' counter for incrementing card IDs
  if (typeof generateCard.numGenerated == 'undefined') {
    generateCard.numGenerated = 0;
  }

  var cid = generateCard.numGenerated++;

  // outer card element for positional changes
  var handleElement = document.createElement("div");
  handleElement.id = "h" + cid;
  handleElement.setAttribute("class", "cardhandle card_own rcmenu_target");

  // inner card element for visual changes
  var canvasElement = document.createElement("div");
  canvasElement.id = cid;
  canvasElement.setAttribute("class", "cardcanvas");
  canvasElement.setAttribute("data-toggle", "context");

  handleElement.appendChild(canvasElement);
  document.getElementById("my_battlefield").appendChild(handleElement);

  var $cardCanvas = $("#" + cid);
  var $cardHandle = $("#h" + cid);
  $cardCanvas.css("zIndex", 10); // FIXME
  $cardCanvas.css("background-image", "url(images/cards/back.jpg)");

  var cardEntry = {
    canvas : $cardCanvas,
    handle : $cardHandle,
    imgSrc : "url(" + image + ")",
    zone : ZoneEnum.LIBRARY,
    faceUp : false,
    tapped : false,
    flipped : false,
    transformed : false,
    numCounters : 0
  };

  g_directory.push(cardEntry);
  g_library.push(cid);

  updateCardPosition(cid, ZoneEnum.LIBRARY);
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

function moveCardToZone(cid, toZone, shiftHeld) {

  var $cardCanvas = g_directory[cid].canvas;

  // update card position (regardless of zone change)
  updateCardPosition(cid, toZone);

  // check if we need to actually do anything else
  var fromZone = g_directory[cid].zone;
  if (fromZone === toZone) {

    // if we're about to abort, and there's a possibility that
    // the user moved a 'hand' card around, refresh the hand 
    if (toZone === ZoneEnum.HAND) {
      refreshHand();
    }

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
      pos = g_hand.indexOf(cid);
      g_hand.splice(pos, 1);
      refHand = true;
      break;

    case ZoneEnum.LIBRARY:
      pos = g_library.indexOf(cid);
      g_library.splice(pos, 1);
      refLibrary = true;
      break;

    case ZoneEnum.GRAVEYARD:
      pos = g_graveyard.indexOf(cid);
      g_graveyard.splice(pos, 1);
      refGraveyard = true;
      break;

    case ZoneEnum.EXILE:
      pos = g_exile.indexOf(cid);
      g_exile.splice(pos, 1);
      $cardCanvas.removeClass("cardcanvas_exiled");
      refExile = true;
      break;
  }

  // switch on dest zone, then add to new array
  var turnFaceUp;
  switch(toZone) {

    case ZoneEnum.BATTLEFIELD:
      turnFaceUp = !shiftHeld;
      break;

    case ZoneEnum.HAND:
      g_hand.push(cid);
      turnFaceUp = true;
      refHand = true;
      break;

    case ZoneEnum.LIBRARY:
      g_library.push(cid);
      turnFaceUp = false;
      refLibrary = true;
      break;

    case ZoneEnum.GRAVEYARD:
      g_graveyard.push(cid);
      turnFaceUp = true;
      refGraveyard = true;
      break;

    case ZoneEnum.EXILE:
      g_exile.push(cid);
      turnFaceUp = !shiftHeld;
      $cardCanvas.addClass("cardcanvas_exiled");
      refExile = true;
      break;
  }

  $cardCanvas.removeClass("cardcanvas_tapped");

  // update directory
  g_directory[cid].zone = toZone;
  g_directory[cid].tapped = false;
  g_directory[cid].flipped = false;
  g_directory[cid].transformed = false;
  g_directory[cid].numCounters = 0;

  // toggle face up/down as appropriate
  if (g_directory[cid].faceUp && !turnFaceUp) {
    $cardCanvas.css("background-image", "url(images/cardback.jpg)");
    g_directory[cid].faceUp = false;
  }
  else if (!g_directory[cid].faceUp && turnFaceUp) {
    $cardCanvas.css("background-image", g_directory[cid].imgSrc);
    g_directory[cid].faceUp = true;
  }

  // refresh display on both to/from zones
  if (refHand) {
    refreshHand();
  }
  if (refLibrary) {
    refreshLibrary();
  }
  if (refGraveyard) {
    refreshGraveyard();
  }
  if (refExile) {
    refreshExile();
  }

  // FIXME notify other client of state change
}

function updateCardPosition(cid, toZone) {

  var $cardHandle = g_directory[cid].handle;

  switch(toZone) {

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

function refreshLibrary() {
  var offset = $("#library").offset();
  var z = offset.top * ZWIDTH + offset.left;
  var numCards = g_library.length;
  for (var i = 0; i < numCards; i++) {
    var cid = g_library[i];
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

function refreshGraveyard() {
  var offset = $("#graveyard").offset();
  var z = offset.top * ZWIDTH + offset.left;
  var numCards = g_graveyard.length;
  for (var i = 0; i < numCards; i++) {
    var cid = g_graveyard[i];
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

function refreshExile() {
  var offset = $("#exile").offset();
  var z = offset.top * ZWIDTH + offset.left;
  var numCards = g_exile.length;
  for (var i = 0; i < numCards; i++) {
    var cid = g_exile[i];
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

function refreshHand() {
  var offset = $("#hand").offset();
  var zbase = offset.top * ZWIDTH;
  var numCards = g_hand.length;
  var totalWidth = $("#hand").width() - 100;
  for (var i = 0; i < numCards; i++) {
    var cid = g_hand[i];
    var $cardHandle = g_directory[cid].handle;
    var left = Math.floor(i * Math.min(totalWidth / (numCards - 1), 100));
    $cardHandle.css("left", left);
    $cardHandle.css("zIndex", zbase + left);
  }
}

function highlightCard(cid) {
  g_directory[cid].canvas.addClass("cardcanvas_hover");
  g_directory[cid].handle.css("zIndex", ZTOP);
}

function unhighlightCard(cid) {
  g_directory[cid].canvas.removeClass("cardcanvas_hover");
  var offset = g_directory[cid].handle.offset();
  g_directory[cid].handle.css("zIndex", offset.top * ZWIDTH + offset.left);
}




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
  window.g_library = [];
  window.g_graveyard = [];
  window.g_exile = [];
  window.g_hand = [];

  window.g_shiftHeld = false;
  window.g_rcmenuActive = false;
  window.g_rcCardId = -1;
}

/*
  // temporary code to load some dummy cards
  generateCard(0, "images/seraph_of_dawn.jpg");
  generateCard(1, "images/wild_hunger.jpg");
  generateCard(2, "images/myr_sire.jpg");
  generateCard(3, "images/affa_guard_hound.jpg");
  generateCard(4, "images/lightning_bolt.jpg");
  generateCard(5, "images/resounding_wave.jpg");
  generateCard(6, "images/forest.jpg");
  generateCard(7, "images/affa_guard_hound.jpg");
  generateCard(8, "images/lightning_bolt.jpg");
  generateCard(9, "images/resounding_wave.jpg");
  generateCard(10, "images/seraph_of_dawn.jpg");
  generateCard(11, "images/wild_hunger.jpg");
  generateCard(12, "images/myr_sire.jpg");
  generateCard(13, "images/affa_guard_hound.jpg");
  generateCard(14, "images/lightning_bolt.jpg");
  generateCard(15, "images/resounding_wave.jpg");        
  generateCard(16, "images/forest_full.jpg");
  generateCard(17, "images/island_full.jpg");
  generateCard(18, "images/mountain_full.jpg");
  generateCard(19, "images/forest_full.jpg");
*/

function enableInteractivity() {

  $(".cardhandle").draggable({ grid: [5, 20],
                            snap: ".zone",
                            snapMode: "inner",
                            snapTolerance: 10,
                            containment: "#battlefield_wrapper"});

  $("#battlefield_wrapper").droppable({
    accept: ".cardhandle",
    drop: function( event, ui ) {
      moveCardToZone(getCID(ui.draggable),
                     ZoneEnum.BATTLEFIELD,
                     g_shiftHeld);
    }
  });

  $("#hand").droppable({
    accept: ".cardhandle",
    greedy: true,
    hoverClass: "zone_hover",
    drop: function( event, ui ) {
      moveCardToZone(getCID(ui.draggable),
                     ZoneEnum.HAND,
                     g_shiftHeld);
    }
  });

  $("#library").droppable({
    accept: ".cardhandle",
    greedy: true,
    hoverClass: "zone_hover",
    drop: function( event, ui ) {
      moveCardToZone(getCID(ui.draggable),
                     ZoneEnum.LIBRARY,
                     g_shiftHeld);
    }
  });

  $("#graveyard").droppable({
    accept: ".cardhandle",
    greedy: true,
    hoverClass: "zone_hover",
    drop: function( event, ui ) {
      moveCardToZone(getCID(ui.draggable),
                     ZoneEnum.GRAVEYARD,
                     g_shiftHeld);
    }
  });

  $("#exile").droppable({
    accept: ".cardhandle",
    greedy: true,
    hoverClass: "zone_hover",
    drop: function( event, ui ) {
      moveCardToZone(getCID(ui.draggable),
                     ZoneEnum.EXILE,
                     g_shiftHeld);
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
  });

  // uses the bootstrap-contextmenu library to implement a right-click menu
  $('.rcmenu_target').contextmenu({
    target: '#rcmenu_forcards',
    before: function (e, context) {
      g_rcmenuActive = true;
      g_rcCardId = getCID(context);
      highlightCard(g_rcCardId);
      
      // this.getMenu().find("li").eq(2).find('a').html("This was dynamically changed");
    },
    onItem: function (context, e) {
      // alert($(e.target).text());
    }
  });

  $('#rcmenu_forcards').on('hidden.bs.context', function (e) {
    g_rcmenuActive = false;
    unhighlightCard(g_rcCardId);
  });

  // left mouse click to tap/untap a card
  $(".cardhandle").click(function() {
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
