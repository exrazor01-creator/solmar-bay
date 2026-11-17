// Solmar Bay — bullets, explosions, particles and damage. Everything that can hurt
// something lives here; the caller decides who shot and why.
import { TUNE } from './config.js';
import { clamp, dist } from './random.js';

export function addParticles(G, x, y, n, color, speed, life, size) {
  for (let i = 0; i < n; i += 1) {
    if (G.particles.length >= TUNE.maxParticles) return;
    const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7);
    G.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.5 + Math.random() * 0.5), maxLife: life, color, size: size * (0.6 + Math.random() * 0.8) });
  }
}
export function addSkid(G, x1, y1, x2, y2) {
  G.skids.push({ x1, y1, x2, y2, life: 5 });
  if (G.skids.length > 220) G.skids.shift();
}

export function spawnBullet(G, x, y, angle, from, dmg) {
  if (G.bullets.length >= TUNE.maxBullets) return;
  G.bullets.push({ x, y, vx: Math.cos(angle) * TUNE.bulletSpeed, vy: Math.sin(angle) * TUNE.bulletSpeed, life: 0.9, from, dmg: dmg || 34 });
  addParticles(G, x + Math.cos(angle) * 18, y + Math.sin(angle) * 18, 3, '#ffd23e', 120, 0.15, 3);
  G.camera.shake = Math.max(G.camera.shake, 2);
}

export function explode(G, x, y, big) {
  const r = big ? 130 : 70;
  addParticles(G, x, y, big ? 46 : 22, '#ff9f43', big ? 420 : 300, 0.8, 5);
  addParticles(G, x, y, big ? 26 : 12, '#576574', 200, 1.2, 7);
  addParticles(G, x, y, 12, '#feca57', 500, 0.3, 4);
  G.camera.shake = Math.max(G.camera.shake, big ? 16 : 8);
  G.audio.explosion();
  // Splash damage to the player, cars and peds nearby.
  if (dist(G.player.x, G.player.y, x, y) < r && !G.player.inCar) damagePlayer(G, big ? 45 : 25);
  for (const c of G.cars) if (dist(c.x, c.y, x, y) < r + 20) damageCar(G, c, big ? 70 : 40);
  for (const p of G.peds) if (p.state !== 'dead' && dist(p.x, p.y, x, y) < r) damagePed(G, p, 100, x, y);
}

export function damagePlayer(G, dmg) {
  if (G.player.hp <= 0 || G.state !== 'playing') return;
  G.player.hp = Math.max(0, G.player.hp - dmg);
  G.player.hurtT = 0.35;
  if (G.player.hp <= 0) {
    G.state = 'wasted';
    G.audio.fail();
    addParticles(G, G.player.x, G.player.y, 30, '#ff6b6b', 260, 0.9, 5);
  }
}

export function damageCar(G, car, dmg) {
  if (car.hp <= 0) return;
  car.hp -= dmg;
  if (car.hp <= 0) {
    car.hp = 0; car.dead = true;
    explode(G, car.x, car.y, true);
    if (car.driver === 'player') {
      // Eject the player from the wreck.
      G.player.inCar = null; G.player.x = car.x + 40; G.player.y = car.y; G.player.hp = Math.max(1, G.player.hp - 20);
      car.driver = 'wreck';
    }
  }
}

export function damagePed(G, ped, dmg, fromX, fromY) {
  if (ped.state === 'dead') return;
  ped.hp -= dmg;
  if (ped.hp <= 0) {
    ped.state = 'dead'; ped.deadT = 0;
    addParticles(G, ped.x, ped.y, 14, '#ff6b6b', 200, 0.6, 4);
    G.stats.kills += 1;
    if (ped.kind !== 'cop' && ped.kind !== 'guard') {
      // Killing a civilian is a crime; police.js picks this up next frame.
      G.pendingWanted = (G.pendingWanted || 0) + 2;
    }
  } else if (fromX !== undefined) {
    ped.state = 'flee'; ped.fleeT = 4;
    ped.fx = ped.x + (ped.x - fromX); ped.fy = ped.y + (ped.y - fromY);
  }
}

export function updateBullets(G, dt) {
  for (let i = G.bullets.length - 1; i >= 0; i -= 1) {
    const b = G.bullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    let dead = b.life <= 0;
    // Buildings stop bullets.
    if (!dead && G.world.buildings.some((bd) => b.x >= bd.x && b.x <= bd.x + bd.w && b.y >= bd.y && b.y <= bd.y + bd.h)) {
      addParticles(G, b.x, b.y, 4, '#dfe4ea', 140, 0.25, 2); dead = true;
    }
    if (!dead && b.from === 'player') {
      for (const p of G.peds) {
        if (p.state !== 'dead' && dist(b.x, b.y, p.x, p.y) < 14) { damagePed(G, p, b.dmg, G.player.x, G.player.y); dead = true; break; }
      }
      if (!dead) for (const c of G.cars) {
        if (c.driver !== 'player' && !c.dead && dist(b.x, b.y, c.x, c.y) < 26) { damageCar(G, c, b.dmg); dead = true; break; }
      }
    }
    if (!dead && b.from === 'enemy') {
      const pl = G.player;
      const inCar = pl.inCar;
      const px = inCar ? inCar.x : pl.x, py = inCar ? inCar.y : pl.y, pr = inCar ? 26 : 13;
      if (dist(b.x, b.y, px, py) < pr) {
        if (inCar) damageCar(G, inCar, b.dmg * 0.6); else damagePlayer(G, b.dmg * 0.5);
        dead = true;
      }
    }
    if (dead) G.bullets.splice(i, 1);
  }
  // Particles and skids age.
  for (let i = G.particles.length - 1; i >= 0; i -= 1) {
    const p = G.particles[i];
    p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96; p.life -= dt;
    if (p.life <= 0) G.particles.splice(i, 1);
  }
  for (let i = G.skids.length - 1; i >= 0; i -= 1) { G.skids[i].life -= dt; if (G.skids[i].life <= 0) G.skids.splice(i, 1); }
  G.player.hurtT = Math.max(0, (G.player.hurtT || 0) - dt);
}
