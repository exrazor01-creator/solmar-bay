// Solmar Bay — traffic cars that drive the road grid and pedestrians who walk the
// sidewalks (and run from gunfire). Both are seeded so the city is the same every run.
import { AVENUES, STREETS, ROAD_W, WORLD, BEACH_Y, PALETTE, TUNE } from './config.js';
import { range, int, pick, clamp, dist, angleDiff } from './random.js';
import { collideCircle, nearestIntersection, onRoad } from './world.js';
import { damageCar } from './combat.js';

const CAR_COLORS = [PALETTE.taxi, PALETTE.sedan, PALETTE.sport, PALETTE.truck, PALETTE.van, '#e67e22', '#2ecc71', '#ecf0f1'];
let nextId = 1;

function randomRoadPoint(rng) {
  if (rng() < 0.5) return { x: pick(rng, AVENUES), y: range(rng, 120, BEACH_Y - 120) };
  return { x: range(rng, 120, WORLD.w - 120), y: pick(rng, STREETS) };
}

export function spawnCar(G, x, y, kind, driver) {
  const car = {
    id: nextId, x, y, angle: 0, speed: 0, color: kind === 'taxi' ? PALETTE.taxi : pick(G.rng, CAR_COLORS),
    kind: kind || 'sedan', driver: driver || 'traffic', hp: TUNE.carHp, maxHp: TUNE.carHp,
    dead: false, target: null, waitT: 0, honkT: 0,
  };
  nextId += 1;
  if (driver === 'traffic') {
    const it = nearestIntersection(x, y);
    car.target = { x: it.x, y: it.y };
    car.angle = Math.atan2(it.y - y, it.x - x);
    car.speed = range(G.rng, 120, 190);
  }
  G.cars.push(car);
  return car;
}

export function spawnTraffic(G) {
  for (let i = 0; i < TUNE.trafficCount; i += 1) {
    const pt = randomRoadPoint(G.rng);
    spawnCar(G, pt.x + range(G.rng, -20, 20), pt.y + range(G.rng, -20, 20), G.rng() < 0.2 ? 'taxi' : 'sedan', 'traffic');
  }
  // Parked cars along the curbs.
  for (let i = 0; i < 10; i += 1) {
    const pt = randomRoadPoint(G.rng);
    const c = spawnCar(G, pt.x, pt.y, 'sedan', 'parked');
    c.angle = Math.abs(pt.x - Math.round(pt.x / 400) * 400) < 60 ? Math.PI / 2 : 0;
    if (G.rng() < 0.5) c.angle += Math.PI;
    c.speed = 0;
  }
}

export function spawnPeds(G) {
  for (let i = 0; i < TUNE.pedCount; i += 1) {
    const pt = randomRoadPoint(G.rng);
    G.peds.push({
      x: pt.x + range(G.rng, -60, 60), y: pt.y + range(G.rng, -60, 60),
      angle: G.rng() * Math.PI * 2, speed: range(G.rng, 40, 70), state: 'walk',
      kind: 'walker', hp: 100, tx: pt.x, ty: pt.y, waitT: 0, fleeT: 0,
      shirt: pick(G.rng, ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#ecf0f1']),
    });
  }
}

function steerToward(car, tx, ty, dt, maxSpeed) {
  const want = Math.atan2(ty - car.y, tx - car.x);
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
      const d = dist(car.x, car.y, o.x, o.y);
      if (d < 70) {
        const ahead = Math.cos(car.angle) * (o.x - car.x) + Math.sin(car.angle) * (o.y - car.y);
        if (ahead > 0 && d < 62) { blocked = true; break; }
      }
    }
    if (blocked) { car.speed = Math.max(0, car.speed - 500 * dt); car.waitT += dt; }
    else {
      car.waitT = 0;
      if (!car.target || dist(car.x, car.y, car.target.x, car.target.y) < 40) {
        // At an intersection: keep going or turn onto the crossing road.
        const it = nearestIntersection(car.x, car.y);
        const opts = [];
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (const [dx, dy] of dirs) {
          const nx = it.x + dx * 400, ny = it.y + dy * 400;
          if (nx > 200 && nx < WORLD.w - 200 && ny > 150 && ny < BEACH_Y - 100) opts.push({ x: nx, y: ny });
        }
        car.target = opts.length ? opts[Math.floor(G.rng() * opts.length)] : { x: it.x, y: it.y };
      }
      steerToward(car, car.target.x, car.target.y, dt, 190);
    }
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const fixed = collideCircle(G, nx, ny, TUNE.carRadius);
    if (fixed.hit) { car.speed *= 0.5; car.target = null; }
    car.x = fixed.x; car.y = fixed.y;
    // Gentle car-car separation.
    for (const o of G.cars) {
      if (o === car || o.dead) continue;
      const d = dist(car.x, car.y, o.x, o.y);
      if (d > 0.01 && d < 44) {
        const push = (44 - d) / d * 0.5;
        car.x += (car.x - o.x) * push * 0.5; car.y += (car.y - o.y) * push * 0.5;
      }
    }
  }
  // Keep the streets busy: replace cars that despawned far away.
  const traffic = G.cars.filter((c) => c.driver === 'traffic' && !c.dead);
  if (traffic.length < TUNE.trafficCount && G.rng() < dt * 0.5) {
    const pt = randomRoadPoint(G.rng);
    if (dist(pt.x, pt.y, G.player.x, G.player.y) > 700) spawnCar(G, pt.x, pt.y, 'sedan', 'traffic');
  }
}

