// Wire routing for circuit diagrams. No DOM code, so it can be unit-tested.
//
// route() turns wire endpoints into polylines for the 'right-angle' and
// 'straight' styles, finds junction dots (where one signal splits) and hops
// (where two different signals cross without connecting). pathData() turns
// a routed wire into SVG path data with the hops drawn as small arcs.

export const WIRE_STYLES = {
  curved: 'Curved',
  'right-angle': 'Right angles',
  straight: 'Straight',
};

export const HOP_RADIUS = 6;
const LANE_GAP = 16;       // minimum distance between vertical runs of different signals
const STUB = 15;           // horizontal stub before a wire turns back on itself
const END_MARGIN = 9;      // no hop this close to a bend or an end

/**
 * items: [{ key, source, a: {x, y}, b: {x, y} }] where `a` is the output pin
 * the wire starts at and `b` the input pin it ends at. Wires with the same
 * `source` carry the same signal.
 * Returns { wires: Map key -> { points, hops: [{ seg, x, y }] }, junctions: [{ x, y, source }] }.
 */
export function route(items, style) {
  const wires = new Map();
  const junctions = [];

  if (style === 'straight') {
    for (const it of items) wires.set(it.key, { points: [it.a, it.b], hops: [] });
  } else {
    routeRightAngles(items, wires, junctions);
  }

  addHops(items, wires, style);
  return { wires, junctions };
}

function routeRightAngles(items, wires, junctions) {
  const bySource = new Map();
  for (const it of items) {
    if (!bySource.has(it.source)) bySource.set(it.source, []);
    bySource.get(it.source).push(it);
  }

  // Sources with the most wires choose their vertical lane first.
  const groups = [...bySource.values()].sort((p, q) => q.length - p.length);
  const placed = []; // { source, points } for every wire routed so far

  for (const group of groups) {
    const source = group[0].source;
    const a = group[0].a;
    // A pin within a pixel of the source's height counts as level with it.
    const level = (it) => (Math.abs(it.b.y - a.y) < 1 ? a.y : it.b.y);
    const forward = group.filter((it) => it.b.x - a.x >= 2 * LANE_GAP);
    const backward = group.filter((it) => it.b.x - a.x < 2 * LANE_GAP);

    if (forward.length) {
      const nearest = Math.min(...forward.map((it) => it.b.x));
      const lo = a.x + LANE_GAP;
      const hi = nearest - LANE_GAP;
      const ideal = Math.round(Math.min(Math.max((a.x + nearest) / 2, lo), hi));
      const build = (x) => forward.map((it) => {
        const y = level(it);
        const points = y === a.y ? [it.a, it.b] : [it.a, { x, y: a.y }, { x, y }, it.b];
        return { key: it.key, points: simplify(points) };
      });

      // Try lanes either side of the ideal position and keep the clearest.
      let best = null;
      for (let step = 0; step <= 40; step++) {
        const x = ideal + Math.ceil(step / 2) * LANE_GAP * (step % 2 ? 1 : -1);
        if (x < lo || x > hi) continue;
        const polys = build(x);
        const cost = polys.reduce((sum, w) => sum + routeCost(w.points, source, placed), 0) + Math.abs(x - ideal) * 0.01;
        if (!best || cost < best.cost) best = { x, polys, cost };
        if (cost < 0.5 && step > 0) break;
      }
      if (!best) best = { x: ideal, polys: build(ideal) };

      for (const w of best.polys) {
        wires.set(w.key, { points: w.points, hops: [] });
        placed.push({ source, points: w.points });
      }
      const levelled = forward.map((it) => ({ ...it, b: { x: it.b.x, y: level(it) } }));
      junctions.push(...junctionDots(a, best.x, levelled, source));
    }

    for (const it of backward) {
      // Go out to the right, along, then back in from the left.
      const far = Math.abs(it.a.y - it.b.y) > 50;
      const ym = far ? (it.a.y + it.b.y) / 2 : Math.max(it.a.y, it.b.y) + 50;
      const points = simplify([
        it.a, { x: it.a.x + STUB, y: it.a.y }, { x: it.a.x + STUB, y: ym },
        { x: it.b.x - STUB, y: ym }, { x: it.b.x - STUB, y: it.b.y }, it.b,
      ]);
      wires.set(it.key, { points, hops: [] });
      placed.push({ source, points });
    }
  }
}

// How untidy a new wire would be next to the wires already placed:
// sitting on top of another signal is worst, a near miss (which looks like
// a join) is bad, and a clean crossing costs a little.
function routeCost(points, source, placed) {
  let cost = 0;
  for (const other of placed) {
    if (other.source === source) continue;
    for (const s1 of segments(points)) {
      for (const s2 of segments(other.points)) {
        if (overlapping(s1, s2)) cost += 100;
        else if (nearMiss(s1, s2) || nearMiss(s2, s1)) cost += 6;
        else if (crossing(s1, s2, 1, 1)) cost += 1;
      }
    }
  }
  return cost;
}

// Two parallel runs too close together to tell apart.
function overlapping([p1, p2], [p3, p4]) {
  const between = (v, a, b) => v > Math.min(a, b) - 4 && v < Math.max(a, b) + 4;
  if (isVertical([p1, p2]) && isVertical([p3, p4]) && Math.abs(p1.x - p3.x) < LANE_GAP) {
    return between(p1.y, p3.y, p4.y) || between(p2.y, p3.y, p4.y) || between(p3.y, p1.y, p2.y);
  }
  if (isHorizontal([p1, p2]) && isHorizontal([p3, p4]) && Math.abs(p1.y - p3.y) < 6) {
    return between(p1.x, p3.x, p4.x) || between(p2.x, p3.x, p4.x) || between(p3.x, p1.x, p2.x);
  }
  return false;
}

