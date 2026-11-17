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
import { spawnHeli, spawnBoat } from './vehicles.js';

const SAMPLE = STEP;

// Grid route from (x, z) to a marker: avenue, then street, then the marker itself.
function routeTo(G, tx, tz) {
  const x = G.player.x, z = G.player.z;
  const av = AVENUES.reduce((a, b) => Math.abs(b - tx) < Math.abs(a - tx) ? b : a);
  const st = STREETS.reduce((a, b) => Math.abs(b - tz) < Math.abs(a - tz) ? b : a);
  return [{ x: av, z }, { x: av, z: st }, { x: tx, z: tz }];
}

function driveAutopilot(G, waypoints, seconds, stepFn) {
  let wi = 0;
  const input = G.input;
  G.trace = [];
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const car = G.player.inCar;
    if (!car) break;
    while (wi < waypoints.length && dist(car.x, car.z, waypoints[wi].x, waypoints[wi].z) < 140) wi += 1;
    const wp = waypoints[Math.min(wi, waypoints.length - 1)];
    // Find a car blocking the road ahead.
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
      // Steer around a stopped car: aim ahead and a little to the left — just
      // enough to clear it, so the car stays on the road and rejoins quickly.
      const fx = Math.cos(car.angle), fz = Math.sin(car.angle);
      tx = car.x + fx * 120 - fz * 45; tz = car.z + fz * 120 + fx * 45;
      input.keys.add('w');
    } else if (blocker) {
      // Coast behind a moving car.
    } else {
      input.keys.add('w');
    }
    const want = Math.atan2(tz - car.z, tx - car.x);
    const diff = angleDiff(car.angle, want);
    // Brake on approach to a sharp turn so the car arrives at the intersection
    // slow enough to turn tightly instead of swinging wide off the road.
    if (wi < waypoints.length - 1) {
      const nextWp = waypoints[wi + 1];
      const turnAngle = Math.abs(angleDiff(Math.atan2(wp.z - car.z, wp.x - car.x), Math.atan2(nextWp.z - wp.z, nextWp.x - wp.x)));
      const dWp = dist(car.x, car.z, wp.x, wp.z);
      if (turnAngle > 0.5 && dWp < 300 && Math.abs(car.speed) > 180) { input.keys.delete('w'); input.keys.add('s'); }
    }
    // Slow down for sharp turns so the car stays on the road instead of
    // cutting the corner through a city block.
    if (Math.abs(diff) > 0.9 && Math.abs(car.speed) > 200) { input.keys.delete('w'); input.keys.add('s'); }
    else if (Math.abs(diff) > 0.5) input.keys.delete('w');
    if (diff < -0.05) input.keys.add('a');
    else if (diff > 0.05) input.keys.add('d');
    input.mouse.x = VIEW.w / 2; input.mouse.y = VIEW.h / 2;
    if (i % 30 === 0) G.trace.push({ t: (i * STEP).toFixed(1), x: Math.round(car.x), z: Math.round(car.z), speed: Math.round(car.speed), blocked: blocker ? `${blocker.o.driver}/${blocker.o.kind}@${Math.round(blocker.d)}` : null });
    stepFn(STEP);
  }
  input.keys.clear();
}

// Fly a helicopter toward waypoints: climb first, then thrust and steer.
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

// Sail a boat toward waypoints along the coast.
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
    // Refresh the view-projection before projecting: during staged
    // (synchronous) play no render has run yet, so vp is undefined until
    // setCamera is called.
    if (G.renderer) G.renderer.setCamera(G.camera.eye, G.camera.target);
    if (shootAt) {
      const t = shootAt();
      if (t && G.renderer) {
        const scr = G.renderer.project(t.x, 22, t.z);
        if (scr) { input.mouse.x = scr.x; input.mouse.y = scr.y; input.mouse.down = true; }
        else input.mouse.down = false;
      } else input.mouse.down = false;
    } else if (G.renderer) {
      // Aim where we walk so the player faces the direction of travel: the
      // chase camera then stays behind them on the road instead of swinging
      // into a city block and blanking the frame behind a rooftop.
      const scr = G.renderer.project(tx, 22, tz);
      if (scr) { input.mouse.x = scr.x; input.mouse.y = scr.y; }
    }
    stepFn(STEP);
  }
  input.keys.clear(); input.mouse.down = false;
}

// Put the player in a car at (x, z) heading `angle`.
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
  if (name === 'start') {
    G.timeOfDay = 0.74; // golden hour over downtown
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
    driveAutopilot(G, [{ x: -100, z: 1100 }], 2.5, stepFn);
    // Line the pursuit up right behind the player's car so the chase reads in-frame.
    // Both cars sit ahead of the chase camera (camera ~235 behind the player).
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
    // Mission 10, stage 1: the helicopter over Solmar Tower, the police chopper
    // closing in, the whole downtown skyline below.
    G.timeOfDay = 0.35;
    startMission(G, 9); skipDialog(G);
    G.missions.stage = 1;
    G.missions.objective = 'Fly to Solmar Tower — hover over the roof to grab the package';
    putInHeli(G, 1600, 1100, 0, 70);
    addWanted(G, 8, '');
    G.banner = { text: 'WANTED ★★★★ — The chopper is up', t: 99 };
    heliAutopilot(G, [{ x: 1800, z: 1300 }, { x: 2200, z: 1300 }], 4, stepFn);
    return { screen: 'play' };
  }
  if (name === 'sunset') {
    // Mission 8: the getaway by boat at dusk — the marina, the harbour, the
    // lighthouse and the open sea, with the sun low over the water.
    G.timeOfDay = 0.68;
    startMission(G, 7); skipDialog(G);
    G.missions.stage = 1;
    G.missions.objective = 'Sail east to the far pier — stay in the water';
    putInBoat(G, 400, 2290, 0);
    G.banner = { text: 'THE GETAWAY — Sail east along the coast', t: 99 };
    boatAutopilot(G, [{ x: 1600, z: 2330 }, { x: 2600, z: 2330 }], 4.5, stepFn);
    return { screen: 'play' };
  }
  // night — the city by day: downtown, the tower, traffic of every kind, a package
  // on the sidewalk, the HUD and minimap alive.
  G.timeOfDay = 0.3;
  G.player.x = 1560; G.player.z = 780; G.player.ammo = 42;
  const bike = spawnCar(G, 1500, 1100, 'bike', 'parked'); bike.angle = Math.PI / 2;
  const truck = spawnCar(G, 1700, 1200, 'truck', 'parked'); truck.angle = 0;
  const sport = spawnCar(G, 1600, 1000, 'sport', 'parked'); sport.angle = Math.PI;
  G.banner = { text: 'Downtown Solmar Bay — 12 missions, helicopters, boats, races', t: 99 };
  // Walk the roads, not through the blocks: south down avenue 1600, then east
  // along street 1100 — a straight line would wedge the player (and the camera)
  // against a building and blank the frame.
  walkAutopilot(G, 1600, 1100, 2.5, stepFn, null);
  walkAutopilot(G, 1800, 1100, 2, stepFn, null);
  return { screen: 'play' };
}
