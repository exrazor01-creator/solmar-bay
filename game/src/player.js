// Solmar Bay — the player, on foot and behind the wheel. Movement, aiming (the mouse
import { TUNE, WORLD, WEAPONS, WEAPON_ORDER, CHARS, GUN_H, PLACES } from './config.js';
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
  car.speed = 0; // a stolen car stops dead — it must not coast away from a vault hold
  if (car.driver === 'traffic') {
    car.driver = 'player';
    G.peds.push({ x: car.x + 30, z: car.z + 10, angle: 0, speed: 0, state: 'flee', kind: 'walker', hp: 100, fleeT: 5, fx: car.x + 200, fz: car.z + 200, seed: G.rng(), color: '#e74c3c' });
    G.banner = { text: 'Car stolen! The driver ran off — the law will hear about this.', t: 3 };
  } else {
    car.driver = 'player';
    G.banner = { text: car.kind === 'heli' ? 'Helicopter hijacked! Hold Space to climb.' : car.kind === 'boat' ? 'Boat taken! Sail her out to sea.' : 'Car stolen! Keep it quiet.', t: 2 };
  }
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
function switchChar(G) {
  const p = G.player;
  const next = p.char === 'vic' ? 'luna' : 'vic';
  p.char = next;
  p.maxHp = CHARS[next].hp;
  p.hp = Math.min(p.hp, p.maxHp);
  const c = CHARS[next];
  G.banner = { text: `${c.name} is up — ${next === 'luna' ? 'fast feet, light frame' : 'steady hands, heavy hits'}. Press V to switch back.`, t: 3 };
  G.audio.pickup();
}
function ownedWeapons(p) {
  return WEAPON_ORDER.filter((w) => w === 'pistol' || (w === 'shotgun' && p.ownsShotgun) || (w === 'rifle' && p.ownsRifle) || (w === 'sniper' && p.ownsSniper));
}
function cycleWeapon(G) {
  const p = G.player, list = ownedWeapons(p);
  if (list.length < 2) {
    G.banner = { text: list.length === 1 ? 'Only the pistol so far — buy more at Ammo & Health.' : 'No weapons yet.', t: 2 };
    return;
  }
  const i = list.indexOf(p.weapon);
  p.weapon = list[(i + 1) % list.length];
  G.banner = { text: `${WEAPONS[p.weapon].name} out.`, t: 1.5 };
}
function reloadWeapon(G) {
  const p = G.player, w = WEAPONS[p.weapon];
  if (!w.mag) return;
  const magKey = p.weapon === 'rifle' ? 'rifleMag' : 'sniperMag';
  const need = w.mag - (p[magKey] || 0);
  if (need <= 0) { G.banner = { text: 'Magazine already full.', t: 1.5 }; return; }
  if (p.ammo <= 0) { G.banner = { text: 'No ammo to reload with — buy more at Ammo & Health.', t: 2 }; return; }
  const n = Math.min(need, p.ammo);
  p[magKey] = (p[magKey] || 0) + n; p.ammo -= n;
  G.audio.pickup();
  G.banner = { text: `Reloaded ${n} rounds into the ${w.name}.`, t: 2 };
}
function fireWeapon(G) {
  const p = G.player, w = WEAPONS[p.weapon];
  const ox = p.x + Math.cos(p.angle) * 20, oz = p.z + Math.sin(p.angle) * 20;
  if (p.weapon === 'shotgun') {
    if (p.shells <= 0) { p.fireCd = 0.3; G.banner = { text: 'Out of shells — buy more at Ammo & Health.', t: 2 }; return; }
    p.shells -= 1; p.fireCd = w.delay; G.stats.shots += 1;
    for (let i = 0; i < w.pellets; i += 1) spawnBullet(G, ox, GUN_H, oz, p.angle + (Math.random() - 0.5) * w.spread, 'player', w.dmg);
    G.audio.shotgun();
    G.pendingWanted = (G.pendingWanted || 0) + 0.5;
    return;
  }
  if (w.mag) {
    const magKey = p.weapon === 'rifle' ? 'rifleMag' : 'sniperMag';
    if ((p[magKey] || 0) <= 0) { p.fireCd = 0.3; G.banner = { text: 'Magazine empty — press R to reload.', t: 2 }; return; }
    p[magKey] -= 1; p.fireCd = w.delay; G.stats.shots += 1;
    spawnBullet(G, ox, GUN_H, oz, p.angle + (Math.random() - 0.5) * w.spread, 'player', w.dmg);
    if (p.weapon === 'rifle') G.audio.rifle(); else G.audio.sniper();
    G.pendingWanted = (G.pendingWanted || 0) + 0.4;
    return;
  }
  if (p.ammo <= 0) { p.fireCd = 0.3; G.banner = { text: 'Out of ammo — buy more at Ammo & Health.', t: 2 }; return; }
  p.ammo -= 1; p.fireCd = w.delay; G.stats.shots += 1;
  spawnBullet(G, ox, GUN_H, oz, p.angle + (Math.random() - 0.5) * w.spread, 'player', w.dmg);
  G.audio.shoot();
  G.pendingWanted = (G.pendingWanted || 0) + 0.25;
}
function buyShopItem(G, n) {
  const p = G.player, shop = G.shopNear;
  if (!shop) return;
  const pay = (price, what) => {
    if (p.money < price) { G.banner = { text: 'Not enough cash — go earn some first.', t: 2 }; return false; }
    p.money -= price; G.audio.cash(); G.banner = { text: `${what} — $${price}.`, t: 2.5 }; return true;
  };
  if (shop.kind === 'ammo') {
    if (n === 1) { if (p.money >= TUNE.ammoPrice) { p.money -= TUNE.ammoPrice; p.ammo += TUNE.ammoPack; G.audio.cash(); G.banner = { text: `+${TUNE.ammoPack} ammo — $${TUNE.ammoPrice}. Stay safe out there.`, t: 2.5 }; } else G.banner = { text: 'Not enough cash — go earn some first.', t: 2 }; }
    else if (n === 2) { if (p.money >= TUNE.medPrice) { p.money -= TUNE.medPrice; p.hp = p.maxHp || 100; G.audio.cash(); G.banner = { text: `Patched up — $${TUNE.medPrice}. Good as new.`, t: 2.5 }; } else G.banner = { text: 'Not enough cash — go earn some first.', t: 2 }; }
    else if (n === 3) { if (p.money >= TUNE.armorPrice) { p.money -= TUNE.armorPrice; p.armor = Math.min(100, p.armor + TUNE.armorPack); G.audio.cash(); G.banner = { text: `+${TUNE.armorPack} armor — $${TUNE.armorPrice}.`, t: 2.5 }; } else G.banner = { text: 'Not enough cash — go earn some first.', t: 2 }; }
    else if (n === 4) {
      if (!p.ownsShotgun) {
        if (pay(TUNE.shotgunPrice, `Shotgun bought (+${TUNE.shellPack} shells)`)) { p.ownsShotgun = true; p.shells += TUNE.shellPack; }
      } else if (p.money >= TUNE.shellPrice) { p.money -= TUNE.shellPrice; p.shells += TUNE.shellPack; G.audio.cash(); G.banner = { text: `+${TUNE.shellPack} shells — $${TUNE.shellPrice}.`, t: 2.5 }; }
      else G.banner = { text: 'Not enough cash — go earn some first.', t: 2 };
    }
    else if (n === 5) { if (!p.ownsRifle) { if (pay(TUNE.riflePrice, 'Rifle bought (30-round mag)')) { p.ownsRifle = true; p.rifleMag = 30; } } else G.banner = { text: 'You already own the rifle — press R to reload it.', t: 2 }; }
    else if (n === 6) { if (!p.ownsSniper) { if (pay(TUNE.sniperPrice, 'Sniper bought (5-round mag)')) { p.ownsSniper = true; p.sniperMag = 5; } } else G.banner = { text: 'You already own the sniper — press R to reload it.', t: 2 }; }
    else if (n === 7) { if (!p.ownsBat) { if (pay(TUNE.batPrice, 'Bat bought — punches hit twice as hard')) p.ownsBat = true; } else G.banner = { text: 'You already own the bat.', t: 2 }; }
  } else if (shop.kind === 'repair') {
    if (n === 1) { if (p.inCar && p.money >= TUNE.repairPrice) { p.money -= TUNE.repairPrice; p.inCar.hp = p.inCar.maxHp; G.audio.cash(); G.banner = { text: `Car repaired — $${TUNE.repairPrice}.`, t: 2.5 }; } else G.banner = { text: 'Not enough cash — or no car to fix.', t: 2 }; }
    else if (n === 2) { if (p.money >= TUNE.nitroPrice) { p.money -= TUNE.nitroPrice; p.nitro = (p.nitro || 0) + 1; G.audio.cash(); G.banner = { text: `Nitro tank fitted — $${TUNE.nitroPrice}. Hold Shift in a car to boost.`, t: 2.5 }; } else G.banner = { text: 'Not enough cash — go earn some first.', t: 2 }; }
  } else if (shop.kind === 'atm') {
    if (n === 1) { if (p.money >= 100) { p.money -= 100; p.bank = (p.bank || 0) + 100; G.audio.cash(); G.banner = { text: `Deposited $100. Bank balance: $${p.bank}.`, t: 2.5 }; } else G.banner = { text: 'You need at least $100 cash to deposit.', t: 2 }; }
    else if (n === 2) { if ((p.bank || 0) >= 100) { p.bank -= 100; p.money += 100; G.audio.cash(); G.banner = { text: `Withdrew $100. Bank balance: $${p.bank}.`, t: 2.5 }; } else G.banner = { text: 'Not enough in the bank.', t: 2 }; }
    else if (n === 3) { if (p.money > 0) { p.bank = (p.bank || 0) + p.money; G.audio.cash(); G.banner = { text: `Deposited $${p.money}. Bank balance: $${p.bank}.`, t: 2.5 }; p.money = 0; } else G.banner = { text: 'No cash to deposit.', t: 2 }; }
  } else if (shop.kind === 'safehouse') {
    if (!p.safehouse) { if (pay(TUNE.safehousePrice, 'Safehouse bought — the hideout is yours now')) { p.safehouse = true; } }
    else { p.hp = p.maxHp || 100; G.audio.pickup(); G.banner = { text: 'Home sweet home — rested up to full health.', t: 2.5 }; }
  } else if (shop.kind === 'clothes') {
    if (pay(TUNE.outfitPrice, 'New outfit')) { p.outfit = ((p.outfit || 0) + 1) % 3; }
  } else if (shop.kind === 'diner') {
    if (n === 1) { if (p.money >= TUNE.mealPrice) { p.money -= TUNE.mealPrice; p.hp = Math.min(p.maxHp || 100, p.hp + 50); G.audio.cash(); G.banner = { text: `A proper meal — +50 HP. $${TUNE.mealPrice}.`, t: 2.5 }; } else G.banner = { text: 'Not enough cash — go earn some first.', t: 2 }; }
    else if (n === 2) { if (p.money >= TUNE.snackPrice) { p.money -= TUNE.snackPrice; p.hp = Math.min(p.maxHp || 100, p.hp + 25); G.audio.cash(); G.banner = { text: `A quick snack — +25 HP. $${TUNE.snackPrice}.`, t: 2.5 }; } else G.banner = { text: 'Not enough cash — go earn some first.', t: 2 }; }
  }
}
export function updatePlayer(G, dt) {
  const p = G.player, input = G.input;
  p.fireCd = Math.max(0, p.fireCd - dt);
  p.punchCd = Math.max(0, p.punchCd - dt);
  if (G.aim) p.angle = Math.atan2(G.aim.z - p.z, G.aim.x - p.x);
  if (p.inCar) {
    const car = p.inCar;
    if (car.kind === 'heli') { driveHeli(G, dt, input, pressed); return; }
    if (car.kind === 'boat') { driveBoat(G, dt, input, pressed); return; }
    const fwd = pressed(input, 'w', 'ArrowUp') ? 1 : pressed(input, 's', 'ArrowDown') ? -1 : 0;
    const steer = pressed(input, 'a', 'ArrowLeft') ? -1 : pressed(input, 'd', 'ArrowRight') ? 1 : 0;
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
    if (Math.abs(steer) > 0 && Math.abs(car.speed) > 260) {
      const bx = car.x - Math.cos(car.angle) * 22, bz = car.z - Math.sin(car.angle) * 22;
      addSkid(G, bx, bz, bx + Math.cos(car.angle + 1.5) * 6, bz + Math.sin(car.angle + 1.5) * 6);
    }
    if (car.hp < 45 && Math.random() < dt * 6) addParticles(G, car.x, 14, car.z - 10, 1, '#576574', 40, 1, 6);
    G.audio.engine(Math.abs(car.speed) / car.maxSpeed);
    if (take(input, 'e')) exitCar(G);
    if (take(input, 'v')) switchChar(G);
    return;
  }
  G.audio.engine(0);
  const ch = CHARS[p.char || 'vic'];
  let mx = 0, mz = 0;
  if (pressed(input, 'w', 'ArrowUp')) mz -= 1;
  if (pressed(input, 's', 'ArrowDown')) mz += 1;
  if (pressed(input, 'a', 'ArrowLeft')) mx -= 1;
  if (pressed(input, 'd', 'ArrowRight')) mx += 1;
  const sprint = pressed(input, 'Shift');
  const sp = TUNE.walkSpeed * ch.walk * (sprint ? ch.sprint : 1);
  if (mx || mz) {
    const len = Math.hypot(mx, mz);
    const nx = p.x + (mx / len) * sp * dt, nz = p.z + (mz / len) * sp * dt;
    const fixed = collideCircle(G, nx, nz, TUNE.playerRadius);
    p.x = fixed.x; p.z = fixed.z;
    p.walkAngle = Math.atan2(mz, mx);
    p.moving = true;
    p.stepT = (p.stepT || 0) - dt;
    if (p.stepT <= 0) { p.stepT = sprint ? 0.28 : 0.38; G.audio.step(); }
  } else p.moving = false;
  if (take(input, 'e')) tryEnterCar(G);
  if (take(input, 'v')) switchChar(G);
  if (take(input, 'q')) cycleWeapon(G);
  if (take(input, 'r')) reloadWeapon(G);
  if (input.mouse.down && p.fireCd <= 0) fireWeapon(G);
  if (take(input, 'f', ' ') && p.punchCd <= 0) {
    p.punchCd = TUNE.punchDelay; G.audio.punch();
    const hx = p.x + Math.cos(p.angle) * 26, hz = p.z + Math.sin(p.angle) * 26;
    for (const ped of G.peds) {
      if (ped.state !== 'dead' && dist(hx, hz, ped.x, ped.z) < 24) {
        ped.hp -= p.ownsBat ? TUNE.batDmg : TUNE.punchDmg;
        if (ped.hp <= 0) { ped.state = 'dead'; G.stats.kills += 1; if (ped.kind !== 'cop' && ped.kind !== 'swat') G.pendingWanted = (G.pendingWanted || 0) + 2; }
        else { ped.state = 'flee'; ped.fleeT = 4; ped.fx = ped.x + (ped.x - p.x); ped.fz = ped.z + (ped.z - p.z); }
        break;
      }
    }
  }
  const shop = nearestShop(G);
  G.shopNear = shop;
  if (shop && take(input, 'b')) {
    if (shop.kind === 'ammo' && p.money >= TUNE.ammoPrice) {
      p.money -= TUNE.ammoPrice; p.ammo += TUNE.ammoPack; G.audio.cash();
      G.banner = { text: `+${TUNE.ammoPack} ammo — $${TUNE.ammoPrice}. Stay safe out there.`, t: 2.5 };
    } else if (shop.kind === 'ammo' && p.hp < (p.maxHp || 100) && p.money >= TUNE.medPrice) {
      p.money -= TUNE.medPrice; p.hp = p.maxHp || 100; G.audio.cash();
      G.banner = { text: `Patched up — $${TUNE.medPrice}. Good as new.`, t: 2.5 };
    } else if (shop.kind === 'repair' && p.inCar && p.money >= TUNE.repairPrice) {
      p.money -= TUNE.repairPrice; p.inCar.hp = p.inCar.maxHp; G.audio.cash();
      G.banner = { text: `Car repaired — $${TUNE.repairPrice}.`, t: 2.5 };
    } else if (shop.kind === 'atm') buyShopItem(G, 1);
    else if (shop.kind === 'safehouse') buyShopItem(G, 1);
    else if (shop.kind === 'clothes') buyShopItem(G, 1);
    else if (shop.kind === 'diner') buyShopItem(G, 1);
    else {
      G.banner = { text: 'Not enough cash — go earn some first.', t: 2 };
    }
  }
  if (shop) {
    for (const n of [1, 2, 3, 4, 5, 6, 7]) if (take(input, String(n))) buyShopItem(G, n);
  }
}
export function nearestShop(G) {
  const p = G.player;
  const spots = [
    { kind: 'ammo', x: PLACES.ammoShop.x, z: PLACES.ammoShop.z, label: 'Ammo & Health' },
    { kind: 'repair', x: PLACES.repairShop.x, z: PLACES.repairShop.z, label: 'Pit Stop Repair' },
    { kind: 'atm', x: PLACES.bank.x, z: PLACES.bank.z, label: 'Solmar First Bank — ATM' },
    { kind: 'safehouse', x: PLACES.hideout.x, z: PLACES.hideout.z, label: 'Hideout — Safehouse' },
    { kind: 'clothes', x: PLACES.clothing.x, z: PLACES.clothing.z, label: 'Thread & Co' },
    { kind: 'diner', x: PLACES.restaurant.x, z: PLACES.restaurant.z, label: 'Diner 44' },
  ];
  for (const s of spots) if (dist(p.x, p.z, s.x, s.z) < 110) return s;
  return null;
}
