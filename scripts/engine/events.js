'use strict';

const MAX_EVENTS = 500;

function createEventBus(persistFn) {
  const events = [];

  function emit(type, payload = {}) {
    const ev = { type, ts: Date.now(), ...payload };
    events.push(ev);
    if (events.length > MAX_EVENTS) events.shift();
    // Persist to JSONL event store if configured
    if (persistFn) {
      try { persistFn(ev); } catch {}
    }
    return ev;
  }

  function list(limit = 50) {
    return events.slice(-limit);
  }

  return { emit, list };
}

module.exports = { createEventBus };
