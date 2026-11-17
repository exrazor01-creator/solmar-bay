// Solmar Bay — bullets, explosions, particles and damage. Everything that can hurt
// something lives here; the caller decides who shot and why. Bullets fly in 3D
// (x, y, z) but the hit tests stay on the ground plane plus a height check.
import { TUNE, GUN_H } from './config.js';
import { clamp, dist } from './random.js';
import { parseColor } from './gl.js';

export function addParticles(G, x, y, z, n, color, speed, life, size) {
  const c = parseColor(color);
  for (let i = 0; i < n; i += 1) {
    if (G.particles.length >= TUNE.maxParticles) return;
    const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7);
    G.particles.push({
      x, y, z, vx: Math.cos(a) * s, vy: (Math.random() - 0.2) * s * 0.7, vz: Math.sin(a) * s,
      life: life * (0.5 + Math.random() * 0.5), maxLife: life, color: c, size: size * (0.6 + Math.random() * 0.8),
    });
  }
}
export function addSkid(G, x1, z1, x2, z2) {
  G.skids.push({ x1, z1, x2, z2, life: 5 });
  if (G.skids.length > 220) G.skids.shift();
}

// A horizontal shot from a gun at height y (usually GUN_H above the ground).
export function spawnBullet(G, x, y, z, angle, from, dmg) {
  if (G.bullets.length >= TUNE.maxBullets) return;
  G.bullets.push({ x, y, z, vx: Math.cos(angle) * TUNE.bulletSpeed, vy: 0, vz: Math.sin(angle) * TUNE.bulletSpeed, angle, life: 0.9, from, dmg: dmg || 34 });
  addParticles(G, x + Math.cos(angle) * 18, y, z + Math.sin(angle) * 18, 3, '#ffd23e', 120, 0.15, 3);
  G.camera.shake = Math.max(G.camera.shake, 2);
}
// A 3D shot aimed at a point (the police helicopter shoots down at the player).
export function spawnBullet3D(G, x, y, z, tx, ty, tz, from, dmg) {
  if (G.bullets.length >= TUNE.maxBullets) return;
  const dx = tx - x, dy = ty - y, dz = tz - z, l = Math.hypot(dx, dy, dz) || 1;
  const sp = TUNE.bulletSpeed;
  G.bullets.push({ x, y, z, vx: dx / l * sp, vy: dy / l * sp, vz: dz / l * sp, angle: Math.atan2(dz, dx), life: 1.4, from, dmg: dmg || 12 });
  G.camera.shake = Math.max(G.camera.shake, 2);
}

export function explode(G, x, z, big) {
  const r = big ? 130 : 70;
  addParticles(G, x, 12, z, big ? 46 : 22, '#ff9f43', big ? 420 : 300, 0.8, 5);
  addParticles(G, x, 12, z, big ? 26 : 12, '#576574', 200, 1.2, 7);
  addParticles(G, x, 12, z, 12, '#feca57', 500, 0.3, 4);
  G.camera.shake = Math.max(G.camera.shake, big ? 16 : 8);
  G.audio.explosion();
  // Splash damage to the player, cars and peds nearby.
  if (dist(G.player.x, G.player.z, x, z) < r && !G.player.inCar) damagePlayer(G, big ? 45 : 25);
  for (const c of G.cars) if (dist(c.x, c.z, x, z) < r + 20) damageCar(G, c, big ? 70 : 40);
  for (const p of G.peds) if (p.state !== 'dead' && dist(p.x, p.z, x, z) < r) damagePed(G, p, 100, x, z);
}

export function damagePlayer(G, dmg) {
  if (G.player.hp <= 0 || G.state !== 'playing') return;
  // Armor absorbs first.
  if (G.player.armor > 0) {
    const absorbed = Math.min(G.player.armor, dmg);
    G.player.armor -= absorbed; dmg -= absorbed;
  }
  if (dmg <= 0) return;
  G.player.hp = Math.max(0, G.player.hp - dmg);
  G.player.hurtT = 0.35;
  if (G.player.hp <= 0) {
    G.state = 'wasted';
    G.audio.fail();
    addParticles(G, G.player.x, 18, G.player.z, 30, '#ff6b6b', 260, 0.9, 5);
  }
}

