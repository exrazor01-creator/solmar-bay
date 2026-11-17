import { STEP, VIEW } from './config.js';
import { clamp, dist, angleDiff } from './random.js';
import { AVENUES, STREETS } from './config.js';
import { startMission, dslSetup } from './missions.js';
import { addWanted } from './police.js';
import { spawnCar } from './traffic.js';
import { spawnHeli, spawnBoat } from './vehicles.js';
function driveAutopilot(G, waypoints, seconds, stepFn) {
  let wi = 0;
  const input = G.input;
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const car = G.player.inCar;
    if (!car) break;
    while (wi < waypoints.length && dist(car.x, car.z, waypoints[wi].x, waypoints[wi].z) < 140) wi += 1;
    const wp = waypoints[Math.min(wi, waypoints.length - 1)];
    let blocker = null;
    for (const o of G.cars) {
      if (o === car || o.dead) continue;
      const d = dist(car.x, car.z, o.x, o.z);
      if (d < 110) {
        const ahead = Math.cos(car.angle) * (o.x - car.x) + Math.sin(car.angle) * (o.z - car.z);
        if (ahead > 0 && (!blocker || d < blocker.d)) blocker = { o, d };
      }
    }
    let tx = wp.x, tz = wp.z;
    input.keys.clear();
    if (blocker && (blocker.o.driver === 'parked' || blocker.o.speed < 5)) {
      const fx = Math.cos(car.angle), fz = Math.sin(car.angle);
      tx = car.x + fx * 120 - fz * 45; tz = car.z + fz * 120 + fx * 45;
      input.keys.add('w');
    } else if (blocker) {
    } else {
      input.keys.add('w');
    }
    const want = Math.atan2(tz - car.z, tx - car.x);
    const diff = angleDiff(car.angle, want);
    if (wi < waypoints.length - 1) {
      const nextWp = waypoints[wi + 1];
      const turnAngle = Math.abs(angleDiff(Math.atan2(wp.z - car.z, wp.x - car.x), Math.atan2(nextWp.z - wp.z, nextWp.x - wp.x)));
      const dWp = dist(car.x, car.z, wp.x, wp.z);
      if (turnAngle > 0.5 && dWp < 300 && Math.abs(car.speed) > 180) { input.keys.delete('w'); input.keys.add('s'); }
    }
    if (Math.abs(diff) > 0.9 && Math.abs(car.speed) > 200) { input.keys.delete('w'); input.keys.add('s'); }
    else if (Math.abs(diff) > 0.5) input.keys.delete('w');
    if (diff < -0.05) input.keys.add('a');
    else if (diff > 0.05) input.keys.add('d');
    input.mouse.x = VIEW.w / 2; input.mouse.y = VIEW.h / 2;
    stepFn(STEP);
  }
  input.keys.clear();
}
function heliAutopilot(G, waypoints, seconds, stepFn) {
  let wi = 0;
  const input = G.input;
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const heli = G.player.inCar;
    if (!heli || heli.kind !== 'heli') break;
    while (wi < waypoints.length && dist(heli.x, heli.z, waypoints[wi].x, waypoints[wi].z) < 120) wi += 1;
    const wp = waypoints[Math.min(wi, waypoints.length - 1)];
    input.keys.clear();
    if (heli.y < 70) input.keys.add(' ');
    else input.keys.add('w');
    const want = Math.atan2(wp.z - heli.z, wp.x - heli.x);
    const diff = angleDiff(heli.angle, want);
    if (diff < -0.05) input.keys.add('a');
    else if (diff > 0.05) input.keys.add('d');
    input.mouse.x = VIEW.w / 2; input.mouse.y = VIEW.h / 2;
    stepFn(STEP);
  }
  input.keys.clear();
}
function boatAutopilot(G, waypoints, seconds, stepFn) {
  let wi = 0;
  const input = G.input;
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const boat = G.player.inCar;
    if (!boat || boat.kind !== 'boat') break;
    while (wi < waypoints.length && dist(boat.x, boat.z, waypoints[wi].x, waypoints[wi].z) < 120) wi += 1;
    const wp = waypoints[Math.min(wi, waypoints.length - 1)];
    input.keys.clear();
    input.keys.add('w');
    const want = Math.atan2(wp.z - boat.z, wp.x - boat.x);
    const diff = angleDiff(boat.angle, want);
    if (diff < -0.05) input.keys.add('a');
    else if (diff > 0.05) input.keys.add('d');
    input.mouse.x = VIEW.w / 2; input.mouse.y = VIEW.h / 2;
    stepFn(STEP);
  }
  input.keys.clear();
}
function walkAutopilot(G, tx, tz, seconds, stepFn, shootAt) {
  const input = G.input;
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const p = G.player;
    const dx = tx - p.x, dz = tz - p.z;
    input.keys.clear();
    if (Math.abs(dx) > 30) input.keys.add(dx > 0 ? 'd' : 'a');
    if (Math.abs(dz) > 30) input.keys.add(dz > 0 ? 's' : 'w');
    if (G.renderer) G.renderer.setCamera(G.camera.eye, G.camera.target);
    if (shootAt) {
      const t = shootAt();
      if (t && G.renderer) {
        const scr = G.renderer.project(t.x, 22, t.z);
        if (scr) { input.mouse.x = scr.x; input.mouse.y = scr.y; input.mouse.down = true; }
        else input.mouse.down = false;
      } else input.mouse.down = false;
    } else if (G.renderer) {
      const scr = G.renderer.project(tx, 22, tz);
      if (scr) { input.mouse.x = scr.x; input.mouse.y = scr.y; }
    }
    stepFn(STEP);
  }
  input.keys.clear(); input.mouse.down = false;
}
function putInCar(G, x, z, angle, kind, color) {
  const car = spawnCar(G, x, z, kind || 'sedan', 'player');
  if (color) car.color = color;
  car.angle = angle; car.speed = 120;
  G.player.inCar = car; G.player.x = x; G.player.z = z;
  return car;
}
function putInHeli(G, x, z, angle, alt) {
  const heli = spawnHeli(G, x, z, 'player');
  heli.angle = angle; heli.y = alt || 0; heli.speed = 80;
  G.player.inCar = heli; G.player.x = x; G.player.z = z;
  return heli;
}
function putInBoat(G, x, z, angle) {
  const boat = spawnBoat(G, x, z, 'player');
  boat.angle = angle; boat.speed = 100;
  G.player.inCar = boat; G.player.x = x; G.player.z = z;
  return boat;
}
function skipDialog(G) {
  while (G.state === 'dialog') {
    const m = G.missions;
    m.dialogIdx = m.dialog.length;
    (m.def.setup || dslSetup)(G);
    G.state = 'playing';
  }
}
export function stageShot(name, G, stepFn) {
  G.reset();
  if (name === 'start') {
    G.timeOfDay = 0.74;
    for (let i = 0; i < 5 / STEP; i += 1) stepFn(STEP);
    return { screen: 'title' };
  }
  if (name === 'cover') {
    G.timeOfDay = 0.3;
    startMission(G, 13); skipDialog(G);
    G.missions.objective = 'Steal the pink supercar — bring it to the garage';
    putInCar(G, 2200, 1680, Math.PI, 'supercar', '#e84393');
    addWanted(G, 8, '');
    G.banner = { text: 'HOT WHEELS — WANTED ★★★★ — Lose them at the garage', t: 99 };
    const bus = spawnCar(G, 2200, 1500, 'bus', 'parked'); bus.angle = Math.PI / 2;
    const suv = spawnCar(G, 2400, 1680, 'suv', 'parked'); suv.angle = 0;
    driveAutopilot(G, [{ x: 1200, z: 1680 }, { x: 800, z: 1500 }], 3, stepFn);
    if (!G.player.inCar) putInCar(G, G.player.x, G.player.z, Math.PI, 'supercar', '#e84393'); // re-seat if the guards wrecked the car
    const pc = G.player.inCar;
    const cops = G.cars.filter(c => c.driver === 'police' && !c.dead);
    cops.forEach((cop, i) => {
      cop.x = pc.x + 90 + i * 60;
      cop.z = pc.z + (i === 0 ? 35 : -45);
      cop.angle = Math.PI;
      cop.speed = 0;
    });
    return { screen: 'play' };
  }
  if (name === 'mission') {
    G.timeOfDay = 0.35;
    startMission(G, 14); skipDialog(G);
    G.missions.objective = 'Fly to Solmar International — stay above the roofs';
    putInHeli(G, 2800, 300, 0, 70);
    addWanted(G, 8, '');
    G.banner = { text: 'SKY HOOK — WANTED ★★★★ — The chopper is up', t: 99 };
    heliAutopilot(G, [{ x: 3010, z: 470 }, { x: 3100, z: 600 }], 4, stepFn);
    if (!G.player.inCar || G.player.inCar.kind !== 'heli') putInHeli(G, 3010, 470, 0, 70); // re-seat if the heli went down
    return { screen: 'play' };
  }
  if (name === 'sunset') {
    G.timeOfDay = 0.68;
    startMission(G, 18); skipDialog(G);
    G.player.char = 'luna'; G.player.maxHp = 85;
    G.missions.objective = 'Get to Club Neon — make some noise';
    G.player.x = 1100; G.player.z = 500;
    G.banner = { text: 'CLUB NEON — Luna is on the town tonight', t: 99 };
    walkAutopilot(G, 1360, 430, 3, stepFn, null);
    return { screen: 'play' };
  }
  G.timeOfDay = 0.92;
  startMission(G, 21); skipDialog(G);
  G.missions.objective = 'Hold E at the vault to crack it (6s) — six stars!';
  G.player.x = 1500; G.player.z = 700; G.player.ammo = 42; G.player.ownsSniper = true; G.player.sniperMag = 5; G.player.weapon = 'sniper';
  addWanted(G, 12, '');
  for (const [sx, sz] of [[1500, 700], [1660, 760]]) {
    G.peds.push({ x: sx, z: sz, angle: 0, speed: 235, state: 'walk', kind: 'swat', hp: 150, tx: sx, tz: sz, waitT: 0, fleeT: 0, color: '#2d3436', seed: G.rng(), punchCd: 0 });
  }
  const bus = spawnCar(G, 1500, 1100, 'bus', 'parked'); bus.angle = Math.PI / 2;
  const suv = spawnCar(G, 1700, 1200, 'suv', 'parked'); suv.angle = 0;
  G.banner = { text: 'THE CROWN — WANTED ★★★★★★ — SWAT is on the ground', t: 99 };
  walkAutopilot(G, 2000, 700, 2.5, stepFn, null);
  return { screen: 'play' };
}
