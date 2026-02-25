// ======================
// SLAVE - FINAL STABLE
// ======================

var COMPANY_ID = 0x1234;
var SLAVE_ID = 1; // CHANGE PER DEVICE

// Packet Types
var TYPE_EVENT = 1;
var TYPE_ACK = 2;
var TYPE_MASTER_DEAD = 3;
var TYPE_MASTER_ALIVE = 4;

// Timing
var EVENT_WINDOW = 1200;        // short broadcast
var ACK_TIMEOUT = 5000;        // wait for ACK
var MASTER_DEAD_TIME = 120000; // 2 minutes

// States
var STATE_IDLE = 0;
var STATE_WAITING_ACK = 1;
var STATE_MASTER_DEAD = 2;

var state = STATE_IDLE;
var seq = 0;
var wasDead = false;
var ackTimer = null;
var deadTimer = null;
var ledTimer = null;


// ===== LED CONTROL =====
function clearLEDs() {
  LED1.reset();
  LED2.reset();
  LED3.reset();
}

function show(color, duration) {

  if (ledTimer) {
    clearTimeout(ledTimer);
    ledTimer = null;
  }

  clearLEDs();

  if (color === 1) LED1.set();                 // green
  if (color === 2) LED3.set();                 // blue
  if (color === 3) { LED1.set(); LED2.set(); } // yellow
  if (color === 4) LED2.set();                 // red

  ledTimer = setTimeout(function() {
    clearLEDs();
    ledTimer = null;
  }, duration);
}


// ===== PACKET BUILDERS =====
function buildEvent(count) {
  var b = new Uint8Array(4);
  b[0] = TYPE_EVENT;
  b[1] = SLAVE_ID;
  b[2] = count;
  b[3] = seq;
  return b;
}

function buildMasterDead() {
  return new Uint8Array([TYPE_MASTER_DEAD]);
}

function buildMasterAlive() {
  return new Uint8Array([TYPE_MASTER_ALIVE]);
}


// ===== ADVERTISING =====
function advertise(bytes, interval) {
  NRF.setAdvertising({}, {
    manufacturer: COMPANY_ID,
    manufacturerData: bytes,
    interval: interval
  });
}


// ===== SEND EVENT =====
function sendEvent(count) {

  // Block only if already waiting for ACK
  if (state === STATE_WAITING_ACK) return;

  seq = (seq + 1) % 256;
  wasDead = (state === STATE_MASTER_DEAD);
  state = STATE_WAITING_ACK;

  if (ackTimer) {
    clearTimeout(ackTimer);
    ackTimer = null;
  }

  advertise(buildEvent(count), 250);
  show(count, 500);

  // Stop advertising quickly
  setTimeout(function() {
    NRF.setAdvertising({}, {});
    NRF.setScan(scanHandler, { active:false });
  }, EVENT_WINDOW);

  // Wait for ACK
  ackTimer = setTimeout(function() {
    if (state === STATE_WAITING_ACK) {
      triggerMasterDead();
    }
  }, ACK_TIMEOUT);
}


// ===== MASTER DEAD =====
function triggerMasterDead() {

  state = STATE_MASTER_DEAD;

  if (deadTimer) {
    clearTimeout(deadTimer);
    deadTimer = null;
  }

  advertise(buildMasterDead(), 500);
  show(2, MASTER_DEAD_TIME);

  deadTimer = setTimeout(function() {
    NRF.setAdvertising({}, {});
    state = STATE_IDLE;
  }, MASTER_DEAD_TIME);
}


// ===== MASTER ALIVE =====
function sendMasterAlive() {

  advertise(buildMasterAlive(), 400);

  setTimeout(function() {
    NRF.setAdvertising({}, {});
  }, 2000);
}


// ===== SCAN HANDLER =====
function scanHandler(device) {

  if (!device.manufacturerData) return;
  if (device.manufacturer !== COMPANY_ID) return;

  var d = device.manufacturerData;

  // ----- ACK -----
  if (d[0] === TYPE_ACK && d.length >= 3) {

    var ackSlave = d[1];
    var ackSeq = d[2];

    if (state === STATE_WAITING_ACK &&
        ackSlave === SLAVE_ID &&
        ackSeq === seq) {

      clearTimeout(ackTimer);
      ackTimer = null;

      NRF.setAdvertising({}, {});

      // If recovering from dead state
      if (wasDead) {
        sendMasterAlive();
        wasDead = false;
      }

      state = STATE_IDLE;
      clearLEDs();
    }
  }

  // ----- MASTER DEAD from another slave -----
  if (d[0] === TYPE_MASTER_DEAD) {

    state = STATE_MASTER_DEAD;

    if (deadTimer) clearTimeout(deadTimer);

    show(2, MASTER_DEAD_TIME);

    deadTimer = setTimeout(function() {
      state = STATE_IDLE;
      clearLEDs();
    }, MASTER_DEAD_TIME);
  }

  // ----- MASTER ALIVE -----
  if (d[0] === TYPE_MASTER_ALIVE) {

    state = STATE_IDLE;

    if (deadTimer) clearTimeout(deadTimer);
    NRF.setAdvertising({}, {});
    clearLEDs();
  }
}


// Start scanning immediately
NRF.setScan(scanHandler, { active:false });


// ===== BUTTON HANDLING =====
var pressStart = 0;
var clickTimer = null;
var clickCount = 0;

setWatch(function(e) {

  if (e.state) {
    pressStart = getTime();
  } else {

    var duration = getTime() - pressStart;

    // Long press
    if (duration > 1.5) {
      sendEvent(4);
      return;
    }

    clickCount++;

    if (clickTimer) clearTimeout(clickTimer);

    clickTimer = setTimeout(function() {

      if (clickCount === 1) sendEvent(1);
      if (clickCount === 2) sendEvent(2);
      if (clickCount === 3) sendEvent(3);

      clickCount = 0;
      clickTimer = null;

    }, 400);
  }

}, BTN, { repeat:true, edge:"both", debounce:50 });
