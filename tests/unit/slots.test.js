import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readSlots, writeSlot, summary, SLOT_COUNT, SLOTS_KEY } from '../../logic/slots.js';
import { thumbnailSVG } from '../../logic/thumbnail.js';
import { emptyCircuit, clone } from '../../logic/logic.js';
import { EXAMPLES } from '../../logic/examples.js';

// A stand-in for localStorage.
function fakeStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    data,
  };
}

const halfAdder = () => clone(EXAMPLES.find((e) => e.id === 'half-adder').circuit);
const fullAdder = () => clone(EXAMPLES.find((e) => e.id === 'full-adder').circuit);

describe('saved circuit slots', () => {
  test('there are five slots, empty to start', () => {
    assert.equal(SLOT_COUNT, 5);
    assert.deepEqual(readSlots(fakeStorage()), [null, null, null, null, null]);
  });

  test('a circuit saved in a slot comes back unchanged', () => {
    const storage = fakeStorage();
    assert.ok(writeSlot(storage, 2, halfAdder(), 1000).ok);
    const slots = readSlots(storage);
    assert.deepEqual(slots[2].circuit, halfAdder());
    assert.equal(slots[2].savedAt, 1000);
    assert.equal(slots[0], null);
  });

  test('saving into a slot replaces only that slot', () => {
    const storage = fakeStorage();
    writeSlot(storage, 0, halfAdder(), 1);
    writeSlot(storage, 1, halfAdder(), 2);
    writeSlot(storage, 1, fullAdder(), 3);
    const slots = readSlots(storage);
    assert.deepEqual(slots[0].circuit, halfAdder());
    assert.deepEqual(slots[1].circuit, fullAdder());
  });

  test('an empty circuit or a bad slot number is refused', () => {
    const storage = fakeStorage();
    assert.match(writeSlot(storage, 0, emptyCircuit()).error, /nothing to save/);
    assert.match(writeSlot(storage, 5, halfAdder()).error, /no slot/);
  });

  test('damaged saved data counts as empty', () => {
    assert.deepEqual(readSlots(fakeStorage({ [SLOTS_KEY]: 'not json' })), [null, null, null, null, null]);
    const bad = JSON.stringify([{ circuit: { nodes: 'x', wires: [] }, savedAt: 1 }]);
    assert.equal(readSlots(fakeStorage({ [SLOTS_KEY]: bad }))[0], null);
  });

  test('a storage error is reported, not thrown', () => {
    const storage = { getItem: () => null, setItem: () => { throw new Error('full'); } };
    assert.match(writeSlot(storage, 0, halfAdder()).error, /would not let this page save/);
  });

  test('summary counts the parts', () => {
    assert.equal(summary(halfAdder()), '2 inputs, 2 gates, 2 outputs');
  });
});

describe('thumbnails', () => {
  test('draw every node and wire', () => {
    const svg = thumbnailSVG(fullAdder());
    assert.match(svg, /^<svg class="thumb"/);
    assert.equal((svg.match(/class="thumb-wire"/g) ?? []).length, fullAdder().wires.length);
    assert.equal((svg.match(/class="switch"/g) ?? []).length, 3);
    assert.equal((svg.match(/class="lamp"/g) ?? []).length, 2);
    assert.match(svg, />Cout</);
  });

  test('follow the wire style', () => {
    assert.match(thumbnailSVG(halfAdder()), /class="thumb-wire" d="M[^"]* C/);
    assert.doesNotMatch(thumbnailSVG(halfAdder(), { wireStyle: 'right-angle' }), /class="thumb-wire" d="M[^"]* C/);
  });

  test('an empty circuit has no picture', () => {
    assert.equal(thumbnailSVG(emptyCircuit()), '');
  });

  test('names are escaped', () => {
    const c = halfAdder();
    c.nodes[0].name = '<b>';
    assert.doesNotMatch(thumbnailSVG(c), /<b>/);
  });
});