// A horizontal run that passes just beyond (or exactly at) the end of
// another signal's vertical run, so the two look joined.
const NEAR = 8;
export function nearMiss(h, v) {
  if (!isHorizontal(h) || !isVertical(v)) return false;
  const [hp, hq] = h;
  const x = v[0].x;
  if (x <= Math.min(hp.x, hq.x) + 3 || x >= Math.max(hp.x, hq.x) - 3) return false;
  const top = Math.min(v[0].y, v[1].y);
  const bottom = Math.max(v[0].y, v[1].y);
  const y = hp.y;
  return (y <= top && top - y <= NEAR) || (y >= bottom && y - bottom <= NEAR);
}

// A dot goes wherever three or more arms of the same signal meet (a T).
function junctionDots(a, x, forward, source) {
  const ys = [...new Set([a.y, ...forward.map((it) => it.b.y)])];
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  const dots = [];
  for (const y of ys) {
    let arms = 0;
    if (y === a.y) arms++;                                  // in from the source
    if (forward.some((it) => it.b.y === y && it.b.x > x)) arms++; // out to a pin
    if (top < y) arms++;                                    // up the lane
    if (bottom > y) arms++;                                 // down the lane
    if (arms >= 3) dots.push({ x, y, source });
  }
  return dots;
}

// Remove repeated points and points in the middle of a straight run.
function simplify(points) {
  const out = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (last && last.x === p.x && last.y === p.y) continue;
    if (out.length >= 2) {
      const prev = out[out.length - 2];
      if ((prev.x === last.x && last.x === p.x) || (prev.y === last.y && last.y === p.y)) {
        out[out.length - 1] = p;
        continue;
      }
    }
    out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Hops
// ---------------------------------------------------------------------------

function segments(points) {
  const segs = [];
  for (let i = 0; i < points.length - 1; i++) segs.push([points[i], points[i + 1]]);
  return segs;
}

// Where two segments cross, away from their ends. m1 and m2 are how far (in
// pixels) the crossing must be from the ends of each segment.
export function crossing([p1, p2], [p3, p4], m1 = END_MARGIN, m2 = END_MARGIN) {
  const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
  if (Math.abs(d) < 1e-9) return null; // parallel or overlapping
  const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
  const u = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;
  const len1 = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  const len2 = Math.hypot(p4.x - p3.x, p4.y - p3.y);
  const e1 = m1 / len1;
  const e2 = m2 / len2;
  if (t <= e1 || t >= 1 - e1 || u <= e2 || u >= 1 - e2) return null;
  return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
}

const isHorizontal = ([p, q]) => Math.abs(p.y - q.y) < 1;
const isVertical = ([p, q]) => Math.abs(p.x - q.x) < 1;

// Room for a hop on a segment at point p.
function roomFor([p, q], at) {
  const d1 = Math.hypot(at.x - p.x, at.y - p.y);
  const d2 = Math.hypot(at.x - q.x, at.y - q.y);
  return d1 >= HOP_RADIUS + 2 && d2 >= HOP_RADIUS + 2;
}

function addHops(items, wires, style) {
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (items[i].source === items[j].source) continue; // same signal: not a crossing
      const wi = wires.get(items[i].key);
      const wj = wires.get(items[j].key);
      segments(wi.points).forEach((s1, a) => {
        segments(wj.points).forEach((s2, b) => {
          if (style === 'straight') {
            // The wire drawn later hops.
            const p = crossing(s1, s2);
            if (p) wj.hops.push({ seg: b, ...p });
            return;
          }
          // Right angles: the horizontal run hops over the vertical one,
          // including near misses that would otherwise look like a join.
          let h = null;
          if (isHorizontal(s1) && isVertical(s2)) h = { w: wi, seg: a, hs: s1, vs: s2 };
          else if (isHorizontal(s2) && isVertical(s1)) h = { w: wj, seg: b, hs: s2, vs: s1 };
          if (!h) return;
          const at = { x: h.vs[0].x, y: h.hs[0].y };
          const crosses = crossing(h.hs, h.vs, 1, 1);
          if ((crosses || nearMiss(h.hs, h.vs)) && roomFor(h.hs, at)) h.w.hops.push({ seg: h.seg, ...at });
        });
      });
    }
  }
}

// ---------------------------------------------------------------------------
// SVG path data
// ---------------------------------------------------------------------------

const round = (n) => Math.round(n * 10) / 10;

export function pathData({ points, hops }, radius = HOP_RADIUS) {
  let d = `M${round(points[0].x)} ${round(points[0].y)}`;
  for (let s = 0; s < points.length - 1; s++) {
    const p = points[s];
    const q = points[s + 1];
    const len = Math.hypot(q.x - p.x, q.y - p.y);
    const ux = (q.x - p.x) / len;
    const uy = (q.y - p.y) / len;
    const here = hops
      .filter((h) => h.seg === s)
      .map((h) => ({ ...h, dist: Math.hypot(h.x - p.x, h.y - p.y) }))
      .sort((h1, h2) => h1.dist - h2.dist);
    let last = -Infinity;
    for (const h of here) {
      if (h.dist - radius < last + 2) continue; // too close to the previous hop
      // Arc bulges upwards on rightward runs; sweep 1 is clockwise on screen.
      const sweep = ux >= 0 ? 1 : 0;
      d += ` L${round(h.x - ux * radius)} ${round(h.y - uy * radius)}`;
      d += ` A${radius} ${radius} 0 0 ${sweep} ${round(h.x + ux * radius)} ${round(h.y + uy * radius)}`;
      last = h.dist + radius;
    }
    d += ` L${round(q.x)} ${round(q.y)}`;
  }
  return d;
}
