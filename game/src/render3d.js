// Solmar Bay — the 3D renderer. Turns the 2D game state (all logic lives on the
// ground plane x,z) into a low-poly 3D scene: the city, the sea, the vehicles, the
// people, the markers and the effects. Also owns the chase camera.
import { AVENUES, STREETS, ROAD_W, WORLD, BEACH_Z, WATER_Z, PALETTE, FLOOR_H, PLAYER_H } from './config.js';
import { skyAt, parseColor } from './gl.js';
import { clamp, lerp, dist, angleDiff } from './random.js';
import { pointInBuilding } from './world.js';

const PLACE_COLORS = {
  garage: '#e67e22', hospital: '#e74c3c', bank: '#f1c40f', ammoShop: '#2ecc71', repairShop: '#3498db',
  hideout: '#9b59b6', taxiStand: '#f7c948', helipad: '#e67e22', marina: '#1abc9c', tower: '#ecf0f1',
  raceStart: '#e84393', lighthouse: '#f1c40f', harbor: '#95a5a6', hotel: '#fd79a8',
};
const SKIN = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524'];

function buildingAt(G, x, z) {
  for (const b of G.world.buildings) {
    if (x >= b.x && x <= b.x + b.w && z >= b.z && z <= b.z + b.d) return b;
  }
  return null;
}

export function updateCamera(G, dt) {
  const p = G.player, cam = G.camera;
  const inCar = p.inCar;
  const mode = inCar ? (inCar.kind === 'heli' ? 'heli' : inCar.kind === 'boat' ? 'boat' : 'car') : 'foot';
  const cfg = mode === 'heli' ? { dist: 300, height: 200 } : mode === 'foot' ? { dist: 170, height: 105 } : { dist: 235, height: 135 };
  const heading = inCar ? inCar.angle : p.angle;
  // Smooth the heading so the camera swings round instead of snapping.
  cam.heading += angleDiff(cam.heading, heading) * (1 - Math.exp(-dt * 2.2));
  const px = p.x, pz = p.z, py = (inCar && inCar.kind === 'heli') ? inCar.y : 0;
  const wantEye = [
    px - Math.cos(cam.heading) * cfg.dist,
    py + cfg.height,
    pz - Math.sin(cam.heading) * cfg.dist,
  ];
  // Keep the camera out of buildings: rise above the roof it would sit in.
  const b = buildingAt(G, wantEye[0], wantEye[2]);
  if (b) wantEye[1] = Math.max(wantEye[1], b.floors * FLOOR_H + 40);
  wantEye[1] = Math.max(wantEye[1], 32);
  const k = 1 - Math.exp(-dt * 4.5);
  cam.eye[0] += (wantEye[0] - cam.eye[0]) * k;
  cam.eye[1] += (wantEye[1] - cam.eye[1]) * k;
  cam.eye[2] += (wantEye[2] - cam.eye[2]) * k;
  const wantTarget = [px, py + 22, pz];
  const k2 = 1 - Math.exp(-dt * 7);
  cam.target[0] += (wantTarget[0] - cam.target[0]) * k2;
  cam.target[1] += (wantTarget[1] - cam.target[1]) * k2;
  cam.target[2] += (wantTarget[2] - cam.target[2]) * k2;
  // Screen shake (explosions, hard hits): a decaying random offset.
  if (cam.shake > 0) {
    cam.shake = Math.max(0, cam.shake - dt * 22);
    const s = cam.shake;
    cam.eye[0] += (G.rng() - 0.5) * s; cam.eye[1] += (G.rng() - 0.5) * s * 0.6; cam.eye[2] += (G.rng() - 0.5) * s;
  }
}

