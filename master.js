// ======================
// MASTER
// ======================

var COMPANY_ID = 0x1234;

// Packet Types
var TYPE_EVENT = 1;
var TYPE_ACK = 2;
var TYPE_MASTER_DEAD = 3;
var TYPE_MASTER_ALIVE = 4;

var FLASH_DURATION = 20000;
var ACK_DURATION = 1200;

// ----- LED -----
var ledTimer = null;
var busy = false;

function clearLEDs() {
  LED1.reset();
  LED2.reset();
  LED3.reset();
}

function flash(color, duration) {

  if (busy) return;

  busy = true;

  if (ledTimer) {
    clearTimeout(ledTimer);
    ledTimer = null;
  }

  clearLEDs();

  if (color === 1) LED1.set();
  if (color === 2) LED3.set();
  if (color === 3) { LED1.set(); LED2.set(); }
  if (color === 4) LED2.set();

  ledTimer = setTimeout(function() {
    clearLEDs();
    busy = false;
    ledTimer = null;
  }, duration);
}

function buildAck(slaveID, seq) {
  var b = new Uint8Array(3);
  b[0] = TYPE_ACK;
  b[1] = slaveID;
  b[2] = seq;
  return b;
}

var lastKey = "";

function scanHandler(device) {

  if (!device.manufacturerData) return;
  if (device.manufacturer !== COMPANY_ID) return;

  var d = device.manufacturerData;

  if (d[0] === TYPE_EVENT && d.length >= 4) {

    var slaveID = d[1];
    var count   = d[2];
    var seq     = d[3];

    var key = slaveID + "-" + seq;
    if (key === lastKey) return;
    lastKey = key;

    console.log("EVENT from", slaveID, "count", count, "seq", seq);

    flash(count, FLASH_DURATION);

    sendAck(slaveID, seq);
  }
}

function startScan() {
  NRF.setScan(scanHandler, { active:false });
}

function sendAck(slaveID, seq) {

  var ack = buildAck(slaveID, seq);

  NRF.setScan();

  NRF.setAdvertising({}, {
    manufacturer: COMPANY_ID,
    manufacturerData: ack,
    interval: 300
  });

  setTimeout(function() {
    NRF.setAdvertising({}, {});
    startScan();
  }, ACK_DURATION);
}

startScan();
