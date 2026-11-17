import { TUNE, WORLD } from './config.js';
import { clamp, dist, angleDiff } from './random.js';
import { collideCircle } from './world.js';
import { damagePlayer, damageCar, addParticles } from './combat.js';
import { spawnCar } from './traffic.js';
import { spawnRoadblock, spawnHeli } from './vehicles.js';
export const MAX_STARS = 6;
export function addWanted(G, points, why) {
  const w = G.wanted;
  w.points = clamp(w.points + points, 0, 12);
  const stars = Math.min(MAX_STARS, Math.floor(w.points / 2));
  if (stars > w.stars) {
    w.stars = stars;
    G.banner = { text: `WANTED — ${'★'.repeat(stars)}${'☆'.repeat(MAX_STARS - stars)}  ${why || ''}`, t: 3 };
    G.audio.siren(true);
  }
  w.quietT = 0;
}
function copSeesPlayer(G, cop) {
  return dist(cop.x, cop.z, G.player.x, G.player.z) < (G.player.inCar ? 700 : 480);
}
export function updateWanted(G, dt) {
  const w = G.wanted;
  if (G.pendingWanted) { addWanted(G, G.pendingWanted); G.pendingWanted = 0; }
  if (w.stars === 0) {
    G.roadblockSet = false;
    return;
  }
  if (w.stars >= 4 && !G.roadblockSet) {
    G.roadblockSet = true;
    spawnRoadblock(G);
    const heli = spawnHeli(G, G.player.x + 600, G.player.z - 600, 'police');
    heli.y = 80; heli.alt = 80;
  }
  if (w.stars < 4) G.roadblockSet = false;
  const helis = G.cars.filter((c) => c.kind === 'heli' && c.driver === 'police' && !c.dead).length;
  if (w.stars >= 6 && helis < 2) {
    const heli = spawnHeli(G, G.player.x - 600, G.player.z + 600, 'police');
    heli.y = 90; heli.alt = 90;
    G.banner = { text: 'SIX STARS — SWAT is on the ground, two choppers in the air!', t: 4 };
  }
  const seen = G.peds.some((p) => (p.kind === 'cop' || p.kind === 'swat') && p.state !== 'dead' && copSeesPlayer(G, p))
    || G.cars.some((c) => c.driver === 'police' && !c.dead && dist(c.x, c.z, G.player.x, G.player.z) < 700);
  if (!seen) {
    w.quietT += dt;
    if (w.quietT > TUNE.wantedDecaySight) {
      w.points = Math.max(0, w.points - (dt / TUNE.wantedDecayRate) * 2);
      const stars = Math.min(MAX_STARS, Math.floor(w.points / 2));
      if (stars < w.stars) {
        w.stars = stars; w.quietT = 0;
        if (stars === 0) { G.audio.siren(false); G.banner = { text: 'You lost them. The heat is off — for now.', t: 3 }; }
      }
    }
  } else w.quietT = 0;
  const wantFoot = Math.min(4, w.stars);
  const wantCars = w.stars >= 3 ? Math.min(4, w.stars - 2) : 0;
  const foot = G.peds.filter((p) => (p.kind === 'cop' || p.kind === 'swat') && p.state !== 'dead').length;
  const cars = G.cars.filter((c) => c.driver === 'police' && !c.dead).length;
  if (foot < wantFoot && G.rng() < dt * 0.8) spawnFootCop(G);
  if (cars < wantCars && G.rng() < dt * 0.6) spawnPoliceCar(G);
}
function spawnFootCop(G) {
  const a = G.rng() * Math.PI * 2, d = 420 + G.rng() * 260;
  const x = clamp(G.player.x + Math.cos(a) * d, 60, WORLD.w - 60);
  const z = clamp(G.player.z + Math.sin(a) * d, 60, WORLD.h - 60);
  const swat = G.wanted.stars >= 6;
  G.peds.push({
    x, z, angle: 0, speed: swat ? 235 : TUNE.copFootSpeed, state: 'walk',
    kind: swat ? 'swat' : 'cop', hp: swat ? 150 : 100, tx: x, tz: z, waitT: 0, fleeT: 0,
    color: swat ? '#2d3436' : '#1c4ed8', seed: G.rng(), punchCd: 0,
  });
}
function spawnPoliceCar(G) {
  const a = G.rng() * Math.PI * 2, d = 650 + G.rng() * 250;
  const x = clamp(G.player.x + Math.cos(a) * d, 80, WORLD.w - 80);
  const z = clamp(G.player.z + Math.sin(a) * d, 80, WORLD.h - 80);
  const c = spawnCar(G, x, z, 'police', 'police');
  c.color = '#1e40af'; c.speed = 240;
}
export function updatePolice(G, dt) {
  const p = G.player;
  for (const cop of G.peds) {
    if ((cop.kind !== 'cop' && cop.kind !== 'swat') || cop.state === 'dead') continue;
    cop.punchCd = Math.max(0, (cop.punchCd || 0) - dt);
    const d = dist(cop.x, cop.z, p.x, p.z);
    if (G.wanted.stars === 0) {
      cop.tx = cop.x + 100; cop.tz = cop.z; cop.state = 'walk';
      continue;
    }
    const a = Math.atan2(p.z - cop.z, p.x - cop.x);
    cop.angle = a;
    if (d > 26) {
      const nx = cop.x + Math.cos(a) * cop.speed * dt, nz = cop.z + Math.sin(a) * cop.speed * dt;
      const fixed = collideCircle(G, nx, nz, 11);
      cop.x = fixed.x; cop.z = fixed.z;
    } else if (cop.punchCd <= 0 && !p.inCar) {
      cop.punchCd = 0.9;
      damagePlayer(G, cop.kind === 'swat' ? TUNE.swatPunchDmg : TUNE.copPunchDmg);
      addParticles(G, p.x, 18, p.z, 5, '#feca57', 140, 0.3, 3);
      G.audio.punch();
      G.camera.shake = Math.max(G.camera.shake, 4);
    }
  }
  for (const car of G.cars) {
    if (car.driver !== 'police' || car.dead) continue;
    const d = dist(car.x, car.z, p.x, p.z);
    const pa = p.inCar ? p.inCar.angle : p.angle;
    const tx = p.x - Math.cos(pa) * 60, tz = p.z - Math.sin(pa) * 60;
    const want = Math.atan2(tz - car.z, tx - car.x);
    const diff = angleDiff(car.angle, want);
    car.angle += clamp(diff, -2.4 * dt, 2.4 * dt);
    const target = d > 700 ? 420 : d > 120 ? 480 : 300;
    car.speed = clamp(car.speed + 320 * dt, 0, target);
    if (Math.abs(car.speed) < 30 && d > 200) {
      car.stuckT = (car.stuckT || 0) + dt;
      if (car.stuckT > 2) { car.angle += Math.PI * 0.6; car.speed = -160; car.stuckT = 0; }
    } else car.stuckT = 0;
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const nz = car.z + Math.sin(car.angle) * car.speed * dt;
    const fixed = collideCircle(G, nx, nz, car.radius);
    if (fixed.hit) car.speed *= 0.5;
    car.x = fixed.x; car.z = fixed.z;
    car.ramCd = Math.max(0, (car.ramCd || 0) - dt);
    if (p.inCar && d < 52 && car.ramCd <= 0) {
      car.ramCd = 0.9;
      damageCar(G, p.inCar, 5);
      damageCar(G, car, 3);
      G.camera.shake = Math.max(G.camera.shake, 3);
      addParticles(G, car.x, 12, car.z, 4, '#dfe4ea', 120, 0.3, 3);
    }
    if (G.wanted.stars === 0 && d > 900) { car.dead = true; car.driver = 'wreck'; }
  }
  for (const cop of G.peds) {
    if ((cop.kind === 'cop' || cop.kind === 'swat') && cop.state !== 'dead' && G.wanted.stars === 0 && dist(cop.x, cop.z, p.x, p.z) > 1000) cop.state = 'dead';
  }
}
