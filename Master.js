// ======================
// MASTER - FINAL CLEAN
// ======================

const COMPANY_ID = 0x1234;

// Packet Types
const TYPE_EVENT = 1;
const TYPE_ACK = 2;
const TYPE_MASTER_DEAD = 3;
const TYPE_MASTER_ALIVE = 4;

// Timing
const FLASH_DURATION = 20000;
const ACK_DURATION = 600;

// ----- LED State -----
let ledTimer = null;
let busy = false;
let currentColor = 0;

function clearLEDS() {
  [LED1, LED2, LED3].forEach((led) => led.reset());
}

function flash(color, duration) {
  if (busy) {
    if (currentColor === color) {
      clearTimeout(ledTimer);
      ledTimer = setTimeout(() => {
        clearLEDS();
        busy = false;
        ledTimer = null;
      }, duration);
    }
    return;
  }

  busy = true;
  currentColor = color;

  if (ledTimer) {
    clearTimeout(ledTimer);
    ledTimer = null;
  }

  clearLEDS();

  if (color === 1) {
    LED1.set();
  }

  if (color === 2) {
    LED3.set();
  }

  if (color === 3) {
    LED1.set();
    LED2.set();
  }

  if (color === 4) {
    LED2.set();
  }

  ledTimer = setTimeout(() => {
    clearLEDS();
    busy = false;
    ledTimer = null;
  }, duration);
}

// ----- Packet Builder -----
function buildAck(slaveID, seq) {
  const bytes = new Uint8Array(3);
  bytes[0] = TYPE_ACK;
  bytes[1] = slaveID;
  bytes[2] = seq;
  return bytes;
}

// ----- Duplicate Protection -----
let lastKey = "";

// ----- Scan Handler -----
function scanHandler(device) {
  if (!device.manufacturerData) {
    return;
  }

  if (device.manufacturer !== COMPANY_ID) {
    return;
  }

  const data = device.manufacturerData;

  if (data[0] === TYPE_EVENT && data.length >= 4) {
    const slaveID = data[1];
    const count = data[2];
    const seq = data[3];

    const key = `${slaveID}-${seq}`;

    if (key === lastKey) {
      return;
    }

    lastKey = key;
    console.log("EVENT from", slaveID, "count", count, "seq", seq);
    flash(count, FLASH_DURATION);
    sendAck(slaveID, seq);
  }
}

// ----- Start Scan -----
function startScan() {
  NRF.setScan(scanHandler, { active: false });
}

// ----- Send ACK -----
function sendAck(slaveID, seq) {
  const ack = buildAck(slaveID, seq);

  NRF.setScan();

  NRF.setAdvertising({}, {
    manufacturer: COMPANY_ID,
    manufacturerData: ack,
    interval: 300,
  });

  setTimeout(() => {
    NRF.setAdvertising({}, {});
    startScan();
  }, ACK_DURATION);
}

// ----- Boot -----
startScan();
