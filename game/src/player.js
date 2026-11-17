// Solmar Bay — the player, on foot and behind the wheel. Movement, aiming, shooting,
// punching, stealing and driving cars, plus shop prompts near stores.
import { TUNE, WORLD } from './config.js';
import { clamp, dist, angleDiff } from './random.js';
import { collideCircle, onRoad } from './world.js';
import { spawnBullet, damageCar, addParticles, addSkid } from './combat.js';
import { pressed, justPressed } from './input.js';

export function nearestCar(G, maxD) {
  let best = null, bd = maxD;
  for (const c of G.cars) {
    if (c.dead || c.driver === 'player') continue;
    const d = dist(G.player.x, G.player.y, c.x, c.y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

function tryEnterCar(G) {
  const car = nearestCar(G, 70);
  if (!car) return;
  if (car.driver === 'traffic') {
    // Carjacking: the driver bails and flees, the police take notice.
    car.driver = 'player';
    const ped = { x: car.x + 30, y: car.y + 10, angle: 0, speed: 0, state: 'flee', kind: 'walker', hp: 100, fleeT: 5, fx: car.x + 200, fy: car.y + 200 };
    G.peds.push(ped);
    G.banner = { text: 'Car stolen! The driver ran off — the law will hear about this.', t: 3 };
  } else {
    car.driver = 'player';
    G.banner = { text: 'Car stolen! Keep it quiet.', t: 2 };
  }
  // Any theft is a crime the police notice.
  G.pendingWanted = (G.pendingWanted || 0) + 2;
  G.stats.stolen += 1;
  G.player.inCar = car;
  G.player.x = car.x; G.player.y = car.y;
  G.audio.pickup();
}

function exitCar(G) {
  const car = G.player.inCar;
  if (!car) return;
  car.driver = 'parked';
  const a = car.angle + Math.PI / 2;
  G.player.x = car.x + Math.cos(a) * 40; G.player.y = car.y + Math.sin(a) * 40;
  G.player.inCar = null;
  const fixed = collideCircle(G, G.player.x, G.player.y, TUNE.playerRadius);
  G.player.x = fixed.x; G.player.y = fixed.y;
}

export function updatePlayer(G, dt) {
  const p = G.player, input = G.input;
  p.fireCd = Math.max(0, p.fireCd - dt);
  p.punchCd = Math.max(0, p.punchCd - dt);
  // Aim at the mouse (world space through the camera).
  const mwx = G.camera.x + input.mouse.x, mwy = G.camera.y + input.mouse.y;
  p.angle = Math.atan2(mwy - p.y, mwx - p.x);

  if (p.inCar) {
    const car = p.inCar;
    const fwd = pressed(input, 'w', 'ArrowUp') ? 1 : pressed(input, 's', 'ArrowDown') ? -1 : 0;
    const steer = pressed(input, 'a', 'ArrowLeft') ? -1 : pressed(input, 'd', 'ArrowRight') ? 1 : 0;
    if (fwd > 0) car.speed += TUNE.carAccel * dt;
    else if (fwd < 0) car.speed -= (car.speed > 0 ? TUNE.carBrake : TUNE.carAccel * 0.6) * dt;
    else car.speed *= Math.max(0, 1 - 0.7 * dt);
    car.speed = clamp(car.speed, -TUNE.carReverseMax, TUNE.carMaxSpeed);
    const dir = car.speed >= 0 ? 1 : -1;
    car.angle += steer * TUNE.carTurn * dt * dir * Math.min(1, Math.abs(car.speed) / 120);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const fixed = collideCircle(G, nx, ny, TUNE.carRadius);
    if (fixed.hit && Math.abs(car.speed) > 120) {
      damageCar(G, car, Math.abs(car.speed) * 0.03);
      addParticles(G, car.x, car.y, 8, '#dfe4ea', 160, 0.4, 3);
      G.camera.shake = Math.max(G.camera.shake, 5);
      car.speed *= 0.4;
    }
    car.x = fixed.x; car.y = fixed.y;
    p.x = car.x; p.y = car.y;
    // Collide with other cars: shove apart, dent both. Police cars are skipped here —
    // their rams are handled by the pursuit code, so a head-on cruiser cannot pin the
    // player's car in place.
    for (const o of G.cars) {
      if (o === car || o.dead || o.driver === 'police') continue;
      const d = dist(car.x, car.y, o.x, o.y);
      if (d > 0.01 && d < 46) {
        const push = (46 - d) / d;
        car.x += (car.x - o.x) * push * 0.5; car.y += (car.y - o.y) * push * 0.5;
        if (Math.abs(car.speed) > 250) {
          damageCar(G, car, 2); damageCar(G, o, 2);
          G.camera.shake = Math.max(G.camera.shake, 3);
          car.speed *= 0.7;
        }
      }
    }
    // Skid marks on hard turns.
    if (Math.abs(steer) > 0 && Math.abs(car.speed) > 260) {
      const bx = car.x - Math.cos(car.angle) * 22, by = car.y - Math.sin(car.angle) * 22;
      addSkid(G, bx, by, bx + Math.cos(car.angle + 1.5) * 6, by + Math.sin(car.angle + 1.5) * 6);
    }
    if (car.hp < 45 && Math.random() < dt * 6) addParticles(G, car.x, car.y - 10, 1, '#576574', 40, 1, 6);
    G.audio.engine(Math.abs(car.speed) / TUNE.carMaxSpeed);
    if (justPressed(input, 'e')) exitCar(G);
    return;
  }
  G.audio.engine(0);
  // On foot.
  let mx = 0, my = 0;
  if (pressed(input, 'w', 'ArrowUp')) my -= 1;
  if (pressed(input, 's', 'ArrowDown')) my += 1;
  if (pressed(input, 'a', 'ArrowLeft')) mx -= 1;
  if (pressed(input, 'd', 'ArrowRight')) mx += 1;
  const sprint = pressed(input, 'Shift');
  const sp = TUNE.walkSpeed * (sprint ? TUNE.sprintMul : 1);
  if (mx || my) {
    const len = Math.hypot(mx, my);
    const nx = p.x + (mx / len) * sp * dt, ny = p.y + (my / len) * sp * dt;
    const fixed = collideCircle(G, nx, ny, TUNE.playerRadius);
    p.x = fixed.x; p.y = fixed.y;
    p.walkAngle = Math.atan2(my, mx);
    p.moving = true;
  } else p.moving = false;
  if (justPressed(input, 'e')) tryEnterCar(G);
  // Shoot.
  if (input.mouse.down && p.fireCd <= 0) {
    if (p.ammo > 0) {
      p.ammo -= 1; p.fireCd = TUNE.fireDelay; G.stats.shots += 1;
      spawnBullet(G, p.x + Math.cos(p.angle) * 20, p.y + Math.sin(p.angle) * 20, p.angle + (Math.random() - 0.5) * 0.05, 'player');
      G.audio.shoot();
      G.pendingWanted = (G.pendingWanted || 0) + 0.25;
    } else {
      p.fireCd = 0.3; G.banner = { text: 'Out of ammo — buy more at Ammo & Health.', t: 2 };
    }
  }
  // Punch.
  if (justPressed(input, 'f', ' ') && p.punchCd <= 0) {
    p.punchCd = TUNE.punchDelay; G.audio.punch();
    const hx = p.x + Math.cos(p.angle) * 26, hy = p.y + Math.sin(p.angle) * 26;
    for (const ped of G.peds) {
      if (ped.state !== 'dead' && dist(hx, hy, ped.x, ped.y) < 24) {
        ped.hp -= 25;
        if (ped.hp <= 0) { ped.state = 'dead'; G.stats.kills += 1; if (ped.kind !== 'cop') G.pendingWanted = (G.pendingWanted || 0) + 2; }
        else { ped.state = 'flee'; ped.fleeT = 4; ped.fx = ped.x + (ped.x - p.x); ped.fy = ped.y + (ped.y - p.y); }
        break;
      }
    }
  }
  // Shops: B buys near a store.
  const shop = nearestShop(G);
  G.shopNear = shop;
  if (shop && justPressed(input, 'b')) {
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
}

export function nearestShop(G) {
  const p = G.player;
  const spots = [
    { kind: 'ammo', x: 1200, y: 1500, label: 'Ammo & Health' },
    { kind: 'repair', x: 2000, y: 1500, label: 'Pit Stop Repair' },
  ];
  for (const s of spots) if (dist(p.x, p.y, s.x, s.y) < 110) return s;
  return null;
}
