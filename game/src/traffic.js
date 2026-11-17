// Solmar Bay — traffic cars that drive the road grid and pedestrians who walk the
// sidewalks (and run from gunfire). Both are seeded so the city is the same every run.
import { AVENUES, STREETS, WORLD, BEACH_Z, TUNE, CAR_STATS } from './config.js';
import { range, pick, clamp, dist, angleDiff } from './random.js';
import { collideCircle, nearestIntersection } from './world.js';

const CAR_COLORS = ['#f7c948', '#c0392b', '#8e44ad', '#7f8c8d', '#16a085', '#e67e22', '#2ecc71', '#ecf0f1'];
const TRAFFIC_KINDS = ['sedan', 'sedan', 'sedan', 'sedan', 'taxi', 'taxi', 'truck', 'truck', 'bike', 'van'];
const PARKED_KINDS = ['sedan', 'sedan', 'sport', 'sport', 'truck', 'bike', 'van'];
let nextId = 1;

function randomRoadPoint(rng) {
  if (rng() < 0.5) return { x: pick(rng, AVENUES), z: range(rng, 120, BEACH_Z - 120) };
  return { x: range(rng, 120, WORLD.w - 120), z: pick(rng, STREETS) };
}

export function spawnCar(G, x, z, kind, driver) {
  const s = CAR_STATS[kind] || CAR_STATS.sedan;
  const car = {
    id: nextId, x, z, y: 0, angle: 0, speed: 0,
    color: kind === 'taxi' ? '#f7c948' : kind === 'sport' ? '#8e44ad' : kind === 'police' ? '#1e40af' : kind === 'truck' ? '#7f8c8d' : kind === 'van' ? '#16a085' : kind === 'bike' ? '#e67e22' : pick(G.rng, CAR_COLORS),
    kind: kind || 'sedan', driver: driver || 'traffic',
    hp: s.hp, maxHp: s.hp, maxSpeed: s.max, accel: s.accel, turn: s.turn, radius: s.r,
    dead: false, target: null, waitT: 0, honkT: 0,
  };
  nextId += 1;
  if (driver === 'traffic') {
    const it = nearestIntersection(x, z);
    car.target = { x: it.x, z: it.z };
    car.angle = Math.atan2(it.z - z, it.x - x);
    car.speed = range(G.rng, 120, 190) * (kind === 'truck' ? 0.7 : kind === 'bike' ? 1.15 : 1);
  }
  G.cars.push(car);
  return car;
}

export function spawnTraffic(G) {
  for (let i = 0; i < TUNE.trafficCount; i += 1) {
    const pt = randomRoadPoint(G.rng);
    spawnCar(G, pt.x + range(G.rng, -20, 20), pt.z + range(G.rng, -20, 20), pick(G.rng, TRAFFIC_KINDS), 'traffic');
  }
  // Parked cars along the curbs — but keep the helipad and the marina clear, so the
  // helicopter and the boats are always the nearest thing to board there.
  for (let i = 0; i < 10; i += 1) {
    const pt = randomRoadPoint(G.rng);
    if (dist(pt.x, pt.z, 2800, 300) < 180 || dist(pt.x, pt.z, 400, 2290) < 180) continue;
    const c = spawnCar(G, pt.x, pt.z, pick(G.rng, PARKED_KINDS), 'parked');
    c.angle = Math.abs(pt.x - Math.round(pt.x / 400) * 400) < 60 ? Math.PI / 2 : 0;
    if (G.rng() < 0.5) c.angle += Math.PI;
    c.speed = 0;
  }
}

