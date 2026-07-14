'use strict';

const MAX_EVENTS = 500;

function createEventBus() {
  const events = [];

  function emit(type, payload = {}) {
    const ev = { type, ts: Date.now(), ...payload };
    events.push(ev);
    if (events.length > MAX_EVENTS) events.shift();
    return ev;
  }

  function list(limit = 50) {
    return events.slice(-limit);
  }

  return { emit, list };
}

module.exports = { createEventBus };