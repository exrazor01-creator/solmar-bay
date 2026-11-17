// Solmar Bay — city generation and collision. Builds roads, blocks, buildings, trees,
// shops and spawn points from a seed; resolves circle-vs-building and circle-vs-world.
import { AVENUES, STREETS, ROAD_W, WORLD, BEACH_Y, PALETTE } from './config.js';
import { range, int, pick, chance } from './random.js';

const ROOFS = [PALETTE.roofA, PALETTE.roofB, PALETTE.roofC, PALETTE.roofD, PALETTE.roofE, PALETTE.roofF];

export function buildWorld(rng) {
  const buildings = [];
  const trees = [];
  const parks = [];
  // Blocks sit between neighbouring avenues / streets.
  const xs = [0, ...AVENUES, WORLD.w];
  const ys = [0, ...STREETS, BEACH_Y];
  for (let bi = 0; bi < xs.length - 1; bi += 1) {
    for (let bj = 0; bj < ys.length - 1; bj += 1) {
      const x0 = xs[bi] + ROAD_W / 2 + 14, x1 = xs[bi + 1] - ROAD_W / 2 - 14;
      const y0 = ys[bj] + ROAD_W / 2 + 14, y1 = ys[bj + 1] - ROAD_W / 2 - 14;
      if (x1 - x0 < 90 || y1 - y0 < 90) continue;
      if (chance(rng, 0.16)) { parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 }); continue; }
      const n = int(rng, 1, 3);
      for (let k = 0; k < n; k += 1) {
        const w = range(rng, 90, Math.min(220, x1 - x0));
        const h = range(rng, 80, Math.min(200, y1 - y0));
        const x = range(rng, x0, x1 - w), y = range(rng, y0, y1 - h);
        const b = { x, y, w, h, color: pick(rng, ROOFS), floors: int(rng, 2, 6), seed: rng() * 100 };
        if (buildings.some((o) => o.x < b.x + b.w + 18 && o.x + o.w + 18 > b.x && o.y < b.y + b.h + 18 && o.y + o.h + 18 > b.y)) continue;
        buildings.push(b);
      }
    }
  }
  // Palms along sidewalks and the beach front.
  for (let i = 0; i < 90; i += 1) {
    const av = pick(rng, AVENUES), st = pick(rng, STREETS);
    const side = chance(rng, 0.5);
    trees.push(side
      ? { x: av + (chance(rng, 0.5) ? 1 : -1) * (ROAD_W / 2 + 16), y: range(rng, 80, BEACH_Y - 80) }
      : { x: range(rng, 80, WORLD.w - 80), y: st + (chance(rng, 0.5) ? 1 : -1) * (ROAD_W / 2 + 16) });
  }
  for (let i = 0; i < 26; i += 1) trees.push({ x: range(rng, 120, WORLD.w - 120), y: range(rng, BEACH_Y + 30, WORLD.h - 90) });
  return { buildings, trees, parks };
}

export function onRoad(x, y) {
  if (y >= BEACH_Y) return false;
  for (const a of AVENUES) if (Math.abs(x - a) <= ROAD_W / 2) return true;
  for (const s of STREETS) if (Math.abs(y - s) <= ROAD_W / 2) return true;
  return false;
}

export function roadLane(x, y) {
  // Nearest road centre and which side of it the point sits on (+1 / -1).
  let best = null;
  for (const a of AVENUES) { const d = Math.abs(x - a); if (!best || d < best.d) best = { d, axis: 'x', c: a, side: x >= a ? 1 : -1 }; }
  for (const s of STREETS) { const d = Math.abs(y - s); if (!best || d < best.d) best = { d, axis: 'y', c: s, side: y >= s ? 1 : -1 }; }
  return best;
}

export function nearestIntersection(x, y) {
  let bx = AVENUES[0], by = STREETS[0], bd = Infinity;
  for (const a of AVENUES) for (const s of STREETS) {
    const d = (a - x) * (a - x) + (s - y) * (s - y);
    if (d < bd) { bd = d; bx = a; by = s; }
  }
  return { x: bx, y: by };
}

// Push a circle out of buildings and the world edge. Returns true when a hit happened.
export function collideCircle(G, x, y, r) {
  let hit = false;
  for (const b of G.world.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx, dy = y - cy, d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.01) {
        const d = Math.sqrt(d2), push = (r - d) / d;
        x += dx * push; y += dy * push;
      } else {
        // Centre inside the box: push out along the smallest penetration axis.
        const pl = x - b.x, pr = b.x + b.w - x, pt = y - b.y, pb = b.y + b.h - y;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) x = b.x - r; else if (m === pr) x = b.x + b.w + r;
        else if (m === pt) y = b.y - r; else y = b.y + b.h + r;
      }
    }
  }
  const nx = Math.max(r, Math.min(WORLD.w - r, x));
  const ny = Math.max(r, Math.min(WORLD.h - r, y));
  if (nx !== x || ny !== y) hit = true;
  return { x: nx, y: ny, hit };
}

export function pointInBuilding(G, x, y) {
  return G.world.buildings.some((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
}