export function spawnPeds(G) {
  for (let i = 0; i < TUNE.pedCount; i += 1) {
    const pt = randomRoadPoint(G.rng);
    G.peds.push({
      x: pt.x + range(G.rng, -60, 60), z: pt.z + range(G.rng, -60, 60),
      angle: G.rng() * Math.PI * 2, speed: range(G.rng, 40, 70), state: 'walk',
      kind: 'walker', hp: 100, tx: pt.x, tz: pt.z, waitT: 0, fleeT: 0, seed: G.rng(),
      color: pick(G.rng, ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#ecf0f1']),
    });
  }
}

function steerToward(car, tx, tz, dt, maxSpeed) {
  const want = Math.atan2(tz - car.z, tx - car.x);
  const diff = angleDiff(car.angle, want);
  car.angle += clamp(diff, -2.2 * dt, 2.2 * dt);
  car.speed = clamp(car.speed + 260 * dt, 0, maxSpeed);
}

export function updateTraffic(G, dt) {
  for (const car of G.cars) {
    if (car.dead || car.driver !== 'traffic') continue;
    // Slow down for the car ahead.
    let blocked = false;
    for (const o of G.cars) {
      if (o === car || o.dead) continue;
      const d = dist(car.x, car.z, o.x, o.z);
      if (d < 70) {
        const ahead = Math.cos(car.angle) * (o.x - car.x) + Math.sin(car.angle) * (o.z - car.z);
        if (ahead > 0 && d < 62) { blocked = true; break; }
      }
    }
    if (blocked) {
      car.speed = Math.max(0, car.speed - 500 * dt);
      car.waitT += dt;
      // Stuck in a jam for too long: pick a new route instead of waiting forever.
      if (car.waitT > 3) { car.target = null; car.waitT = 0; }
    } else {
      car.waitT = 0;
      if (!car.target || dist(car.x, car.z, car.target.x, car.target.z) < 40) {
        // At an intersection: keep going or turn onto the crossing road.
        const it = nearestIntersection(car.x, car.z);
        const opts = [];
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (const [dx, dz] of dirs) {
          const nx = it.x + dx * 400, nz = it.z + dz * 400;
          if (nx > 200 && nx < WORLD.w - 200 && nz > 150 && nz < BEACH_Z - 100) opts.push({ x: nx, z: nz });
        }
        car.target = opts.length ? opts[Math.floor(G.rng() * opts.length)] : { x: it.x, z: it.z };
      }
      steerToward(car, car.target.x, car.target.z, dt, 190);
    }
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const nz = car.z + Math.sin(car.angle) * car.speed * dt;
    const fixed = collideCircle(G, nx, nz, car.radius);
    if (fixed.hit) { car.speed *= 0.5; car.target = null; }
    car.x = fixed.x; car.z = fixed.z;
    // Gentle car-car separation.
    for (const o of G.cars) {
      if (o === car || o.dead) continue;
      const d = dist(car.x, car.z, o.x, o.z);
      if (d > 0.01 && d < 44) {
        const push = (44 - d) / d * 0.5;
        car.x += (car.x - o.x) * push * 0.5; car.z += (car.z - o.z) * push * 0.5;
      }
    }
  }
  // Keep the streets busy: replace cars that despawned far away.
  const traffic = G.cars.filter((c) => c.driver === 'traffic' && !c.dead);
  if (traffic.length < TUNE.trafficCount && G.rng() < dt * 0.5) {
    const pt = randomRoadPoint(G.rng);
    if (dist(pt.x, pt.z, G.player.x, G.player.z) > 700) spawnCar(G, pt.x, pt.z, 'sedan', 'traffic');
  }
}

export function updatePeds(G, dt) {
  for (const ped of G.peds) {
    if (ped.state === 'dead') { ped.deadT = (ped.deadT || 0) + dt; continue; }
    if (ped.state === 'flee') {
      ped.fleeT -= dt;
      const a = Math.atan2(ped.fz - ped.z, ped.fx - ped.x);
      ped.angle = a;
      const nx = ped.x + Math.cos(a) * 150 * dt, nz = ped.z + Math.sin(a) * 150 * dt;
      const fixed = collideCircle(G, nx, nz, 10);
      ped.x = fixed.x; ped.z = fixed.z;
      if (ped.fleeT <= 0) { ped.state = 'walk'; ped.tx = ped.x; ped.tz = ped.z; }
      continue;
    }
    // Gunfire nearby makes walkers run.
    const gun = G.bullets.length > 0 && G.bullets.some((b) => b.from === 'player' && dist(b.x, b.z, ped.x, ped.z) < 260);
    if (gun) { ped.state = 'flee'; ped.fleeT = 3; ped.fx = ped.x + (ped.x - G.player.x); ped.fz = ped.z + (ped.z - G.player.z); continue; }
    ped.waitT -= dt;
    if (dist(ped.x, ped.z, ped.tx, ped.tz) < 12 || ped.waitT <= 0) {
      if (ped.waitT <= -2 || dist(ped.x, ped.z, ped.tx, ped.tz) < 12) {
        // New stroll target: a nearby sidewalk point.
        const pt = randomRoadPoint(G.rng);
        ped.tx = clamp(pt.x + (G.rng() - 0.5) * 120, 60, WORLD.w - 60);
        ped.tz = clamp(pt.z + (G.rng() - 0.5) * 120, 60, BEACH_Z - 60);
        ped.waitT = 4 + G.rng() * 4;
      }
      continue;
    }
    const a = Math.atan2(ped.tz - ped.z, ped.tx - ped.x);
    ped.angle = a;
    const nx = ped.x + Math.cos(a) * ped.speed * dt, nz = ped.z + Math.sin(a) * ped.speed * dt;
    const fixed = collideCircle(G, nx, nz, 10);
    ped.x = fixed.x; ped.z = fixed.z;
  }
  // Top up pedestrians near the player.
  const alive = G.peds.filter((p) => p.state !== 'dead');
  if (alive.length < TUNE.pedCount && G.rng() < dt * 0.4) {
    const pt = randomRoadPoint(G.rng);
    if (dist(pt.x, pt.z, G.player.x, G.player.z) > 600 && dist(pt.x, pt.z, G.player.x, G.player.z) < 1600) {
      G.peds.push({ x: pt.x, z: pt.z, angle: 0, speed: range(G.rng, 40, 70), state: 'walk', kind: 'walker', hp: 100, tx: pt.x, tz: pt.z, waitT: 2, fleeT: 0, seed: G.rng(), color: '#3498db' });
    }
  }
}
