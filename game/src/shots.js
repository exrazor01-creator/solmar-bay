import { STEP, VIEW } from './config.js';
import { clamp, dist, angleDiff } from './random.js';
import { AVENUES, STREETS } from './config.js';
import { startMission, dslSetup } from './missions.js';
import { addWanted } from './police.js';
import { spawnCar } from './traffic.js';
import { spawnHeli } from './vehicles.js';
import { updateCamera } from './render3d.js';
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
function putInCar(G, x, z, angle, kind, color) {
  const car = spawnCar(G, x, z, kind || 'sedan', 'player');
  if (color) car.color = color;
  car.angle = angle; car.speed = 120;
  G.player.inCar = car; G.player.x = x; G.player.z = z;
  return car;
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
  if (name === 'title') {
    G.timeOfDay = 0.72;
    for (let i = 0; i < 5 / STEP; i += 1) stepFn(STEP);
    return { screen: 'title' };
  }
  if (name === 'cover') {
    G.timeOfDay = 0.72;
    startMission(G, 13); skipDialog(G);
    putInCar(G, 2200, 1680, Math.PI, 'supercar', '#e84393');
    addWanted(G, 8, '');
    G.banner = { text: 'HOT WHEELS — WANTED ★★★★ — Lose them at the garage', t: 99 };
    const bus = spawnCar(G, 2300, 1400, 'bus', 'parked'); bus.angle = Math.PI / 2;
    const suv = spawnCar(G, 1900, 1580, 'suv', 'parked'); suv.angle = 0;
    const taxi = spawnCar(G, 1600, 1500, 'taxi', 'traffic'); taxi.angle = Math.PI;
    const sedan = spawnCar(G, 1000, 1500, 'sedan', 'traffic'); sedan.angle = 0;
    driveAutopilot(G, [{ x: 1600, z: 1500 }, { x: 1200, z: 1500 }, { x: 800, z: 1500 }], 3, stepFn);
    if (!G.player.inCar) putInCar(G, G.player.x, G.player.z, Math.PI, 'supercar', '#e84393');
    G.missions.objective = 'Steal the pink supercar — bring it to the garage';
    const pc = G.player.inCar;
    pc.hp = pc.maxHp;
    const cops = G.cars.filter(c => c.driver === 'police' && !c.dead);
    cops.forEach((cop, i) => {
      cop.x = pc.x - 220 - i * 110;
      cop.z = pc.z + (i === 0 ? 25 : -35);
      cop.angle = 0;
      cop.speed = 0;
    });
    const heli = spawnHeli(G, pc.x - 200, pc.z + 120, 'police');
    heli.y = 70; heli.alt = 70; heli.name = 'SHARK-7';
    return { screen: 'play' };
  }
  if (name === 'market') {
    G.timeOfDay = 0.72;
    startMission(G, 20);
    const m = G.missions;
    (m.def.setup || dslSetup)(G);
    const spots = [[1050, 1495], [1120, 1505], [1180, 1500], [980, 1505], [1150, 1495]];
    G.peds.filter((pd) => pd.kind === 'guard').forEach((g, i) => {
      const sp = spots[i % spots.length];
      g.x = sp[0]; g.z = sp[1]; g.tx = sp[0]; g.tz = sp[1]; g.angle = 0;
    });
    G.player.x = 1250; G.player.z = 1500; G.player.angle = Math.PI;
    G.player.weapon = 'rifle'; G.player.ownsRifle = true; G.player.rifleMag = 30; G.player.ammo = 48;
    G.player.money = 18450;
    for (let i = 0; i < 90; i += 1) updateCamera(G, STEP);
    return { screen: 'dialog' };
  }
  if (name === 'map') {
    G.timeOfDay = 0.72;
    G.stats.missionsDone = 7; G.stats.earned = 2400;
    G.player.money = 2450;
    startMission(G, 7); skipDialog(G);
    G.state = 'map';
    return { screen: 'map' };
  }
  G.timeOfDay = 0.72;
  startMission(G, 0); skipDialog(G);
  G.player.x = 860; G.player.z = 1180;
  for (let i = 0; i < 3 / STEP; i += 1) stepFn(STEP);
  return { screen: 'play' };
}