function drawCar(R, car, time) {
  const x = car.x, z = car.z, y = car.y || 0, a = car.angle;
  // Blob shadow on the ground (helis cast it from the air, offset by altitude).
  if (car.kind !== 'boat') {
    const sh = car.kind === 'heli' ? clamp(1 - car.y / 260, 0.25, 1) : 1;
    R.flat(x - 26, z - 20, 52, 40, 0.2, [0, 0, 0, 0.28 * sh]);
  }
  if (car.dead) {
    R.box(x, y + 7, z, 52, 12, 26, '#2f3542', a);
    return;
  }
  if (car.kind === 'heli') {
    const alt = car.y;
    R.box(x, alt + 12, z, 46, 16, 24, car.color, a); // fuselage
    R.box(x - Math.cos(a) * 34, alt + 12, z - Math.sin(a) * 34, 26, 8, 8, car.color, a); // tail
    R.box(x + Math.cos(a) * 18, alt + 20, z + Math.sin(a) * 18, 14, 8, 18, '#9fd8e8', a); // cockpit glass
    // Rotor: two blades spinning around Y, plus a thin mast.
    R.box(x, alt + 22, z, 2, 6, 2, '#2f3542', a);
    const rot = car.rotor || 0;
    R.box(x, alt + 25, z, 64, 2, 4, '#2f3542', rot);
    R.box(x, alt + 25, z, 4, 2, 64, '#2f3542', rot);
    if (car.driver === 'police') {
      const flash = Math.floor(time * 6) % 2 === 0 ? '#ff4757' : '#3742fa';
      R.box(x, alt + 21, z, 10, 4, 10, flash, a);
    }
    return;
  }
  if (car.kind === 'boat') {
    R.box(x, y + 7, z, 54, 12, 26, '#ecf0f1', a); // hull
    R.box(x, y + 16, z, 24, 10, 18, '#2e7f9e', a); // cabin
    R.box(x - Math.cos(a) * 22, y + 12, z - Math.sin(a) * 22, 10, 8, 20, '#c0392b', a); // stern
    return;
  }
  // Ordinary road vehicles.
  const len = car.kind === 'truck' ? 74 : car.kind === 'bike' ? 42 : 52;
  const wid = car.kind === 'bike' ? 12 : car.kind === 'truck' ? 28 : 26;
  const h = car.kind === 'truck' ? 18 : car.kind === 'van' ? 22 : 13;
  R.box(x, y + h / 2 + 3, z, len, h, wid, car.color, a); // body
  if (car.kind === 'bike') {
    R.box(x, y + 20, z, 16, 12, 10, '#2f3542', a); // rider
    R.box(x + Math.cos(a) * 18, y + 5, z + Math.sin(a) * 18, 8, 10, 4, '#1a1a1a', a);
    R.box(x - Math.cos(a) * 18, y + 5, z - Math.sin(a) * 18, 8, 10, 4, '#1a1a1a', a);
    return;
  }
  R.box(x - Math.cos(a) * 4, y + h + 7, z - Math.sin(a) * 4, len * 0.45, 10, wid * 0.78, '#2c3e50', a); // cabin
  // Wheels.
  const fx = Math.cos(a), fz = Math.sin(a), rx = -fz, rz = fx;
  for (const s of [-1, 1]) for (const t of [-1, 1]) {
    R.box(x + fx * len * 0.32 * s + rx * wid * 0.5 * t, y + 5, z + fz * len * 0.32 * s + rz * wid * 0.5 * t, 10, 10, 6, '#1a1a1a', a);
  }
  if (car.kind === 'taxi') R.box(x, y + h + 15, z, 14, 5, 10, '#f7c948', a); // roof sign
  if (car.kind === 'police') {
    const flash = Math.floor(time * 6) % 2 === 0 ? '#ff4757' : '#3742fa';
    R.box(x - Math.cos(a) * 4, y + h + 14, z - Math.sin(a) * 4, 16, 4, 8, flash, a);
    R.box(x, y + h / 2 + 3, z, len * 0.9, 3, wid + 1, '#ecf0f1', a); // white stripe
  }
  if (car.kind === 'truck') R.box(x - Math.cos(a) * 18, y + 22, z - Math.sin(a) * 18, 30, 22, 24, '#b0a08a', a); // cargo
}

