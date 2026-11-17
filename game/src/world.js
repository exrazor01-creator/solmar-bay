import { AVENUES, STREETS, ROAD_W, WORLD, BEACH_Z, WATER_Z, PALETTE } from './config.js';
import { range, int, pick, chance } from './random.js';
const ROOFS = [PALETTE.roofA, PALETTE.roofB, PALETTE.roofC, PALETTE.roofD, PALETTE.roofE, PALETTE.roofF];
export function districtAt(x, z) {
  if (z >= BEACH_Z) return 'Beach';
  if (x >= 2830 && z < 760) return 'Airport';
  if (x >= 2400 && z >= 1100) return 'Harbor';
  if (x >= 1200 && x < 2400 && z < 1100) return 'Downtown';
  if (x < 1200 && z >= 1100) return 'Suburbs';
  if (x < 1200) return 'Old Town';
  return 'Midtown';
}
export function isWater(x, z) { return z >= WATER_Z; }
export function isSand(x, z) { return z >= BEACH_Z && z < WATER_Z; }
const AIRPORT = { x0: 2830, x1: 3200, z0: 130, z1: 760 };
function inAirport(x, z, w, d) {
  return x < AIRPORT.x1 && x + w > AIRPORT.x0 && z < AIRPORT.z1 && z + d > AIRPORT.z0;
}
export function buildWorld(rng) {
  const buildings = [];
  const trees = [];
  const parks = [];
  buildings.push({ x: 1700, z: 1200, w: 200, d: 200, color: PALETTE.tower, floors: 12, seed: 7, landmark: 'tower' });
  buildings.push({ x: 3030, z: 2080, w: 40, d: 40, color: '#ecf0f1', floors: 3, seed: 11, landmark: 'lighthouse' });
  buildings.push({ x: 2900, z: 400, w: 220, d: 140, color: '#b0bec5', floors: 3, seed: 21, landmark: 'terminal' });
  buildings.push({ x: 3080, z: 380, w: 30, d: 30, color: '#78909c', floors: 8, seed: 22, landmark: 'controltower' });
  buildings.push({ x: 2070, z: 1600, w: 260, d: 160, color: '#dfe6e9', floors: 3, seed: 23, landmark: 'mall' });
  buildings.push({ x: 1300, z: 380, w: 120, d: 100, color: '#2d3436', floors: 2, seed: 24, landmark: 'club' });
  buildings.push({ x: 2470, z: 1570, w: 100, d: 80, color: '#fdcb6e', floors: 1, seed: 25, landmark: 'gas' });
  buildings.push({ x: 870, z: 370, w: 140, d: 100, color: '#74b9ff', floors: 3, seed: 26, landmark: 'pd' });
  buildings.push({ x: 1670, z: 1570, w: 110, d: 90, color: '#fab1a0', floors: 1, seed: 27, landmark: 'diner' });
  buildings.push({ x: 2070, z: 370, w: 100, d: 80, color: '#a29bfe', floors: 2, seed: 28, landmark: 'clothes' });
  buildings.push({ x: 2470, z: 370, w: 160, d: 120, color: '#ffffff', floors: 4, seed: 29, landmark: 'hospital' });
  const xs = [0, ...AVENUES, WORLD.w];
  const zs = [0, ...STREETS, BEACH_Z];
  for (let bi = 0; bi < xs.length - 1; bi += 1) {
    for (let bj = 0; bj < zs.length - 1; bj += 1) {
      const x0 = xs[bi] + ROAD_W / 2 + 14, x1 = xs[bi + 1] - ROAD_W / 2 - 14;
      const z0 = zs[bj] + ROAD_W / 2 + 14, z1 = zs[bj + 1] - ROAD_W / 2 - 14;
      if (x1 - x0 < 90 || z1 - z0 < 90) continue;
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const district = districtAt(cx, cz);
      const parkChance = district === 'Suburbs' ? 0.28 : district === 'Harbor' ? 0.05 : 0.16;
      if (chance(rng, parkChance)) { parks.push({ x: x0, z: z0, w: x1 - x0, d: z1 - z0 }); continue; }
      const n = int(rng, 1, 3);
      for (let k = 0; k < n; k += 1) {
        let w, d, floors, color;
        if (district === 'Harbor') {
          w = range(rng, 160, Math.min(280, x1 - x0));
          d = range(rng, 100, Math.min(180, z1 - z0));
          floors = int(rng, 1, 2);
          color = pick(rng, [PALETTE.warehouse, '#7f8c8d', '#a67c52', '#6c7a89']);
        } else if (district === 'Downtown') {
          w = range(rng, 110, Math.min(220, x1 - x0));
          d = range(rng, 100, Math.min(200, z1 - z0));
          floors = int(rng, 4, 9);
          color = pick(rng, ROOFS);
        } else if (district === 'Suburbs') {
          w = range(rng, 80, Math.min(150, x1 - x0));
          d = range(rng, 70, Math.min(130, z1 - z0));
          floors = int(rng, 1, 3);
          color = pick(rng, ROOFS);
        } else {
          w = range(rng, 90, Math.min(220, x1 - x0));
          d = range(rng, 80, Math.min(200, z1 - z0));
          floors = int(rng, 2, 6);
          color = pick(rng, ROOFS);
        }
        const x = range(rng, x0, x1 - w), z = range(rng, z0, z1 - d);
        if (inAirport(x, z, w, d)) continue;
        const b = { x, z, w, d, color, floors, seed: rng() * 100 };
        if (buildings.some((o) => o.x < b.x + b.w + 18 && o.x + o.w + 18 > b.x && o.z < b.z + b.d + 18 && o.z + o.d + 18 > b.z)) continue;
        buildings.push(b);
      }
    }
  }
  for (let i = 0; i < 70; i += 1) {
    const av = pick(rng, AVENUES), st = pick(rng, STREETS);
    const side = chance(rng, 0.5);
    trees.push(side
      ? { x: av + (chance(rng, 0.5) ? 1 : -1) * (ROAD_W / 2 + 16), z: range(rng, 80, BEACH_Z - 80), s: range(rng, 0.8, 1.3) }
      : { x: range(rng, 80, WORLD.w - 80), z: st + (chance(rng, 0.5) ? 1 : -1) * (ROAD_W / 2 + 16), s: range(rng, 0.8, 1.3) });
  }
  for (let i = 0; i < 22; i += 1) trees.push({ x: range(rng, 120, WORLD.w - 120), z: range(rng, BEACH_Z + 30, WATER_Z - 20), s: range(rng, 0.8, 1.3) });
  return { buildings, trees, parks };
}
export function onRoad(x, z) {
  if (z >= BEACH_Z) return false;
  for (const a of AVENUES) if (Math.abs(x - a) <= ROAD_W / 2) return true;
  for (const s of STREETS) if (Math.abs(z - s) <= ROAD_W / 2) return true;
  return false;
}
export function roadLane(x, z) {
  let best = null;
  for (const a of AVENUES) { const d = Math.abs(x - a); if (!best || d < best.d) best = { d, axis: 'x', c: a, side: x >= a ? 1 : -1 }; }
  for (const s of STREETS) { const d = Math.abs(z - s); if (!best || d < best.d) best = { d, axis: 'z', c: s, side: z >= s ? 1 : -1 }; }
  return best;
}
export function nearestIntersection(x, z) {
  let bx = AVENUES[0], bz = STREETS[0], bd = Infinity;
  for (const a of AVENUES) for (const s of STREETS) {
    const d = (a - x) * (a - x) + (s - z) * (s - z);
    if (d < bd) { bd = d; bx = a; bz = s; }
  }
  return { x: bx, z: bz };
}
export function collideCircle(G, x, z, r) {
  let hit = false;
  for (const b of G.world.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cz = Math.max(b.z, Math.min(z, b.z + b.d));
    const dx = x - cx, dz = z - cz, d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.01) {
        const d = Math.sqrt(d2), push = (r - d) / d;
        x += dx * push; z += dz * push;
      } else {
        const pl = x - b.x, pr = b.x + b.w - x, pt = z - b.z, pb = b.z + b.d - z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) x = b.x - r; else if (m === pr) x = b.x + b.w + r;
        else if (m === pt) z = b.z - r; else z = b.z + b.d + r;
      }
    }
  }
  const nx = Math.max(r, Math.min(WORLD.w - r, x));
  const nz = Math.max(r, Math.min(WORLD.h - r, z));
  if (nx !== x || nz !== z) hit = true;
  return { x: nx, z: nz, hit };
}
export function pointInBuilding(G, x, z) {
  return G.world.buildings.some((b) => x >= b.x && x <= b.x + b.w && z >= b.z && z <= b.z + b.d);
}