export function damageCar(G, car, dmg) {
  if (car.hp <= 0) return;
  car.hp -= dmg;
  if (car.hp <= 0) {
    car.hp = 0; car.dead = true;
    explode(G, car.x, car.z, true);
    if (car.driver === 'player') {
      // Eject the player from the wreck.
      G.player.inCar = null; G.player.x = car.x + 40; G.player.z = car.z; G.player.hp = Math.max(1, G.player.hp - 20);
      car.driver = 'wreck';
    }
  }
}

export function damagePed(G, ped, dmg, fromX, fromZ) {
  if (ped.state === 'dead') return;
  ped.hp -= dmg;
  if (ped.hp <= 0) {
    ped.state = 'dead'; ped.deadT = 0;
    addParticles(G, ped.x, 18, ped.z, 14, '#ff6b6b', 200, 0.6, 4);
    G.stats.kills += 1;
    if (ped.kind !== 'cop' && ped.kind !== 'guard') {
      // Killing a civilian is a crime; police.js picks this up next frame.
      G.pendingWanted = (G.pendingWanted || 0) + 2;
    }
  } else if (fromX !== undefined) {
    ped.state = 'flee'; ped.fleeT = 4;
    ped.fx = ped.x + (ped.x - fromX); ped.fz = ped.z + (ped.z - fromZ);
  }
}

export function updateBullets(G, dt) {
  for (let i = G.bullets.length - 1; i >= 0; i -= 1) {
    const b = G.bullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.life -= dt;
    let dead = b.life <= 0;
    // Buildings stop bullets that fly below their roof.
    if (!dead) {
      for (const bd of G.world.buildings) {
        if (b.x >= bd.x && b.x <= bd.x + bd.w && b.z >= bd.z && b.z <= bd.z + bd.d && b.y < bd.floors * 34) {
          addParticles(G, b.x, b.y, b.z, 4, '#dfe4ea', 140, 0.25, 2); dead = true; break;
        }
      }
    }
    if (!dead && b.y < 0) dead = true; // into the ground / sea
    if (!dead && b.from === 'player') {
      for (const p of G.peds) {
        if (p.state !== 'dead' && b.y < 40 && dist(b.x, b.z, p.x, p.z) < 14) { damagePed(G, p, b.dmg, G.player.x, G.player.z); dead = true; break; }
      }
      if (!dead) for (const c of G.cars) {
        if (c.driver !== 'player' && !c.dead && b.y < 30 && dist(b.x, b.z, c.x, c.z) < 26) { damageCar(G, c, b.dmg); dead = true; break; }
      }
    }
    if (!dead && b.from === 'enemy') {
      const pl = G.player;
      const inCar = pl.inCar;
      const px = inCar ? inCar.x : pl.x, pz = inCar ? inCar.z : pl.z, pr = inCar ? 26 : 13;
      if (b.y < 40 && dist(b.x, b.z, px, pz) < pr) {
        if (inCar) damageCar(G, inCar, b.dmg * 0.6); else damagePlayer(G, b.dmg * 0.5);
        dead = true;
      }
    }
    if (dead) G.bullets.splice(i, 1);
  }
  // Particles age and fall.
  for (let i = G.particles.length - 1; i >= 0; i -= 1) {
    const p = G.particles[i];
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    p.vy -= 300 * dt; // gravity
    p.vx *= 0.96; p.vz *= 0.96;
    if (p.y < 1) { p.y = 1; p.vy = 0; }
    p.life -= dt;
    if (p.life <= 0) G.particles.splice(i, 1);
  }
  for (let i = G.skids.length - 1; i >= 0; i -= 1) { G.skids[i].life -= dt; if (G.skids[i].life <= 0) G.skids.splice(i, 1); }
  G.player.hurtT = Math.max(0, (G.player.hurtT || 0) - dt);
}
