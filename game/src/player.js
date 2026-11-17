// Solmar Bay — the player, on foot and behind the wheel. Movement, aiming (the mouse
// ray through the 3D camera), shooting, punching, stealing and driving cars, plus
// shops, weapons and nitro. Helis and boats drive through vehicles.js.
import { TUNE, WORLD, WEAPONS, GUN_H, PLACES } from './config.js';
import { clamp, dist } from './random.js';
import { collideCircle } from './world.js';
import { spawnBullet, damageCar, addParticles, addSkid } from './combat.js';
import { driveHeli, driveBoat } from './vehicles.js';
import { pressed, take } from './input.js';

export function nearestCar(G, maxD) {
  let best = null, bd = maxD;
  for (const c of G.cars) {
    if (c.dead || c.driver === 'player') continue;
    const d = dist(G.player.x, G.player.z, c.x, c.z);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

function tryEnterCar(G) {
  const car = nearestCar(G, 70);
  if (!car) return;
  if (car.kind === 'heli' && car.y > 0) { G.banner = { text: 'The heli is in the air — wait for it to land.', t: 2 }; return; }
  if (car.driver === 'traffic') {
    // Carjacking: the driver bails and flees, the police take notice.
    car.driver = 'player';
    G.peds.push({ x: car.x + 30, z: car.z + 10, angle: 0, speed: 0, state: 'flee', kind: 'walker', hp: 100, fleeT: 5, fx: car.x + 200, fz: car.z + 200, seed: G.rng(), color: '#e74c3c' });
    G.banner = { text: 'Car stolen! The driver ran off — the law will hear about this.', t: 3 };
  } else {
    car.driver = 'player';
    G.banner = { text: car.kind === 'heli' ? 'Helicopter hijacked! Hold Space to climb.' : car.kind === 'boat' ? 'Boat taken! Sail her out to sea.' : 'Car stolen! Keep it quiet.', t: 2 };
  }
  // Any theft is a crime the police notice.
  G.pendingWanted = (G.pendingWanted || 0) + 2;
  G.stats.stolen += 1;
  G.player.inCar = car;
  G.player.x = car.x; G.player.z = car.z;
  G.audio.pickup();
}

function exitCar(G) {
  const car = G.player.inCar;
  if (!car) return;
  car.driver = 'parked';
  const a = car.angle + Math.PI / 2;
  G.player.x = car.x + Math.cos(a) * 40; G.player.z = car.z + Math.sin(a) * 40;
  G.player.inCar = null;
  const fixed = collideCircle(G, G.player.x, G.player.z, TUNE.playerRadius);
  G.player.x = fixed.x; G.player.z = fixed.z;
}

function buyShopItem(G, n) {
  const p = G.player, shop = G.shopNear;
  if (!shop) return;
  const pay = (price, what) => {
    if (p.money < price) { G.banner = { text: 'Not enough cash — go earn some first.', t: 2 }; return; }
    p.money -= price; G.audio.cash(); G.banner = { text: `${what} — $${price}.`, t: 2.5 };
  };
  if (shop.kind === 'ammo') {
    if (n === 1) { if (p.money >= TUNE.ammoPrice) { p.money -= TUNE.ammoPrice; p.ammo += TUNE.ammoPack; G.audio.cash(); G.banner = { text: `+${TUNE.ammoPack} ammo — $${TUNE.ammoPrice}. Stay safe out there.`, t: 2.5 }; } else G.banner = { text: 'Not enough cash — go earn some first.', t: 2 }; }
    else if (n === 2) pay(TUNE.medPrice, 'Patched up. Good as new.');
    else if (n === 3) { if (p.money >= TUNE.armorPrice) { p.money -= TUNE.armorPrice; p.armor = Math.min(100, p.armor + TUNE.armorPack); G.audio.cash(); G.banner = { text: `+${TUNE.armorPack} armor — $${TUNE.armorPrice}.`, t: 2.5 }; } else G.banner = { text: 'Not enough cash — go earn some first.', t: 2 }; }
    else if (n === 4) {
      if (!p.ownsShotgun) {
        if (p.money >= TUNE.shotgunPrice) {
          p.money -= TUNE.shotgunPrice; p.ownsShotgun = true; p.shells += TUNE.shellPack; G.audio.cash();
          G.banner = { text: `Shotgun bought (+${TUNE.shellPack} shells) — $${TUNE.shotgunPrice}. Press Q to switch weapons.`, t: 2.5 };
        } else G.banner = { text: 'Not enough cash — go earn some first.', t: 2 };
      } else if (p.money >= TUNE.shellPrice) { p.money -= TUNE.shellPrice; p.shells += TUNE.shellPack; G.audio.cash(); G.banner = { text: `+${TUNE.shellPack} shells — $${TUNE.shellPrice}.`, t: 2.5 }; }
      else G.banner = { text: 'Not enough cash — go earn some first.', t: 2 };
    }
  } else if (shop.kind === 'repair') {
    if (n === 1) { if (p.inCar && p.money >= TUNE.repairPrice) { p.money -= TUNE.repairPrice; p.inCar.hp = p.inCar.maxHp; G.audio.cash(); G.banner = { text: `Car repaired — $${TUNE.repairPrice}.`, t: 2.5 }; } else G.banner = { text: 'Not enough cash — or no car to fix.', t: 2 }; }
    else if (n === 2) { if (p.money >= TUNE.nitroPrice) { p.money -= TUNE.nitroPrice; p.nitro = (p.nitro || 0) + 1; G.audio.cash(); G.banner = { text: `Nitro tank fitted — $${TUNE.nitroPrice}. Hold Shift in a car to boost.`, t: 2.5 }; } else G.banner = { text: 'Not enough cash — go earn some first.', t: 2 }; }
  }
}

export function updatePlayer(G, dt) {
  const p = G.player, input = G.input;
  p.fireCd = Math.max(0, p.fireCd - dt);
  p.punchCd = Math.max(0, p.punchCd - dt);
  // Aim at the mouse: main.js projects the mouse ray onto the ground each frame.
  if (G.aim) p.angle = Math.atan2(G.aim.z - p.z, G.aim.x - p.x);

  if (p.inCar) {
    const car = p.inCar;
    if (car.kind === 'heli') { driveHeli(G, dt, input, pressed); return; }
    if (car.kind === 'boat') { driveBoat(G, dt, input, pressed); return; }
    const fwd = pressed(input, 'w', 'ArrowUp') ? 1 : pressed(input, 's', 'ArrowDown') ? -1 : 0;
    const steer = pressed(input, 'a', 'ArrowLeft') ? -1 : pressed(input, 'd', 'ArrowRight') ? 1 : 0;
    // Nitro: hold Shift to burn a tank for a burst of speed.
    const nitro = pressed(input, 'Shift') && (p.nitro || 0) > 0 && fwd > 0;
    if (fwd > 0) car.speed += car.accel * dt;
    else if (fwd < 0) car.speed -= (car.speed > 0 ? TUNE.carBrake : car.accel * 0.6) * dt;
    else car.speed *= Math.max(0, 1 - 0.7 * dt);
    const top = nitro ? car.maxSpeed * 1.45 : car.maxSpeed;
    car.speed = clamp(car.speed, -TUNE.carReverseMax, top);
    if (nitro) {
      p.nitro -= dt * 0.5;
      if (p.nitro <= 0) p.nitro = 0;
      if (G.rng() < dt * 20) addParticles(G, car.x - Math.cos(car.angle) * 26, 8, car.z - Math.sin(car.angle) * 26, 1, '#ff9f43', 60, 0.3, 4);
    }
    const dir = car.speed >= 0 ? 1 : -1;
    car.angle += steer * car.turn * dt * dir * Math.min(1, Math.abs(car.speed) / 120);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const nz = car.z + Math.sin(car.angle) * car.speed * dt;
    const fixed = collideCircle(G, nx, nz, car.radius);
    if (fixed.hit && Math.abs(car.speed) > 120) {
      damageCar(G, car, Math.abs(car.speed) * 0.03);
      addParticles(G, car.x, 12, car.z, 8, '#dfe4ea', 160, 0.4, 3);
      G.camera.shake = Math.max(G.camera.shake, 5);
      car.speed *= 0.4;
    }
    car.x = fixed.x; car.z = fixed.z;
    p.x = car.x; p.z = car.z;
    // Collide with other cars: shove apart, dent both. Police cars are skipped here —
    // their rams are handled by the pursuit code, so a head-on cruiser cannot pin the
    // player's car in place.
    for (const o of G.cars) {
      if (o === car || o.dead || o.driver === 'police') continue;
      const d = dist(car.x, car.z, o.x, o.z);
      if (d > 0.01 && d < 46) {
        const push = (46 - d) / d;
        car.x += (car.x - o.x) * push * 0.5; car.z += (car.z - o.z) * push * 0.5;
        if (Math.abs(car.speed) > 250) {
          damageCar(G, car, 2); damageCar(G, o, 2);
          G.camera.shake = Math.max(G.camera.shake, 3);
          car.speed *= 0.7;
        }
      }
    }
    // Skid marks on hard turns.
    if (Math.abs(steer) > 0 && Math.abs(car.speed) > 260) {
      const bx = car.x - Math.cos(car.angle) * 22, bz = car.z - Math.sin(car.angle) * 22;
      addSkid(G, bx, bz, bx + Math.cos(car.angle + 1.5) * 6, bz + Math.sin(car.angle + 1.5) * 6);
    }
    if (car.hp < 45 && Math.random() < dt * 6) addParticles(G, car.x, 14, car.z - 10, 1, '#576574', 40, 1, 6);
    G.audio.engine(Math.abs(car.speed) / car.maxSpeed);
    if (take(input, 'e')) exitCar(G);
    return;
  }
  G.audio.engine(0);
  // On foot.
  let mx = 0, mz = 0;
  if (pressed(input, 'w', 'ArrowUp')) mz -= 1;
  if (pressed(input, 's', 'ArrowDown')) mz += 1;
  if (pressed(input, 'a', 'ArrowLeft')) mx -= 1;
  if (pressed(input, 'd', 'ArrowRight')) mx += 1;
  const sprint = pressed(input, 'Shift');
  const sp = TUNE.walkSpeed * (sprint ? TUNE.sprintMul : 1);
  if (mx || mz) {
    const len = Math.hypot(mx, mz);
    const nx = p.x + (mx / len) * sp * dt, nz = p.z + (mz / len) * sp * dt;
    const fixed = collideCircle(G, nx, nz, TUNE.playerRadius);
    p.x = fixed.x; p.z = fixed.z;
    p.walkAngle = Math.atan2(mz, mx);
    p.moving = true;
  } else p.moving = false;
  if (take(input, 'e')) tryEnterCar(G);
  // Switch weapon with Q (pistol <-> shotgun, once bought).
  if (take(input, 'q')) {
    if (p.weapon === 'pistol' && p.ownsShotgun) { p.weapon = 'shotgun'; G.banner = { text: 'Shotgun out. Six pellets, one problem solved.', t: 2 }; }
    else if (p.weapon === 'shotgun') { p.weapon = 'pistol'; G.banner = { text: 'Pistol out.', t: 1.5 }; }
    else G.banner = { text: 'No shotgun yet — buy one at Ammo & Health ($400).', t: 2 };
  }
  // Shoot.
  if (input.mouse.down && p.fireCd <= 0) {
    const w = WEAPONS[p.weapon];
    if (p.weapon === 'shotgun') {
      if (p.shells > 0) {
        p.shells -= 1; p.fireCd = w.delay; G.stats.shots += 1;
        for (let i = 0; i < w.pellets; i += 1) {
          spawnBullet(G, p.x + Math.cos(p.angle) * 20, GUN_H, p.z + Math.sin(p.angle) * 20, p.angle + (Math.random() - 0.5) * w.spread, 'player', w.dmg);
        }
        G.audio.shotgun();
        G.pendingWanted = (G.pendingWanted || 0) + 0.5;
      } else { p.fireCd = 0.3; G.banner = { text: 'Out of shells — buy more at Ammo & Health.', t: 2 }; }
    } else if (p.ammo > 0) {
      p.ammo -= 1; p.fireCd = w.delay; G.stats.shots += 1;
      spawnBullet(G, p.x + Math.cos(p.angle) * 20, GUN_H, p.z + Math.sin(p.angle) * 20, p.angle + (Math.random() - 0.5) * w.spread, 'player', w.dmg);
      G.audio.shoot();
      G.pendingWanted = (G.pendingWanted || 0) + 0.25;
    } else {
      p.fireCd = 0.3; G.banner = { text: 'Out of ammo — buy more at Ammo & Health.', t: 2 };
    }
  }
  // Punch.
  if (take(input, 'f', ' ') && p.punchCd <= 0) {
    p.punchCd = TUNE.punchDelay; G.audio.punch();
    const hx = p.x + Math.cos(p.angle) * 26, hz = p.z + Math.sin(p.angle) * 26;
    for (const ped of G.peds) {
      if (ped.state !== 'dead' && dist(hx, hz, ped.x, ped.z) < 24) {
        ped.hp -= 25;
        if (ped.hp <= 0) { ped.state = 'dead'; G.stats.kills += 1; if (ped.kind !== 'cop') G.pendingWanted = (G.pendingWanted || 0) + 2; }
        else { ped.state = 'flee'; ped.fleeT = 4; ped.fx = ped.x + (ped.x - p.x); ped.fz = ped.z + (ped.z - p.z); }
        break;
      }
    }
  }
  // Shops: B quick-buys, 1-4 buy from the menu.
  const shop = nearestShop(G);
  G.shopNear = shop;
  if (shop && take(input, 'b')) {
    if (shop.kind === 'ammo' && p.money >= TUNE.ammoPrice) {
      p.money -= TUNE.ammoPrice; p.ammo += TUNE.ammoPack; G.audio.cash();
      G.banner = { text: `+${TUNE.ammoPack} ammo — $${TUNE.ammoPrice}. Stay safe out there.`, t: 2.5 };
    } else if (shop.kind === 'ammo' && p.hp < TUNE.playerHp && p.money >= TUNE.medPrice) {
      p.money -= TUNE.medPrice; p.hp = TUNE.playerHp; G.audio.cash();
      G.banner = { text: `Patched up — $${TUNE.medPrice}. Good as new.`, t: 2.5 };
    } else if (shop.kind === 'repair' && p.inCar && p.money >= TUNE.repairPrice) {
      p.money -= TUNE.repairPrice; p.inCar.hp = p.inCar.maxHp; G.audio.cash();
      G.banner = { text: `Car repaired — $${TUNE.repairPrice}.`, t: 2.5 };
    } else {
      G.banner = { text: 'Not enough cash — go earn some first.', t: 2 };
    }
  }
  if (shop) {
    if (take(input, '1')) buyShopItem(G, 1);
    if (take(input, '2')) buyShopItem(G, 2);
    if (take(input, '3')) buyShopItem(G, 3);
    if (take(input, '4')) buyShopItem(G, 4);
  }
}

export function nearestShop(G) {
  const p = G.player;
  const spots = [
    { kind: 'ammo', x: PLACES.ammoShop.x, z: PLACES.ammoShop.z, label: 'Ammo & Health' },
    { kind: 'repair', x: PLACES.repairShop.x, z: PLACES.repairShop.z, label: 'Pit Stop Repair' },
  ];
  for (const s of spots) if (dist(p.x, p.z, s.x, s.z) < 110) return s;
  return null;
}
