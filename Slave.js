// ======================
// SLAVE - FINAL (const/let)
// ======================

const COMPANY_ID = 0x1234;
const SLAVE_ID = 1; // CHANGE PER DEVICE

// Packet Types
const TYPE_EVENT = 1;
const TYPE_ACK = 2;
const TYPE_MASTER_DEAD = 3;
const TYPE_MASTER_ALIVE = 4;

// Timing
const EVENT_WINDOW = 1200;
const ACK_TIMEOUT = 5000;
const MASTER_DEAD_TIME = 120000;

// States
const STATE_IDLE = 0;
const STATE_WAITING_ACK = 1;
const STATE_MASTER_DEAD = 2;

let state = STATE_IDLE;
let seq = 0;
let wasDead = false;

let ackTimer = null;
let deadTimer = null;
let ledTimer = null;


// ===== LED CONTROL =====
function clearLEDS() {
  LED1.reset();
  LED2.reset();
  LED3.reset();
};

function show(color, duration) {
  if (ledTimer) {
    clearTimeout(ledTimer)
    ledTimer = null;
  };

  clearLEDS();

  if (color === 1) {
    LED1.set();
  };

  if (color === 2) {
    LED3.set();
  };

  if (color === 3) {
    LED1.set();
    LED2.set();
  };

  if (color === 4) {
    LED2.set();
  };

  ledTimer = setTimeout(() => {
    clearLEDS();
    ledTimer = null;
  }, duration)
};


// ===== PACKET BUILDERS =====
function buildEvent(count) {
  const bytes = new Uint8Array(4)

  bytes[0] = TYPE_EVENT;
  bytes[1] = SLAVE_ID;
  bytes[2] = count;
  bytes[3] = seq;

  return bytes;
};

function buildSingleBytePacket(type) {
  return new Uint8Array([type]);
};


// ===== ADVERTISING =====
function advertise(bytes, interval) {
  NRF.setAdvertising({}, {
    manufacturer: COMPANY_ID,
    manufacturerData: bytes,
    interval
  })
};


// ===== SEND EVENT =====
function sendEvent(count) {
  if (state === STATE_WAITING_ACK) {
    return;
  }

  seq = (seq + 1) % 256;

  wasDead = (state === STATE_MASTER_DEAD);
  state = STATE_WAITING_ACK;

  if (ackTimer) {
    clearTimeout(ackTimer);
    ackTimer = null;
  }

  advertise(buildEvent(count), 250);
  show(count, 500);

  setTimeout(() => {
    NRF.setAdvertising({}, {});
    NRF.setScan(scanHandler, { active: false });
  }, EVENT_WINDOW);

  ackTimer = setTimeout(() => {
    if (state === STATE_WAITING_ACK) {
      triggerMasterDead();
    }
  }, ACK_TIMEOUT);
};


// ===== MASTER DEAD =====
function triggerMasterDead() {
  state = STATE_MASTER_DEAD;

  if (deadTimer) {
    clearTimeout(deadTimer);
    deadTimer = null;
  }

  advertise(buildSingleBytePacket(TYPE_MASTER_DEAD), 500);
  show(2, MASTER_DEAD_TIME);

  deadTimer = setTimeout(() => {
    NRF.setAdvertising({}, {});
    state = STATE_IDLE;
  }, MASTER_DEAD_TIME);
};


// ===== MASTER ALIVE =====
function sendMasterAlive() {
  advertise(buildSingleBytePacket(TYPE_MASTER_ALIVE), 400);

  setTimeout(() => {
    NRF.setAdvertising({}, {});
  }, 2000);
};


// ===== SCAN HANDLER =====
function scanHandler(device) {
  if (!device.manufacturerData) {
    return;
  };

  if (device.manufacturer !== COMPANY_ID) {
    return;
  };

  const data = device.manufacturerData;

  // ----- ACK -----
  if (data[0] === TYPE_ACK && data.length >= 3) {
    const ackSlave = data[1];
    const ackSeq = data[2];

    if (
      state === STATE_WAITING_ACK &&
      ackSlave === SLAVE_ID &&
      ackSeq === seq
    ) {
      clearTimeout(ackTimer);
      ackTimer = null;

      NRF.setAdvertising({}, {});

      if (wasDead) {
        sendMasterAlive();
        wasDead = false;
      }

      state = STATE_IDLE;
      clearLEDS();
    }
  }

  // ----- MASTER DEAD from another slave -----
  if (data[0] === TYPE_MASTER_DEAD) {
    state = STATE_MASTER_DEAD;

    if (deadTimer) {
      clearTimeout(deadTimer);
    };

    show(2, MASTER_DEAD_TIME);

    deadTimer = setTimeout(() => {
      state = STATE_IDLE;
      clearLEDS();
    }, MASTER_DEAD_TIME);
  };

  // ----- MASTER ALIVE -----
  if (data[0] === TYPE_MASTER_ALIVE) {
    state = STATE_IDLE;

    if (deadTimer) {
      clearTimeout(deadTimer);
      deadTimer = null;
    };

    NRF.setAdvertising({}, {});
    clearLEDS();
  }
};


// ===== START SCANNING =====
NRF.setScan(scanHandler, { active: false });

// ===== BUTTON HANDLING =====
let pressStart = 0;
let clickTimer = null;
let clickCount = 0;

setWatch((e) => {
  if (e.state) {
    pressStart = getTime();
  } else {
    const duration = getTime() - pressStart;

    if (duration > 1.5) {
      sendEvent(4);
      return;
    }

    clickCount += 1;

    if (clickTimer) {
      clearTimeout(clickTimer);
    };

    clickTimer = setTimeout(() => {
      if (clickCount === 1) {
        sendEvent(1);
      };

      if (clickCount === 2) {
        sendEvent(2);
      };

      if (clickCount === 3) {
        sendEvent(3);
      };

      clickCount = 0
      clickTimer = null
    }, 400)
  }
}, BTN, { repeat: true, edge: 'both', debounce: 50 })