function drawPed(R, ped, time) {
  const x = ped.x, z = ped.z;
  R.flat(x - 10, z - 8, 20, 16, 0.2, [0, 0, 0, 0.25]);
  const walk = Math.sin(time * 8 + ped.seed * 10) * 3;
  R.box(x, 13 + Math.abs(walk) * 0.4, z, 14, 26, 12, ped.color || '#7f8c8d', ped.angle);
  R.box(x, 32, z, 11, 11, 11, SKIN[Math.floor(ped.seed * 4) % 4], ped.angle);
  if (ped.kind === 'cop') R.box(x, 39, z, 12, 4, 12, '#1c4ed8', ped.angle);
  if (ped.kind === 'guard') R.box(x + Math.cos(ped.angle) * 10, 20, z + Math.sin(ped.angle) * 10, 14, 4, 4, '#1a1a1a', ped.angle);
  if (ped.kind === 'passenger') {
    R.box(x, 52 + Math.sin(time * 3) * 3, z, 10, 10, 10, '#f7c948', time * 2);
  }
}

function drawPlayer(R, G, time) {
  const p = G.player;
  if (p.inCar) return; // inside the vehicle
  const x = p.x, z = p.z;
  R.flat(x - 11, z - 9, 22, 18, 0.2, [0, 0, 0, 0.3]);
  const bob = Math.abs(Math.sin(time * 9)) * (p.moving ? 2 : 0);
  R.box(x, 13 + bob, z, 16, 24, 14, PALETTE.playerShirt, p.angle); // body
  R.box(x, 31 + bob, z, 12, 12, 12, '#f1c27d', p.angle); // head
  R.box(x, 37 + bob, z, 13, 4, 13, '#ffd23e', p.angle); // cap
  // Gun in the hands, pointing where the player aims.
  const gx = x + Math.cos(p.angle) * 12, gz = z + Math.sin(p.angle) * 12;
  R.box(gx, 20 + bob, gz, 12, 4, 4, '#1a1a1a', p.angle);
}