export function updatePeds(G, dt) {
  for (const ped of G.peds) {
    if (ped.state === 'dead') { ped.deadT = (ped.deadT || 0) + dt; continue; }
    if (ped.state === 'flee') {
      ped.fleeT -= dt;
      const a = Math.atan2(ped.fy - ped.y, ped.fx - ped.x);
      ped.angle = a;
      const nx = ped.x + Math.cos(a) * 150 * dt, ny = ped.y + Math.sin(a) * 150 * dt;
      const fixed = collideCircle(G, nx, ny, 10);
      ped.x = fixed.x; ped.y = fixed.y;
      if (ped.fleeT <= 0) { ped.state = 'walk'; ped.tx = ped.x; ped.ty = ped.y; }
      continue;
    }
    // Gunfire nearby makes walkers run.
    const gun = G.bullets.length > 0 && G.bullets.some((b) => b.from === 'player' && dist(b.x, b.y, ped.x, ped.y) < 260);
    if (gun) { ped.state = 'flee'; ped.fleeT = 3; ped.fx = ped.x + (ped.x - G.player.x); ped.fy = ped.y + (ped.y - G.player.y); continue; }
    ped.waitT -= dt;
    if (dist(ped.x, ped.y, ped.tx, ped.ty) < 12 || ped.waitT <= 0) {
      if (ped.waitT <= -2 || dist(ped.x, ped.y, ped.tx, ped.ty) < 12) {
        // New stroll target: a nearby sidewalk point.
        const pt = randomRoadPoint(G.rng);
        ped.tx = clamp(pt.x + (G.rng() - 0.5) * 120, 60, WORLD.w - 60);
        ped.ty = clamp(pt.y + (G.rng() - 0.5) * 120, 60, BEACH_Y - 60);
        ped.waitT = 4 + G.rng() * 4;
      }
      continue;
    }
    const a = Math.atan2(ped.ty - ped.y, ped.tx - ped.x);
    ped.angle = a;
    const nx = ped.x + Math.cos(a) * ped.speed * dt, ny = ped.y + Math.sin(a) * ped.speed * dt;
    const fixed = collideCircle(G, nx, ny, 10);
    ped.x = fixed.x; ped.y = fixed.y;
  }
  // Top up pedestrians near the player.
  const alive = G.peds.filter((p) => p.state !== 'dead');
  if (alive.length < TUNE.pedCount && G.rng() < dt * 0.4) {
    const pt = randomRoadPoint(G.rng);
    if (dist(pt.x, pt.y, G.player.x, G.player.y) > 600 && dist(pt.x, pt.y, G.player.x, G.player.y) < 1600) {
      G.peds.push({ x: pt.x, y: pt.y, angle: 0, speed: range(G.rng, 40, 70), state: 'walk', kind: 'walker', hp: 100, tx: pt.x, ty: pt.y, waitT: 2, fleeT: 0, shirt: '#3498db' });
    }
  }
}
