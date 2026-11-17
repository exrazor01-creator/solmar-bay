// Solmar Bay — the vehicles that are not ordinary cars: the flyable helicopter, the
// drivable boat, the police helicopter that hunts at four stars, and the roadblocks
// the force throws across the road when the heat peaks. Helis and boats live in
// G.cars alongside cars, so the render, damage and wanted code all see them.
// A heli's `y` IS its altitude; a boat's `y` is 0 on the water.
import { CAR_STATS, TUNE, WORLD, WATER_Z } from './config.js';
import { clamp, dist, angleDiff } from './random.js';
import { collideCircle, nearestIntersection } from './world.js';
import { damageCar, addParticles, spawnBullet3D } from './combat.js';
import { spawnCar } from './traffic.js';
import { take } from './input.js';

let nextHeliId = 9000;

export function spawnHeli(G, x, z, driver) {
  const s = CAR_STATS.heli;
  const heli = {
    id: nextHeliId, x, z, y: 0, angle: 0, speed: 0, color: driver === 'police' ? '#1e40af' : '#e67e22',
    kind: 'heli', driver: driver || 'parked', hp: s.hp, maxHp: s.hp, maxSpeed: s.max,
    accel: s.accel, turn: s.turn, radius: s.r, rotor: 0, dead: false,
    target: null, waitT: 0, honkT: 0, shootCd: 0,
  };
  nextHeliId += 1;
  G.cars.push(heli);
  return heli;
}

export function spawnBoat(G, x, z, driver) {
  const s = CAR_STATS.boat;
  const boat = {
    id: nextHeliId, x, z, y: 0, angle: 0, speed: 0, color: '#ecf0f1', // faces east, along the coast
    kind: 'boat', driver: driver || 'parked', hp: s.hp, maxHp: s.hp, maxSpeed: s.max,
    accel: s.accel, turn: s.turn, radius: s.r, rotor: 0, dead: false,
    target: null, waitT: 0, honkT: 0, shootCd: 0, wakeT: 0,
  };
  nextHeliId += 1;
  G.cars.push(boat);
  return boat;
}

// Fly a helicopter: W/S thrust, A/D turn, Space climb, C descend. Above the rooftops
// (y > 25) nothing on the ground can touch it; it can only land on open ground.
export function driveHeli(G, dt, input, pressed) {
  const p = G.player, heli = p.inCar;
  const fwd = pressed(input, 'w', 'ArrowUp') ? 1 : pressed(input, 's', 'ArrowDown') ? -1 : 0;
  const steer = pressed(input, 'a', 'ArrowLeft') ? -1 : pressed(input, 'd', 'ArrowRight') ? 1 : 0;
  if (fwd > 0) heli.speed += heli.accel * dt;
  else if (fwd < 0) heli.speed -= heli.accel * 0.6 * dt;
  else heli.speed *= Math.max(0, 1 - 0.5 * dt);
  heli.speed = clamp(heli.speed, -160, heli.maxSpeed);
  const dir = heli.speed >= 0 ? 1 : -1;
  heli.angle += steer * heli.turn * dt * dir * Math.min(1, Math.abs(heli.speed) / 120 + 0.25);
  // Climb / descend. Landing is refused over water or a building: the skids stay up.
  if (pressed(input, ' ')) heli.y = Math.min(TUNE.heliMaxAlt, heli.y + TUNE.heliClimb * dt);
  if (pressed(input, 'c')) {
    const overRoof = G.world.buildings.some((b) => heli.x >= b.x && heli.x <= b.x + b.w && heli.z >= b.z && heli.z <= b.z + b.d);
    const minY = (heli.z >= WATER_Z || overRoof) ? 30 : 0;
    heli.y = Math.max(minY, heli.y - TUNE.heliClimb * dt);
  }
  heli.rotor += dt * (heli.y > 0 || Math.abs(heli.speed) > 5 ? 14 : 2);
  const nx = heli.x + Math.cos(heli.angle) * heli.speed * dt;
  const nz = heli.z + Math.sin(heli.angle) * heli.speed * dt;
  if (heli.y > 25) {
    // Airborne: free of the street grid, clamped only to the map.
    heli.x = clamp(nx, 30, WORLD.w - 30);
    heli.z = clamp(nz, 30, WORLD.h - 30);
  } else {
    const fixed = collideCircle(G, nx, nz, heli.radius);
    if (fixed.hit && Math.abs(heli.speed) > 120) {
      damageCar(G, heli, Math.abs(heli.speed) * 0.03);
      heli.speed *= 0.4;
      G.camera.shake = Math.max(G.camera.shake, 5);
    }
    heli.x = fixed.x; heli.z = fixed.z;
  }
  p.x = heli.x; p.z = heli.z;
  if (Math.abs(heli.speed) > 60 && heli.y > 0 && G.rng() < dt * 8) {
    addParticles(G, heli.x - Math.cos(heli.angle) * 24, heli.y, heli.z - Math.sin(heli.angle) * 24, 1, '#ffffff', 30, 0.5, 4);
  }
  G.audio.rotor(true);
  if (take(input, 'e')) {
    if (heli.y > 25) G.banner = { text: 'Too high — land first (hold C).', t: 2 };
    else {
      heli.driver = 'parked'; p.inCar = null;
      const a = heli.angle + Math.PI / 2;
      p.x = heli.x + Math.cos(a) * 40; p.z = heli.z + Math.sin(a) * 40;
      const fixed = collideCircle(G, p.x, p.z, TUNE.playerRadius);
      p.x = fixed.x; p.z = fixed.z;
      G.audio.rotor(false);
    }
  }
}

