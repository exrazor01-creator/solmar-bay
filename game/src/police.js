// Solmar Bay — the wanted system and the police who answer it. Stars rise with crime
// and fall when the player stays out of sight; the response scales with the stars.
import { TUNE, WORLD } from './config.js';
import { clamp, dist, angleDiff } from './random.js';
import { collideCircle } from './world.js';
import { damagePlayer, damageCar, addParticles } from './combat.js';
import { spawnCar } from './traffic.js';

export function addWanted(G, points, why) {
  const w = G.wanted;
  w.points = clamp(w.points + points, 0, 10);
  const stars = Math.min(5, Math.floor(w.points / 2));
  if (stars > w.stars) {
    w.stars = stars;
    G.banner = { text: `WANTED — ${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}  ${why || ''}`, t: 3 };
    G.audio.siren(true);
  }
  w.quietT = 0;
}

function copSeesPlayer(G, cop) {
  return dist(cop.x, cop.y, G.player.x, G.player.y) < (G.player.inCar ? 700 : 480);
}

export function updateWanted(G, dt) {
  const w = G.wanted;
  if (G.pendingWanted) { addWanted(G, G.pendingWanted); G.pendingWanted = 0; }
  if (w.stars === 0) return;
  // Quiet time only counts while no cop can see the player.
  const seen = G.peds.some((p) => p.kind === 'cop' && p.state !== 'dead' && copSeesPlayer(G, p))
    || G.cars.some((c) => c.driver === 'police' && !c.dead && dist(c.x, c.y, G.player.x, G.player.y) < 700);
  if (!seen) {
    w.quietT += dt;
    if (w.quietT > TUNE.wantedDecaySight) {
      w.points = Math.max(0, w.points - (dt / TUNE.wantedDecayRate) * 2);
      const stars = Math.min(5, Math.floor(w.points / 2));
      if (stars < w.stars) {
        w.stars = stars; w.quietT = 0;
        if (stars === 0) { G.audio.siren(false); G.banner = { text: 'You lost them. The heat is off — for now.', t: 3 }; }
      }
    }
  } else w.quietT = 0;
  // Keep the response coming while wanted.
  const wantFoot = Math.min(3, w.stars);
  const wantCars = w.stars >= 3 ? Math.min(3, w.stars - 2) : 0;
  const foot = G.peds.filter((p) => p.kind === 'cop' && p.state !== 'dead').length;
  const cars = G.cars.filter((c) => c.driver === 'police' && !c.dead).length;
  if (foot < wantFoot && G.rng() < dt * 0.8) spawnFootCop(G);
  if (cars < wantCars && G.rng() < dt * 0.6) spawnPoliceCar(G);
}

function spawnFootCop(G) {
  const a = G.rng() * Math.PI * 2, d = 420 + G.rng() * 260;
  const x = clamp(G.player.x + Math.cos(a) * d, 60, WORLD.w - 60);
  const y = clamp(G.player.y + Math.sin(a) * d, 60, WORLD.h - 60);
  G.peds.push({ x, y, angle: 0, speed: TUNE.copFootSpeed, state: 'walk', kind: 'cop', hp: 100, tx: x, ty: y, waitT: 0, fleeT: 0, shirt: '#1c4ed8', punchCd: 0 });
}

function spawnPoliceCar(G) {
  const a = G.rng() * Math.PI * 2, d = 650 + G.rng() * 250;
  const x = clamp(G.player.x + Math.cos(a) * d, 80, WORLD.w - 80);
  const y = clamp(G.player.y + Math.sin(a) * d, 80, WORLD.h - 80);
  const c = spawnCar(G, x, y, 'police', 'police');
  c.color = '#1e40af'; c.speed = 240;
}

export function updatePolice(G, dt) {
  const p = G.player;
  for (const cop of G.peds) {
    if (cop.kind !== 'cop' || cop.state === 'dead') continue;
    cop.punchCd = Math.max(0, (cop.punchCd || 0) - dt);
    const d = dist(cop.x, cop.y, p.x, p.y);
    if (G.wanted.stars === 0) { // No heat: cops wander off.
      cop.tx = cop.x + 100; cop.ty = cop.y; cop.state = 'walk';
      continue;
    }
    const a = Math.atan2(p.y - cop.y, p.x - cop.x);
    cop.angle = a;
    if (d > 26) {
      const nx = cop.x + Math.cos(a) * cop.speed * dt, ny = cop.y + Math.sin(a) * cop.speed * dt;
      const fixed = collideCircle(G, nx, ny, 11);
      cop.x = fixed.x; cop.y = fixed.y;
    } else if (cop.punchCd <= 0 && !p.inCar) {
      cop.punchCd = 0.9;
      damagePlayer(G, TUNE.copPunchDmg);
      addParticles(G, p.x, p.y, 5, '#feca57', 140, 0.3, 3);
      G.audio.punch();
      G.camera.shake = Math.max(G.camera.shake, 4);
    }
  }
  for (const car of G.cars) {
    if (car.driver !== 'police' || car.dead) continue;
    const d = dist(car.x, car.y, p.x, p.y);
    // Pursuit: aim for a point just behind the player's car, so cruisers tuck in
    // behind their target instead of grinding head-on into it.
    const pa = p.inCar ? p.inCar.angle : p.angle;
    const tx = p.x - Math.cos(pa) * 60, ty = p.y - Math.sin(pa) * 60;
    const want = Math.atan2(ty - car.y, tx - car.x);
    const diff = angleDiff(car.angle, want);
    car.angle += clamp(diff, -2.4 * dt, 2.4 * dt);
    const target = d > 700 ? 420 : d > 120 ? 480 : 300;
    car.speed = clamp(car.speed + 320 * dt, 0, target);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const fixed = collideCircle(G, nx, ny, TUNE.carRadius);
    if (fixed.hit) car.speed *= 0.5;
    car.x = fixed.x; car.y = fixed.y;
    // Ram the player's car (cooldown, so a chase does not shred it in a second).
    car.ramCd = Math.max(0, (car.ramCd || 0) - dt);
    if (p.inCar && d < 52 && car.ramCd <= 0) {
      car.ramCd = 0.9;
      damageCar(G, p.inCar, 5);
      damageCar(G, car, 3);
      G.camera.shake = Math.max(G.camera.shake, 3);
      addParticles(G, car.x, car.y, 4, '#dfe4ea', 120, 0.3, 3);
    }
    // A police car that loses the player for a long time gives up and despawns.
    if (G.wanted.stars === 0 && d > 900) { car.dead = true; car.driver = 'wreck'; }
  }
  // Foot cops give up when the heat is off and they are far away.
  for (const cop of G.peds) {
    if (cop.kind === 'cop' && cop.state !== 'dead' && G.wanted.stars === 0 && dist(cop.x, cop.y, p.x, p.y) > 1000) cop.state = 'dead';
  }
}
