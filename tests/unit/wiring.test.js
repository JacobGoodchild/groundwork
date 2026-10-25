import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { route, pathData, crossing, nearMiss, HOP_RADIUS } from '../../logic/wiring.js';

const w = (key, source, ax, ay, bx, by) => ({ key, source, a: { x: ax, y: ay }, b: { x: bx, y: by } });

const allStraightSegments = (points) => points.every((p, i) => i === 0 || p.x === points[i - 1].x || p.y === points[i - 1].y);

describe('right-angle routing', () => {
  test('a wire is made of horizontal and vertical runs', () => {
    const { wires } = route([w('1', 's', 100, 100, 300, 200)], 'right-angle');
    const { points } = wires.get('1');
    assert.ok(allStraightSegments(points));
    assert.deepEqual(points[0], { x: 100, y: 100 });
    assert.deepEqual(points.at(-1), { x: 300, y: 200 });
    assert.equal(points.length, 4);
  });

  test('a level wire is one straight run', () => {
    const { wires } = route([w('1', 's', 100, 100, 300, 100)], 'right-angle');
    assert.equal(wires.get('1').points.length, 2);
  });

  test('different signals get separate vertical lanes', () => {
    // Two sources whose vertical runs would otherwise sit on top of each other.
    const { wires } = route([
      w('1', 'A', 100, 100, 300, 300),
      w('2', 'B', 100, 300, 300, 100),
    ], 'right-angle');
    const laneX = (k) => wires.get(k).points[1].x;
    assert.ok(Math.abs(laneX('1') - laneX('2')) >= 16);
  });

  test('a wire going backwards loops round', () => {
    const { wires } = route([w('1', 's', 400, 100, 200, 300)], 'right-angle');
    const { points } = wires.get('1');
    assert.ok(allStraightSegments(points));
    assert.ok(points.length > 4);
  });
});

describe('avoiding wires that look joined', () => {
  test('nearMiss() spots a run passing just past the end of another', () => {
    const v = [{ x: 50, y: 0 }, { x: 50, y: 100 }];
    assert.equal(nearMiss([{ x: 0, y: 105 }, { x: 100, y: 105 }], v), true);
    assert.equal(nearMiss([{ x: 0, y: 100 }, { x: 100, y: 100 }], v), true);
    assert.equal(nearMiss([{ x: 0, y: 130 }, { x: 100, y: 130 }], v), false);
    assert.equal(nearMiss([{ x: 0, y: 50 }, { x: 100, y: 50 }], v), false);
  });

  test('half adder: the two signals cross once, cleanly, with a hop', () => {
    // The half adder's pin positions: A and B each feed the XOR and the AND.
    const { wires } = route([
      w('x0', 'A', 146.8, 172.4, 400, 166.8),
      w('x1', 'B', 146.8, 352.4, 400, 194.8),
      w('a0', 'A', 146.8, 172.4, 400, 346.8),
      w('a1', 'B', 146.8, 352.4, 400, 374.8),
    ], 'right-angle');
    const all = [...wires.values()];
    const hops = all.reduce((n, x) => n + x.hops.length, 0);
    assert.equal(hops, 1);
    // No horizontal run of one signal ends up just past the end of the other's lane.
    const segs = (k) => wires.get(k).points.slice(1).map((p, i) => [wires.get(k).points[i], p]);
    for (const h of [...segs('x0'), ...segs('a0')]) for (const v of [...segs('x1'), ...segs('a1')]) {
      assert.equal(nearMiss(h, v) || nearMiss(v, h), false);
    }
  });
});

describe('junction dots', () => {
  test('a signal split three ways has dots at the T-junctions only', () => {
    const { junctions } = route([
      w('1', 'A', 100, 200, 300, 100),
      w('2', 'A', 100, 200, 300, 200),
      w('3', 'A', 100, 200, 300, 300),
    ], 'right-angle');
    // The middle branch meets the source run and the lane going up and down.
    assert.equal(junctions.length, 1);
    assert.equal(junctions[0].y, 200);
  });

  test('a signal split two ways off the top has a dot where it branches', () => {
    const { junctions } = route([
      w('1', 'A', 100, 100, 300, 150),
      w('2', 'A', 100, 100, 300, 300),
    ], 'right-angle');
    assert.deepEqual(junctions.map((j) => j.y), [150]);
  });

  test('a single wire has no dots', () => {
    assert.equal(route([w('1', 'A', 100, 100, 300, 300)], 'right-angle').junctions.length, 0);
  });
});

describe('hops', () => {
  test('crossing() finds a crossing away from the ends', () => {
    assert.deepEqual(crossing([{ x: 0, y: 50 }, { x: 100, y: 50 }], [{ x: 50, y: 0 }, { x: 50, y: 100 }]), { x: 50, y: 50 });
    assert.equal(crossing([{ x: 0, y: 50 }, { x: 100, y: 50 }], [{ x: 0, y: 60 }, { x: 100, y: 60 }]), null);
    assert.equal(crossing([{ x: 0, y: 50 }, { x: 100, y: 50 }], [{ x: 2, y: 0 }, { x: 2, y: 100 }]), null);
  });

  test('crossing wires of different signals get a hop on the horizontal run', () => {
    // A runs level straight across; B's vertical lane cuts through it.
    const { wires } = route([
      w('1', 'A', 50, 200, 500, 200),
      w('2', 'B', 200, 100, 450, 300),
    ], 'right-angle');
    assert.equal(wires.get('1').hops.length, 1);
    assert.equal(wires.get('2').hops.length, 0);
    assert.equal(wires.get('1').hops[0].y, 200);
  });

  test('wires of the same signal never hop over each other', () => {
    const { wires } = route([
      w('1', 'A', 100, 100, 300, 300),
      w('2', 'A', 100, 100, 300, 50),
    ], 'straight');
    assert.equal(wires.get('1').hops.length + wires.get('2').hops.length, 0);
  });

  test('straight wires that cross get one hop', () => {
    const { wires } = route([
      w('1', 'A', 0, 0, 100, 100),
      w('2', 'B', 0, 100, 100, 0),
    ], 'straight');
    assert.equal(wires.get('1').hops.length + wires.get('2').hops.length, 1);
  });

  test('a hop is drawn as an arc in the path', () => {
    const d = pathData({ points: [{ x: 0, y: 50 }, { x: 100, y: 50 }], hops: [{ seg: 0, x: 50, y: 50 }] });
    assert.equal(d, `M0 50 L${50 - HOP_RADIUS} 50 A${HOP_RADIUS} ${HOP_RADIUS} 0 0 1 ${50 + HOP_RADIUS} 50 L100 50`);
  });

  test('a path without hops is a plain polyline', () => {
    assert.equal(pathData({ points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 20 }], hops: [] }), 'M0 0 L10 0 L10 20');
  });
});