// Sail a boat: W/S throttle, A/D steer. The sea is its road; the shore stops it.
export function driveBoat(G, dt, input, pressed) {
  const p = G.player, boat = p.inCar;
  const fwd = pressed(input, 'w', 'ArrowUp') ? 1 : pressed(input, 's', 'ArrowDown') ? -1 : 0;
  const steer = pressed(input, 'a', 'ArrowLeft') ? -1 : pressed(input, 'd', 'ArrowRight') ? 1 : 0;
  if (fwd > 0) boat.speed += boat.accel * dt;
  else if (fwd < 0) boat.speed -= boat.accel * 0.5 * dt;
  else boat.speed *= Math.max(0, 1 - 0.6 * dt);
  boat.speed = clamp(boat.speed, -140, boat.maxSpeed);
  const dir = boat.speed >= 0 ? 1 : -1;
  boat.angle += steer * boat.turn * dt * dir * Math.min(1, Math.abs(boat.speed) / 100 + 0.2);
  const nx = boat.x + Math.cos(boat.angle) * boat.speed * dt;
  const nz = boat.z + Math.sin(boat.angle) * boat.speed * dt;
  // The boat lives in the water: clamp it to the sea and let it slide along the shore.
  boat.x = clamp(nx, 30, WORLD.w - 30);
  boat.z = clamp(nz, WATER_Z + 14, WORLD.h - 14);
  if (nz < WATER_Z + 14 && Math.abs(boat.speed) > 150) {
    boat.speed *= 0.5;
    addParticles(G, boat.x, 2, boat.z, 6, '#dfe4ea', 120, 0.4, 3);
  }
  p.x = boat.x; p.z = boat.z;
  // Wake.
  boat.wakeT -= dt;
  if (Math.abs(boat.speed) > 80 && boat.wakeT <= 0) {
    boat.wakeT = 0.12;
    addParticles(G, boat.x - Math.cos(boat.angle) * 26, 2, boat.z - Math.sin(boat.angle) * 26, 2, '#ffffff', 40, 0.7, 4);
  }
  G.audio.boat(Math.abs(boat.speed) / boat.maxSpeed);
  if (take(input, 'e')) {
    if (boat.z > WATER_Z + 80) {
      G.banner = { text: 'Too deep — sail closer to the shore to get out.', t: 2 };
    } else {
      boat.driver = 'parked'; p.inCar = null;
      p.x = boat.x; p.z = WATER_Z - 24;
      const fixed = collideCircle(G, p.x, p.z, TUNE.playerRadius);
      p.x = fixed.x; p.z = fixed.z;
      G.audio.boat(0);
    }
  }
}