export function render3D(G, R) {
  const time = G.time, sky = skyAt(G.timeOfDay);
  R.setCamera(G.camera.eye, G.camera.target);
  R.begin(sky);
  const night = sky.night;

  // ---- ground: grass, sand, sea, roads, sidewalks, parks ----
  R.flat(0, 0, WORLD.w, BEACH_Z, 0, PALETTE.grass);
  R.flat(0, BEACH_Z, WORLD.w, WATER_Z - BEACH_Z, 0.05, PALETTE.sand);
  // The sea: a wave grid, vertex heights and colours animated by time.
  const cols = 16, rows = 6, cw = WORLD.w / cols, cd = (WORLD.h - WATER_Z) / rows;
  for (let i = 0; i < cols; i += 1) for (let j = 0; j < rows; j += 1) {
    const x0 = i * cw, z0 = WATER_Z + j * cd;
    const wave = (x, z) => Math.sin(x * 0.02 + time * 1.2) * 1.4 + Math.cos(z * 0.03 + time * 0.9) * 1.4;
    const colAt = (x, z) => (wave(x, z) > 0.5 ? '#5aa8c4' : (j >= 4 ? PALETTE.waterDeep : PALETTE.water));
    R.quad(
      [x0, -2 + wave(x0, z0), z0], [x0 + cw, -2 + wave(x0 + cw, z0), z0],
      [x0 + cw, -2 + wave(x0 + cw, z0 + cd), z0 + cd], [x0, -2 + wave(x0, z0 + cd), z0 + cd],
      [colAt(x0, z0), colAt(x0 + cw, z0), colAt(x0 + cw, z0 + cd), colAt(x0, z0 + cd)], [0, 1, 0],
    );
  }
  for (const a of AVENUES) R.flat(a - ROAD_W / 2, 0, ROAD_W, BEACH_Z, 0.1, PALETTE.road);
  for (const s of STREETS) R.flat(0, s - ROAD_W / 2, WORLD.w, ROAD_W, 0.1, PALETTE.road);
  for (const a of AVENUES) {
    R.flat(a - ROAD_W / 2 - 14, 0, 14, BEACH_Z, 0.12, PALETTE.sidewalk);
    R.flat(a + ROAD_W / 2, 0, 14, BEACH_Z, 0.12, PALETTE.sidewalk);
  }
  for (const s of STREETS) {
    R.flat(0, s - ROAD_W / 2 - 14, WORLD.w, 14, 0.12, PALETTE.sidewalk);
    R.flat(0, s + ROAD_W / 2, WORLD.w, 14, 0.12, PALETTE.sidewalk);
  }
  // Centre dashes.
  for (const a of AVENUES) for (let z = 100; z < BEACH_Z - 60; z += 200) R.flat(a - 3, z, 6, 60, 0.14, PALETTE.roadLine);
  for (const s of STREETS) for (let x = 100; x < WORLD.w - 60; x += 200) R.flat(x, s - 3, 60, 6, 0.14, PALETTE.roadLine);
  for (const pk of G.world.parks) R.flat(pk.x, pk.z, pk.w, pk.d, 0.06, PALETTE.grassDry);

  // ---- buildings ----
  const glass = night ? '#ffd97a' : PALETTE.glass;
  for (const b of G.world.buildings) {
    const h = b.floors * FLOOR_H, cx = b.x + b.w / 2, cz = b.z + b.d / 2;
    R.box(cx, h / 2, cz, b.w, h, b.d, b.color);
    R.box(cx, h + 3, cz, b.w - 10, 6, b.d - 10, '#5b6470'); // roof cap
    if (b.floors >= 3) {
      // Glass strips on the south and east faces — warm and lit at night.
      R.box(cx, h * 0.55, cz + b.d / 2 + 1, b.w * 0.7, h * 0.6, 2, glass);
      R.box(cx + b.w / 2 + 1, h * 0.55, cz, 2, h * 0.6, b.d * 0.7, glass);
    }
    if (b.landmark === 'tower') {
      // Helipad on the roof: a flat disc with an H.
      R.cyl(cx, h + 6, cz, 42, 3, '#3a3f47', 12);
      R.flat(cx - 24, cz - 4, 48, 8, h + 10, '#f1c40f');
      R.flat(cx - 4, cz - 24, 8, 48, h + 10, '#f1c40f');
    }
    if (b.landmark === 'lighthouse') {
      R.cyl(cx, h, cz, 16, 60, '#ecf0f1', 8);
      R.box(cx, h + 66, cz, 22, 12, 22, night ? '#ffe66d' : '#f1c40f');
    }
  }

  // ---- trees ----
  for (const t of G.world.trees) {
    R.cyl(t.x, 0, t.z, 3 * t.s, 26 * t.s, PALETTE.trunk, 6);
    R.box(t.x, 34 * t.s, t.z, 26 * t.s, 18 * t.s, 26 * t.s, PALETTE.palm);
  }

  // ---- streetlights at the intersections ----
  for (const a of AVENUES) for (const s of STREETS) {
    R.box(a + 62, 12, s + 62, 3, 24, 3, '#2f3542');
    R.box(a + 62, 26, s + 62, 9, 3, 9, night ? '#ffe66d' : '#cbd5e1');
    if (night) R.flat(a + 52, s + 52, 20, 20, 0.2, [1, 0.9, 0.5, 0.18]); // light pool
  }

  // ---- place markers: a translucent beam and a ground pad in the place colour ----
  for (const [key, pl] of Object.entries(G.places)) {
    const c = parseColor(PLACE_COLORS[key] || '#ecf0f1');
    R.box(pl.x, 60, pl.z, 5, 120, 5, [c[0], c[1], c[2], 0.32]);
    R.flat(pl.x - 22, pl.z - 22, 44, 44, 0.16, PLACE_COLORS[key] || '#ecf0f1');
  }

  // ---- the sun / moon in the sky ----
  const sunDir = sky.dir;
  const sunC = [R.eye[0] + sunDir[0] * 2400, Math.max(160, R.eye[1] + sunDir[1] * 2400), R.eye[2] + sunDir[2] * 2400];
  const sunCol = night ? '#e8ecf5' : '#fff3b0';
  const sr = R.right, su = R.up;
  const sc = 90;
  R.quad(
    [sunC[0] - sr[0] * sc - su[0] * sc, sunC[1] - sr[1] * sc - su[1] * sc, sunC[2] - sr[2] * sc - su[2] * sc],
    [sunC[0] + sr[0] * sc - su[0] * sc, sunC[1] + sr[1] * sc - su[1] * sc, sunC[2] + sr[2] * sc - su[2] * sc],
    [sunC[0] + sr[0] * sc + su[0] * sc, sunC[1] + sr[1] * sc + su[1] * sc, sunC[2] + sr[2] * sc + su[2] * sc],
    [sunC[0] - sr[0] * sc + su[0] * sc, sunC[1] - sr[1] * sc + su[1] * sc, sunC[2] - sr[2] * sc + su[2] * sc],
    sunCol, sunDir,
  );

  // ---- vehicles, people, effects ----
  for (const car of G.cars) if (!car.hidden) drawCar(R, car, time);
  for (const ped of G.peds) if (!ped.hidden) drawPed(R, ped, time);
  drawPlayer(R, G, time);

  // Bullets: glowing tracers.
  for (const b of G.bullets) {
    const len = 34, fx = Math.cos(b.angle), fz = Math.sin(b.angle);
    const mx = b.x + fx * len / 2, mz = b.z + fz * len / 2;
    R.box(mx, b.y, mz, len, 3, 3, '#ffe66d', -b.angle);
  }
  // Particles: small fading boxes.
  for (const pt of G.particles) {
    const a = clamp(pt.life / pt.maxLife, 0, 1);
    const c = pt.color;
    R.box(pt.x, pt.y, pt.z, pt.size, pt.size, pt.size, [c[0], c[1], c[2], a * 0.9]);
  }

  // Skid marks: thin dark strips on the road.
  for (const s of G.skids) {
    const dx = s.x2 - s.x1, dz = s.z2 - s.z1, l = Math.hypot(dx, dz) || 1;
    const px = -dz / l * 3, pz = dx / l * 3;
    R.quad([s.x1 - px, 0.13, s.z1 - pz], [s.x1 + px, 0.13, s.z1 + pz], [s.x2 + px, 0.13, s.z2 + pz], [s.x2 - px, 0.13, s.z2 - pz], [0.1, 0.1, 0.1, 0.5], [0, 1, 0]);
  }

  // ---- mission + side markers ----
  const marker = (x, z, color, bob) => {
    const y = 70 + Math.sin(time * 3 + bob) * 8;
    R.box(x, y, z, 8, 140, 8, [color[0], color[1], color[2], 0.35]);
    R.box(x, 6, z, 26, 6, 26, color, time * 1.5);
  };
  if (G.missions && G.missions.marker) marker(G.missions.marker.x, G.missions.marker.z, [1, 0.85, 0.2], 0);
  if (G.side) {
    if (G.side.taxi.active && G.side.taxi.marker) marker(G.side.taxi.marker.x, G.side.taxi.marker.z, [0.2, 0.8, 1], 2);
    if (G.side.race.active && G.side.race.marker) marker(G.side.race.marker.x, G.side.race.marker.z, [0.95, 0.3, 0.6], 4);
    for (const pk of G.side.packages) {
      if (pk.got) continue;
      R.box(pk.x, 10 + Math.sin(time * 3 + pk.id) * 3, pk.z, 14, 14, 14, '#f7c948', time);
      R.flat(pk.x - 12, pk.z - 12, 24, 24, 0.2, [1, 0.85, 0.2, 0.3]);
    }
  }

  // ---- rain: streaks around the camera when it rains ----
  if (G.weather && G.weather.raining) {
    const ex = R.eye[0], ez = R.eye[2];
    for (let i = 0; i < 90; i += 1) {
      const rx = ex + ((i * 137.5 + time * 900) % 700) - 350;
      const rz = ez + ((i * 89.3) % 500) - 250;
      const ry = 120 - ((i * 53.7 + time * 700) % 120);
      R.box(rx, ry, rz, 1.5, 22, 1.5, [0.8, 0.85, 1, 0.35]);
    }
  }

  R.flush();
  return { tris: R.tris, night };
}
