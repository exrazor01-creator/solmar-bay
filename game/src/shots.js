// Solmar Bay — screenshot scenes behind ?shot=cover|mission|sunset|night|start.
// Each scene plays the real rules forward from a fresh world for a fixed number of steps,
// steered by a scripted autopilot that drives through the real input path, so the frame is
// what a short game really looks like and the same seed always gives the same frame.
import { STEP, VIEW } from './config.js';
import { clamp, dist, angleDiff } from './random.js';
import { AVENUES, STREETS } from './config.js';
import { startMission } from './missions.js';
import { addWanted } from './police.js';
import { spawnCar } from './traffic.js';

const SAMPLE = STEP;

// Grid route from (x, y) to a marker: avenue, then street, then the marker itself.
function routeTo(G, tx, ty) {
  const x = G.player.x, y = G.player.y;
  const av = AVENUES.reduce((a, b) => Math.abs(b - tx) < Math.abs(a - tx) ? b : a);
  const st = STREETS.reduce((a, b) => Math.abs(b - ty) < Math.abs(a - ty) ? b : a);
  return [{ x: av, y }, { x: av, y: st }, { x: tx, y: ty }];
}

function driveAutopilot(G, waypoints, seconds, stepFn) {
  let wi = 0;
  const input = G.input;
  G.trace = [];
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const car = G.player.inCar;
    if (!car) break;
    while (wi < waypoints.length && dist(car.x, car.y, waypoints[wi].x, waypoints[wi].y) < 140) wi += 1;
    const wp = waypoints[Math.min(wi, waypoints.length - 1)];
    // Find a car blocking the road ahead.
    let blocker = null;
    for (const o of G.cars) {
      if (o === car || o.dead) continue;
      const d = dist(car.x, car.y, o.x, o.y);
      if (d < 110) {
        const ahead = Math.cos(car.angle) * (o.x - car.x) + Math.sin(car.angle) * (o.y - car.y);
        if (ahead > 0 && (!blocker || d < blocker.d)) blocker = { o, d };
      }
    }
    let tx = wp.x, ty = wp.y;
    input.keys.clear();
    if (blocker && (blocker.o.driver === 'parked' || blocker.o.speed < 5)) {
      // Steer around a stopped car: aim ahead and a little to the left — just
      // enough to clear it, so the car stays on the road and rejoins quickly.
      const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
      tx = car.x + fx * 120 - fy * 45; ty = car.y + fy * 120 + fx * 45;
      input.keys.add('w');
    } else if (blocker) {
      // Coast behind a moving car.
    } else {
      input.keys.add('w');
    }
    const want = Math.atan2(ty - car.y, tx - car.x);
    const diff = angleDiff(car.angle, want);
    // Brake on approach to a sharp turn so the car arrives at the intersection
    // slow enough to turn tightly instead of swinging wide off the road.
    if (wi < waypoints.length - 1) {
      const nextWp = waypoints[wi + 1];
      const turnAngle = Math.abs(angleDiff(Math.atan2(wp.y - car.y, wp.x - car.x), Math.atan2(nextWp.y - wp.y, nextWp.x - wp.x)));
      const dWp = dist(car.x, car.y, wp.x, wp.y);
      if (turnAngle > 0.5 && dWp < 300 && Math.abs(car.speed) > 180) { input.keys.delete('w'); input.keys.add('s'); }
    }
    // Slow down for sharp turns so the car stays on the road instead of
    // cutting the corner through a city block.
    if (Math.abs(diff) > 0.9 && Math.abs(car.speed) > 200) { input.keys.delete('w'); input.keys.add('s'); }
    else if (Math.abs(diff) > 0.5) input.keys.delete('w');
    if (diff < -0.05) input.keys.add('a');
    else if (diff > 0.05) input.keys.add('d');
    input.mouse.x = VIEW.w / 2 + Math.cos(want) * 200;
    input.mouse.y = VIEW.h / 2 + Math.sin(want) * 200;
    if (i % 30 === 0) G.trace.push({ t: (i * STEP).toFixed(1), x: Math.round(car.x), y: Math.round(car.y), speed: Math.round(car.speed), blocked: blocker ? `${blocker.o.driver}/${blocker.o.kind}@${Math.round(blocker.d)}` : null });
    stepFn(STEP);
  }
  input.keys.clear();
}

function walkAutopilot(G, tx, ty, seconds, stepFn, shootAt) {
  const input = G.input;
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const p = G.player;
    const dx = tx - p.x, dy = ty - p.y;
    input.keys.clear();
    if (Math.abs(dx) > 30) input.keys.add(dx > 0 ? 'd' : 'a');
    if (Math.abs(dy) > 30) input.keys.add(dy > 0 ? 's' : 'w');
    if (shootAt) {
      const t = shootAt();
      if (t) {
        input.mouse.x = VIEW.w / 2 + (t.x - p.x) * 0.5;
        input.mouse.y = VIEW.h / 2 + (t.y - p.y) * 0.5;
        input.mouse.down = true;
      } else input.mouse.down = false;
    }
    stepFn(STEP);
  }
  input.keys.clear(); input.mouse.down = false;
}