// The police helicopter: at four stars it lifts off, shadows the player from above
// and opens fire in bursts. It leaves when the heat is gone and it is far away.
export function updatePoliceHeli(G, dt) {
  const p = G.player;
  const heli = G.cars.find((c) => c.kind === 'heli' && c.driver === 'police' && !c.dead);
  if (!heli) return;
  const d = dist(heli.x, heli.z, p.x, p.z);
  if (G.wanted.stars === 0 && d > 900) { heli.dead = true; heli.driver = 'wreck'; G.audio.rotor(false); return; }
  // Fly toward a hover point above the player.
  const want = Math.atan2(p.z - heli.z, p.x - heli.x);
  const diff = angleDiff(heli.angle, want);
  heli.angle += clamp(diff, -2.0 * dt, 2.0 * dt);
  heli.speed = clamp(heli.speed + 300 * dt, 0, d > 200 ? 460 : 240);
  heli.x += Math.cos(heli.angle) * heli.speed * dt;
  heli.z += Math.sin(heli.angle) * heli.speed * dt;
  heli.x = clamp(heli.x, 30, WORLD.w - 30);
  heli.z = clamp(heli.z, 30, WORLD.h - 30);
  heli.y = Math.min(80, heli.y + 40 * dt);
  heli.rotor += dt * 14;
  // Burst fire from above when close enough.
  heli.shootCd = Math.max(0, (heli.shootCd || 0) - dt);
  if (d < 420 && heli.shootCd <= 0 && G.state === 'playing') {
    heli.shootCd = 1.5;
    spawnBullet3D(G, heli.x, heli.y + 6, heli.z, p.x, 18, p.z, 'enemy', 12);
    G.audio.shoot();
  }
}

// Throw a roadblock across the road ahead of the player: two cruisers angled across
// the street, plus the banner. Called once when the wanted level first hits four.
export function spawnRoadblock(G) {
  const p = G.player;
  const pa = p.inCar ? p.inCar.angle : p.angle;
  const ahead = { x: p.x + Math.cos(pa) * 420, z: p.z + Math.sin(pa) * 420 };
  const it = nearestIntersection(ahead.x, ahead.z);
  const onAvenue = Math.abs(it.x - ahead.x) < Math.abs(it.z - ahead.z);
  const spots = onAvenue
    ? [{ x: it.x, z: it.z - 30, a: Math.PI / 2 }, { x: it.x, z: it.z + 30, a: Math.PI / 2 }]
    : [{ x: it.x - 30, z: it.z, a: 0 }, { x: it.x + 30, z: it.z, a: 0 }];
  for (const s of spots) {
    const c = spawnCar(G, s.x, s.z, 'police', 'police');
    c.color = '#1e40af'; c.angle = s.a; c.speed = 0; c.roadblock = true;
  }
  G.roadblock = { x: it.x, z: it.z, t: 0 };
  G.banner = { text: 'ROADBLOCK AHEAD — the force sealed the street!', t: 3 };
  G.audio.siren(true);
}

// Per-frame vehicle updates: police heli, and the rotor hum follows the player's heli.
export function updateVehicles(G, dt) {
  updatePoliceHeli(G, dt);
  if (G.roadblock) G.roadblock.t += dt;
  const heli = G.player.inCar && G.player.inCar.kind === 'heli' ? G.player.inCar : null;
  if (!heli && !G.cars.some((c) => c.kind === 'heli' && c.driver === 'police' && !c.dead)) G.audio.rotor(false);
  if (G.player.inCar && G.player.inCar.kind === 'boat') G.audio.boat(Math.abs(G.player.inCar.speed) / G.player.inCar.maxSpeed);
  else if (!G.player.inCar || G.player.inCar.kind !== 'boat') G.audio.boat(0);
  // Parked helis sit still; their rotors idle.
  for (const c of G.cars) {
    if (c.kind === 'heli' && c.driver !== 'player' && c.driver !== 'police' && !c.dead) c.rotor += dt * 1.5;
  }
}