// Put the player in a car at (x, y) heading `angle`.
function putInCar(G, x, y, angle, kind, color) {
  const car = spawnCar(G, x, y, kind || 'sedan', 'player');
  if (color) car.color = color;
  car.angle = angle; car.speed = 120;
  G.player.inCar = car; G.player.x = x; G.player.y = y;
  return car;
}

function skipDialog(G) {
  // Run the mission intro straight through so the mission is live.
  while (G.state === 'dialog') {
    const m = G.missions;
    m.dialogIdx = m.dialog.length;
    m.def.setup(G);
    G.state = 'playing';
  }
}

export function stageShot(name, G, stepFn) {
  G.reset();
  const R = G.rng;
  if (name === 'start') {
    G.timeOfDay = 0.74; // golden hour over downtown
    G.camera.x = clamp(1200 - VIEW.w / 2, 0, 3200 - VIEW.w);
    G.camera.y = clamp(1100 - VIEW.h / 2, 0, 2400 - VIEW.h);
    for (let i = 0; i < 5 / STEP; i += 1) stepFn(STEP);
    return { screen: 'title' };
  }
  if (name === 'cover') {
    // Mission 6, stage 1: three stars, slipping away to the hideout in a stolen sedan,
    // two police cars in pursuit, traffic all around, minimap and HUD live.
    G.timeOfDay = 0.3;
    startMission(G, 5); skipDialog(G);
    G.missions.stage = 1;
    G.missions.objective = 'Three stars! Now slip away to the hideout';
    putInCar(G, 1200, 1100, Math.PI, 'sedan', '#c0392b');
    addWanted(G, 6, '');
    G.banner = { text: 'WANTED ★★★ — Lose them at the hideout', t: 99 };
    // Straight run west along the avenue — the waypoint sits off the west edge,
    // so the car never arrives and never turns around; it stays on the road.
    driveAutopilot(G, [{ x: -100, y: 1100 }], 2.5, stepFn);
    // Line the pursuit up right behind the player's car so the chase reads in-frame.
    const pc = G.player.inCar;
    const cops = G.cars.filter(c => c.driver === 'police' && !c.dead);
    cops.forEach((cop, i) => {
      cop.x = pc.x + 150 + i * 90;
      cop.y = pc.y + (i === 0 ? 35 : -45);
      cop.angle = Math.PI;
      cop.speed = 0;
    });
    return { screen: 'play' };
  }
  if (name === 'mission') {
    // Mission 3, stage 1: package in hand, on foot by the bank, a guard firing,
    // a pedestrian fleeing, objective and ammo on the HUD.
    G.timeOfDay = 0.35;
    startMission(G, 2); skipDialog(G);
    G.missions.stage = 1; G.missions.timer = 82;
    G.missions.marker = { x: 2800, y: 1900, label: 'East Pier' };
    G.missions.objective = 'Package in hand! Deliver it to the east pier';
    G.player.x = 1560; G.player.y = 780; G.player.ammo = 42;
    const guard = { x: 1680, y: 700, angle: 0, speed: 0, state: 'walk', kind: 'guard', hp: 100, tx: 1680, ty: 700, waitT: 99, fleeT: 0, shirt: '#2c3e50', shootCd: 0.5 };
    G.peds.push(guard);
    const ped = { x: 1500, y: 900, angle: 0, speed: 60, state: 'flee', kind: 'walker', hp: 100, tx: 1400, ty: 1000, waitT: 0, fleeT: 5, fx: 1400, fy: 1000, shirt: '#e74c3c' };
    G.peds.push(ped);
    addWanted(G, 2, '');
    walkAutopilot(G, 1900, 900, 5, stepFn, () => (guard.state === 'dead' ? null : guard));
    // Refresh the banner: the shootout raised the wanted level since it was set.
    G.banner = { text: 'WANTED ' + '★'.repeat(G.player.wanted) + '☆'.repeat(5 - G.player.wanted) + ' — Lose the cops', t: 99 };
    return { screen: 'play' };
  }
  if (name === 'sunset') {
    // Golden hour on the beach road: taxi cruise, traffic, pedestrians, palms, ocean.
    G.timeOfDay = 0.74;
    startMission(G, 1); skipDialog(G);
    putInCar(G, 800, 1900, 0, 'taxi', '#f7c948');
    G.missions.marker = { x: 2400, y: 1900, label: 'Hotel Solmar' };
    G.missions.objective = 'Cruise the beach road — Solmar Bay at golden hour';
    driveAutopilot(G, [{ x: 2400, y: 1900 }], 4.5, stepFn);
    return { screen: 'play' };
  }
  // night — mission 7, stage 2: the big score done, four stars, night chase with headlights.
  G.timeOfDay = 0.93;
  startMission(G, 6); skipDialog(G);
  G.missions.stage = 2; G.missions.progress = 1;
  G.missions.marker = { x: 400, y: 1900, label: 'Hideout' };
  G.missions.objective = 'Cash grabbed! Escape to the hideout';
  G.player.money = 3250;
  putInCar(G, 2000, 1500, Math.PI, 'sport', '#8e44ad');
  addWanted(G, 8, '');
  G.banner = { text: 'BANK ROBBERY ★★★★ — Every cop in Solmar Bay is coming', t: 99 };
  driveAutopilot(G, routeTo(G, 400, 1900), 5, stepFn);
  return { screen: 'play' };
}
