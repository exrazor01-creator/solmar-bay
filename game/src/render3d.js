import { AVENUES, STREETS, ROAD_W, WORLD, BEACH_Z, WATER_Z, PALETTE, FLOOR_H, CHARS, OUTFITS } from './config.js';
import { skyAt, pCol } from './gl.js';
import { clamp, lerp, dist, angleDiff } from './random.js';
import { pointInBuilding } from './world.js';
const PLACE_COLORS = {
  garage: '#e67e22', hospital: '#e74c3c', bank: '#f1c40f', ammoShop: '#2ecc71', repairShop: '#3498db',
  hideout: '#9b59b6', taxiStand: '#f7c948', helipad: '#e67e22', marina: '#1abc9c', tower: '#ecf0f1',
  raceStart: '#e84393', lighthouse: '#f1c40f', harbor: '#95a5a6', hotel: '#fd79a8',
  airport: '#00cec9', mall: '#6c5ce7', nightclub: '#e84393', gas: '#fdcb6e', policeStation: '#0984e3',
  restaurant: '#fab1a0', clothing: '#a29bfe', depot: '#636e72',
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
  const cfg = mode === 'heli' ? { dist: 250, height: 160 } : mode === 'foot' ? { dist: 120, height: 65 } : { dist: 185, height: 95 };
  const heading = inCar ? inCar.angle : p.angle;
  cam.heading += angleDiff(cam.heading, heading) * (1 - Math.exp(-dt * 2.2));
  const px = p.x, pz = p.z, py = (inCar && inCar.kind === 'heli') ? inCar.y : 0;
  const wantEye = [
    px - Math.cos(cam.heading) * cfg.dist,
    py + cfg.height,
    pz - Math.sin(cam.heading) * cfg.dist,
  ];
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
  if (cam.shake > 0) {
    cam.shake = Math.max(0, cam.shake - dt * 22);
    const s = cam.shake;
    cam.eye[0] += (G.rng() - 0.5) * s; cam.eye[1] += (G.rng() - 0.5) * s * 0.6; cam.eye[2] += (G.rng() - 0.5) * s;
  }
}
function drawCar(R, car, time) {
  const x = car.x, z = car.z, y = car.y || 0, a = car.angle;
  const fx = Math.cos(a), fz = Math.sin(a), rx = -fz, rz = fx;
  if (car.kind !== 'boat') {
    const sh = car.kind === 'heli' ? clamp(1 - car.y / 260, 0.25, 1) : 1;
    R.flat(x - 26, z - 20, 52, 40, 0.2, [0, 0, 0, 0.28 * sh]);
  }
  if (car.dead) { R.box(x, y + 7, z, 52, 12, 26, '#2f3542', a); return; }
  if (car.kind === 'heli') {
    const alt = car.y;
    R.box(x, alt + 12, z, 46, 14, 24, car.color, a);
    R.box(x - fx * 34, alt + 12, z - fz * 34, 26, 8, 8, car.color, a);
    R.sph(x + fx * 16, alt + 18, z + fz * 16, 9, 7, 9, '#9fd8e8', 6);
    R.box(x, alt + 22, z, 2, 6, 2, '#2f3542', a);
    const rot = car.rotor || 0;
    R.box(x, alt + 25, z, 64, 2, 4, '#2f3542', rot);
    R.box(x, alt + 25, z, 4, 2, 64, '#2f3542', rot);
    R.flat(x - 32, z - 32, 64, 64, alt + 25, [0.75, 0.75, 0.75, 0.16]);
    for (const sg of [-1, 1]) R.box(x + rx * 12 * sg, alt + 2, z + rz * 12 * sg, 30, 2, 3, '#2f3542', a);
    if (car.driver === 'police') {
      const flash = Math.floor(time * 6) % 2 === 0 ? '#ff4757' : '#3742fa';
      R.box(x, alt + 21, z, 10, 4, 10, flash, a);
    }
    return;
  }
  if (car.kind === 'boat') {
    R.box(x, y + 7, z, 54, 12, 26, '#ecf0f1', a);
    R.box(x, y + 16, z, 24, 10, 18, '#2e7f9e', a);
    R.sph(x + fx * 6, y + 24, z + fz * 6, 10, 6, 8, '#9fd8e8', 6);
    R.box(x - fx * 22, y + 12, z - fz * 22, 10, 8, 20, '#c0392b', a);
    R.box(x - fx * 30, y + 6, z - fz * 30, 6, 10, 6, '#2f3542', a);
    return;
  }
  const k = car.kind;
  const len = k === 'truck' ? 74 : k === 'bus' ? 72 : k === 'bike' ? 42 : k === 'supercar' ? 56 : 52;
  const wid = k === 'bike' ? 12 : k === 'truck' ? 28 : k === 'bus' ? 30 : 26;
  const h = k === 'truck' ? 18 : k === 'van' || k === 'bus' ? 22 : k === 'supercar' ? 10 : 13;
  if (k === 'bike') {
    R.box(x, y + 10, z, 30, 8, 10, car.color, a);
    R.cyl(x, y + 14, z, 5, 12, '#2f3542', 6);
    R.sph(x, y + 30, z, 5, 5, 5, SKIN[0], 6);
    for (const sg of [-1, 1]) R.disc(x + fx * 18 * sg, y + 6, z + fz * 18 * sg, rx, rz, 6, '#1a1a1a', 8);
    return;
  }
  R.box(x, y + h / 2 + 3, z, len, h, wid, car.color, a);
  R.box(x + fx * len * 0.3, y + h * 0.5 + 2, z + fz * len * 0.3, len * 0.32, h * 0.7, wid * 0.92, car.color, a);
  R.box(x - fx * 4, y + h + 6, z - fz * 4, len * 0.44, 9, wid * 0.74, '#1e2a38', a);
  R.sph(x - fx * 4, y + h + 11, z - fz * 4, len * 0.2, 5, wid * 0.36, '#9fd8e8', 6);
  for (const s of [-1, 1]) for (const t of [-1, 1]) {
    const wx = x + fx * len * 0.32 * s + rx * wid * 0.5 * t, wz = z + fz * len * 0.32 * s + rz * wid * 0.5 * t;
    R.disc(wx, y + 6, wz, rx, rz, 6, '#1a1a1a', 8);
    R.disc(wx + rx * t, y + 6, wz + rz * t, rx, rz, 2.5, '#b0b8c0', 6);
  }
  for (const s of [-1, 1]) {
    R.box(x + fx * len * 0.5 + rx * wid * 0.3 * s, y + h * 0.55, z + fz * len * 0.5 + rz * wid * 0.3 * s, 3, 4, 5, '#fff7cc', a);
    R.box(x - fx * len * 0.5 + rx * wid * 0.3 * s, y + h * 0.55, z - fz * len * 0.5 + rz * wid * 0.3 * s, 3, 4, 5, '#e74c3c', a);
    R.box(x + fx * len * 0.1 + rx * wid * 0.52 * s, y + h + 2, z + fz * len * 0.1 + rz * wid * 0.52 * s, 4, 3, 3, '#2f3542', a);
  }
  R.box(x + fx * (len / 2 + 1), y + 4, z + fz * (len / 2 + 1), 2, 5, wid * 0.7, '#2f3542', a);
  R.box(x - fx * (len / 2 + 1), y + 4, z - fz * (len / 2 + 1), 2, 5, wid * 0.7, '#2f3542', a);
  if (k === 'taxi') R.box(x, y + h + 15, z, 14, 5, 10, '#f7c948', a);
  if (k === 'police') {
    const flash = Math.floor(time * 6) % 2 === 0 ? '#ff4757' : '#3742fa';
    R.box(x - fx * 4, y + h + 14, z - fz * 4, 16, 4, 8, flash, a);
    R.box(x, y + h / 2 + 3, z, len * 0.9, 3, wid + 1, '#ecf0f1', a);
  }
  if (k === 'truck') R.box(x - fx * 18, y + 22, z - fz * 18, 30, 22, 24, '#b0a08a', a);
  if (k === 'bus') {
    R.box(x, y + h + 6, z, len * 0.8, 10, wid * 0.8, '#9fd8e8', a);
    R.box(x + fx * 30, y + 8, z + fz * 30, 6, 8, 12, '#f1c40f', a);
  }
  if (k === 'supercar') R.box(x - fx * 26, y + h + 4, z - fz * 26, 10, 3, 24, '#2f3542', a);
  if (k === 'suv') R.box(x - fx * 10, y + h + 6, z - fz * 10, 20, 8, 20, '#2c3e50', a);
}
function drawFig(R, x, z, a, o, time) {
  const s = o.h || 1, sw = o.moving ? Math.sin(time * 9 + (o.ph || 0)) * 5 * s : 0;
  const fx = Math.cos(a), fz = Math.sin(a), rx = -fz, rz = fx;
  R.flat(x - 10 * s, z - 8 * s, 20 * s, 16 * s, 0.2, [0, 0, 0, 0.28]);
  for (const sg of [-1, 1]) {
    R.cyl(x + rx * 4 * s * sg + fx * sw * sg, 0, z + rz * 4 * s * sg + fz * sw * sg, 2.6 * s, 13 * s, o.pants || '#2d3436', 5);
    R.cyl(x + rx * 8 * s * sg - fx * sw * sg, 13 * s, z + rz * 8 * s * sg - fz * sw * sg, 2.2 * s, 12 * s, o.shirt, 5);
  }
  R.cyl(x, 12 * s, z, 6.5 * s, 15 * s, o.shirt, 7);
  if (o.vest) R.cyl(x, 16 * s, z, 7 * s, 10 * s, o.vest, 7);
  R.sph(x, 32 * s, z, 6 * s, 6 * s, 6 * s, o.skin, 6);
  if (o.hat) R.cyl(x, 36 * s, z, 6.5 * s, 3 * s, o.hat, 7);
  else R.sph(x, 35 * s, z, 5.5 * s, 3.5 * s, 5.5 * s, o.hair || '#2d3436', 6);
  if (o.gun) R.box(x + fx * 13, 20 * s, z + fz * 13, 14, 3, 3, '#1a1a1a', a);
}
function drawPed(R, ped, time) {
  const skin = SKIN[Math.floor(ped.seed * 4) % 4];
  const base = { skin, h: 1, ph: ped.seed * 10, moving: ped.state === 'walk' || ped.state === 'flee' };
  if (ped.kind === 'cop') drawFig(R, ped.x, ped.z, ped.angle, { ...base, shirt: '#1c4ed8', pants: '#1c4ed8', hat: '#1c4ed8', vest: '#0f2a6b', gun: true }, time);
  else if (ped.kind === 'swat') drawFig(R, ped.x, ped.z, ped.angle, { ...base, shirt: '#2d3436', pants: '#2d3436', hat: '#2d3436', vest: '#1a1a1a', gun: true }, time);
  else if (ped.kind === 'guard') drawFig(R, ped.x, ped.z, ped.angle, { ...base, shirt: '#2c3e50', pants: '#2c3e50', hat: '#1a1a1a', gun: true }, time);
  else drawFig(R, ped.x, ped.z, ped.angle, { ...base, shirt: ped.color || '#7f8c8d', pants: '#2d3436', hair: ['#2d3436', '#8a6b46', '#e67e22', '#7f8c8d'][Math.floor(ped.seed * 4) % 4] }, time);
  if (ped.kind === 'passenger') R.box(ped.x, 52 + Math.sin(time * 3) * 3, ped.z, 10, 10, 10, '#f7c948', time * 2);
}
function drawPlayer(R, G, time) {
  const p = G.player;
  if (p.inCar) return;
  const ch = CHARS[p.char || 'vic'], outfit = OUTFITS[p.outfit || 0] || OUTFITS[0];
  drawFig(R, p.x, p.z, p.angle, {
    shirt: outfit.shirt || ch.shirt, pants: '#2d3436', skin: ch.skin, hat: outfit.cap || ch.cap,
    h: p.char === 'luna' ? 0.92 : 1, moving: p.moving, gun: true,
  }, time);
}
function drawStall(R, s) {
  const fx = Math.cos(s.ry), fz = Math.sin(s.ry);
  R.flat(s.x - 24, s.z - 16, 48, 32, 0.18, [0, 0, 0, 0.2]);
  R.box(s.x, 8, s.z, 44, 14, 26, s.c2, s.ry);
  R.box(s.x, 20, s.z, 40, 6, 22, '#f1c40f', s.ry);
  for (const [ox, oz] of [[-22, -13], [22, -13], [-22, 13], [22, 13]]) {
    R.box(s.x + ox * fx - oz * fz, 22, s.z + ox * fz + oz * fx, 2, 20, 2, '#2f3542');
  }
  R.flat(s.x - 24, s.z - 15, 24, 30, 32, s.c1);
  R.flat(s.x, s.z - 15, 24, 30, 32, '#ecf0f1');
  R.box(s.x - 30, 6, s.z + 18, 12, 10, 12, '#a67c52', s.ry);
  R.box(s.x + 30, 6, s.z - 18, 12, 10, 12, '#8a6b46', s.ry);
}
function winGrid(R, b, night) {
  const cols = Math.max(2, Math.min(6, Math.floor(b.w / 34)));
  const cw = (b.w - 16) / cols;
  const cols2 = Math.max(2, Math.min(6, Math.floor(b.d / 34)));
  const cw2 = (b.d - 16) / cols2;
  for (let f = 0; f < b.floors; f += 1) {
    const y0 = 8 + f * FLOOR_H, y1 = y0 + 16;
    for (let c = 0; c < cols; c += 1) {
      const lit = ((b.seed * 7 + f * 13 + c * 5) % 10) < (night ? 6 : 2);
      const col = lit ? (night ? '#ffd97a' : '#9fd8e8') : '#2c3e50';
      const x0 = b.x + 8 + c * cw, x1 = x0 + cw * 0.55;
      R.quad([x0, y0, b.z + b.d + 0.6], [x1, y0, b.z + b.d + 0.6], [x1, y1, b.z + b.d + 0.6], [x0, y1, b.z + b.d + 0.6], col, [0, 0, 1]);
    }
    for (let c = 0; c < cols2; c += 1) {
      const lit = ((b.seed * 11 + f * 7 + c * 3) % 10) < (night ? 6 : 2);
      const col = lit ? (night ? '#ffd97a' : '#9fd8e8') : '#2c3e50';
      const z0 = b.z + 8 + c * cw2, z1 = z0 + cw2 * 0.55;
      R.quad([b.x + b.w + 0.6, y0, z0], [b.x + b.w + 0.6, y0, z1], [b.x + b.w + 0.6, y1, z1], [b.x + b.w + 0.6, y1, z0], col, [1, 0, 0]);
    }
  }
}
export function render3D(G, R) {
  const time = G.time, sky = skyAt(G.timeOfDay);
  R.setCamera(G.camera.eye, G.camera.target);
  R.begin(sky);
  const night = sky.night;
  R.flat(0, 0, WORLD.w, BEACH_Z, 0, PALETTE.grass);
  R.flat(0, BEACH_Z, WORLD.w, WATER_Z - BEACH_Z, 0.05, PALETTE.sand);
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
  for (const a of AVENUES) for (let z = 100; z < BEACH_Z - 60; z += 200) R.flat(a - 3, z, 6, 60, 0.14, PALETTE.roadLine);
  for (const s of STREETS) for (let x = 100; x < WORLD.w - 60; x += 200) R.flat(x, s - 3, 60, 6, 0.14, PALETTE.roadLine);
  for (const a of AVENUES) for (const s of STREETS) {
    for (let k = -2; k <= 2; k += 1) R.flat(a + k * 16 - 4, s - ROAD_W / 2 - 10, 8, 20, 0.13, '#e8e8e8');
    const hsh = (a * 7 + s * 13) % 10;
    if (hsh < 3) R.cyl(a + 62, 0, s + 62, 4, 12, '#c0392b', 6);
    else if (hsh < 6) { R.box(a - 62, 6, s + 62, 30, 4, 10, '#8a6b46'); R.box(a - 62, 12, s + 62, 30, 8, 3, '#8a6b46'); }
    else { R.box(a - 62, 14, s - 62, 3, 28, 3, '#2f3542'); R.box(a - 62, 30, s - 62, 16, 10, 2, '#0984e3'); }
  }
  for (const pk of G.world.parks) R.flat(pk.x, pk.z, pk.w, pk.d, 0.06, PALETTE.grassDry);
  for (const b of G.world.buildings) {
    const h = b.floors * FLOOR_H, cx = b.x + b.w / 2, cz = b.z + b.d / 2;
    if (b.floors >= 5) {
      R.box(cx, h * 0.35, cz, b.w, h * 0.7, b.d, b.color);
      R.box(cx, h * 0.85, cz, b.w * 0.78, h * 0.3, b.d * 0.78, b.color);
    } else R.box(cx, h / 2, cz, b.w, h, b.d, b.color);
    R.box(cx, h + 3, cz, b.w - 10, 6, b.d - 10, '#5b6470');
    if (b.floors >= 3) {
      R.box(cx + b.w * 0.25, h + 10, cz, 14, 8, 14, '#5b6470');
      R.cyl(cx - b.w * 0.25, h + 6, cz, 2, 26, '#2f3542', 5);
    }
    winGrid(R, b, night);
    if (b.floors <= 2 && (b.seed % 3) < 1) {
      R.flat(cx - b.w * 0.3, cz + b.d / 2 + 2, b.w * 0.6, 10, 16, '#e74c3c');
      R.box(cx, 20, cz + b.d / 2 + 3, b.w * 0.4, 6, 2, '#f1c40f');
    }
    if (b.landmark === 'tower') {
      R.cyl(cx, h + 6, cz, 42, 3, '#3a3f47', 12);
      R.flat(cx - 24, cz - 4, 48, 8, h + 10, '#f1c40f');
      R.flat(cx - 4, cz - 24, 8, 48, h + 10, '#f1c40f');
    }
    if (b.landmark === 'lighthouse') {
      R.cyl(cx, h, cz, 16, 60, '#ecf0f1', 8);
      R.box(cx, h + 66, cz, 22, 12, 22, night ? '#ffe66d' : '#f1c40f');
    }
    if (night && (b.landmark === 'club' || b.landmark === 'mall' || b.landmark === 'hotel')) {
      const neon = b.landmark === 'club' ? '#ff2e88' : b.landmark === 'mall' ? '#00e5ff' : '#ffd23e';
      R.box(cx, h * 0.75, cz + b.d / 2 + 2, b.w * 0.6, 10, 3, neon);
      R.flat(cx - b.w * 0.35, cz + b.d / 2 + 6, b.w * 0.7, 18, 0.2, [1, 0.3, 0.6, 0.12]);
    }
  }
  for (const sg of G.world.signs) {
    R.box(sg.x, 46, sg.z, sg.w, 16, 4, sg.c);
    R.box(sg.x, 46, sg.z + 3, sg.w * 0.7, 4, 2, '#ecf0f1');
  }
  for (const st of G.world.stalls) drawStall(R, st);
  R.flat(3140, 200, 55, 500, 0.15, '#2f3542');
  for (let z = 220; z < 680; z += 60) R.flat(3164, z, 6, 30, 0.16, '#e8d44d');
  const px2 = 2960, pz2 = 620;
  R.box(px2, 8, pz2, 70, 10, 12, '#ecf0f1', Math.PI / 2);
  R.box(px2, 8, pz2, 14, 3, 60, '#ecf0f1', Math.PI / 2);
  R.box(px2 - 34, 14, pz2, 10, 12, 3, '#0984e3', Math.PI / 2);
  R.box(px2, 10, pz2, 72, 3, 13, '#0984e3', Math.PI / 2);
  for (const t of G.world.trees) {
    R.cyl(t.x, 0, t.z, 3 * t.s, 26 * t.s, PALETTE.trunk, 6);
    R.box(t.x, 34 * t.s, t.z, 26 * t.s, 18 * t.s, 26 * t.s, PALETTE.palm);
  }
  for (const a of AVENUES) for (const s of STREETS) {
    R.box(a + 62, 12, s + 62, 3, 24, 3, '#2f3542');
    R.box(a + 62, 26, s + 62, 9, 3, 9, night ? '#ffe66d' : '#cbd5e1');
    if (night) R.flat(a + 52, s + 52, 20, 20, 0.2, [1, 0.9, 0.5, 0.18]);
    const go = Math.floor(time / 8) % 2 === 0;
    R.box(a - 62, 14, s - 62, 3, 28, 3, '#2f3542');
    R.box(a - 62, 30, s - 62, 8, 16, 8, '#2f3542');
    R.box(a - 62, 34, s - 62, 5, 5, 5, go ? '#2ecc71' : '#e74c3c');
    R.box(a - 62, 27, s - 62, 5, 5, 5, go ? '#e74c3c' : '#2ecc71');
  }
  for (const [key, pl] of Object.entries(G.places)) {
    const c = pCol(PLACE_COLORS[key] || '#ecf0f1');
    R.box(pl.x, 60, pl.z, 5, 120, 5, [c[0], c[1], c[2], 0.32]);
    R.flat(pl.x - 22, pl.z - 22, 44, 44, 0.16, PLACE_COLORS[key] || '#ecf0f1');
  }
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
  if (!night) for (let i = 0; i < 3; i += 1) {
    const ox = (i - 1) * 420, oy = 150 + (i % 2) * 110, w = 200 + i * 60;
    const cx = sunC[0] + sr[0] * ox + su[0] * oy, cy = sunC[1] + sr[1] * ox + su[1] * oy, cz = sunC[2] + sr[2] * ox + su[2] * oy;
    const P = (sx, sy) => [cx + sr[0] * sx * w + su[0] * sy * 26, cy + sr[1] * sx * w + su[1] * sy * 26, cz + sr[2] * sx * w + su[2] * sy * 26];
    R.quad(P(-1, -1), P(1, -1), P(1, 1), P(-1, 1), [1, 0.82, 0.72, 0.4], sunDir);
  }
  for (const car of G.cars) if (!car.hidden) drawCar(R, car, time);
  for (const ped of G.peds) if (!ped.hidden) drawPed(R, ped, time);
  drawPlayer(R, G, time);
  for (const b of G.bullets) {
    const len = 34, fx = Math.cos(b.angle), fz = Math.sin(b.angle);
    const mx = b.x + fx * len / 2, mz = b.z + fz * len / 2;
    R.box(mx, b.y, mz, len, 3, 3, '#ffe66d', -b.angle);
  }
  for (const pt of G.particles) {
    const a = clamp(pt.life / pt.maxLife, 0, 1);
    const c = pt.color;
    R.box(pt.x, pt.y, pt.z, pt.size, pt.size, pt.size, [c[0], c[1], c[2], a * 0.9]);
  }
  for (const s of G.skids) {
    const dx = s.x2 - s.x1, dz = s.z2 - s.z1, l = Math.hypot(dx, dz) || 1;
    const px = -dz / l * 3, pz = dx / l * 3;
    R.quad([s.x1 - px, 0.13, s.z1 - pz], [s.x1 + px, 0.13, s.z1 + pz], [s.x2 + px, 0.13, s.z2 + pz], [s.x2 - px, 0.13, s.z2 - pz], [0.1, 0.1, 0.1, 0.5], [0, 1, 0]);
  }
  const marker = (x, z, color, bob) => {
    const y = 70 + Math.sin(time * 3 + bob) * 8;
    R.box(x, y, z, 8, 140, 8, [color[0], color[1], color[2], 0.35]);
    R.box(x, 6, z, 26, 6, 26, color, time * 1.5);
  };
  if (G.missions && G.missions.marker) marker(G.missions.marker.x, G.missions.marker.z, [1, 0.85, 0.2], 0);
  if (G.side) {
    if (G.side.taxi.active && G.side.taxi.marker) marker(G.side.taxi.marker.x, G.side.taxi.marker.z, [0.2, 0.8, 1], 2);
    if (G.side.race.active && G.side.race.marker) marker(G.side.race.marker.x, G.side.race.marker.z, [0.95, 0.3, 0.6], 4);
    if (G.side.delivery && G.side.delivery.active && G.side.delivery.marker) marker(G.side.delivery.marker.x, G.side.delivery.marker.z, [1, 0.6, 0.1], 6);
    for (const pk of G.side.packages) {
      if (pk.got) continue;
      R.box(pk.x, 10 + Math.sin(time * 3 + pk.id) * 3, pk.z, 14, 14, 14, '#f7c948', time);
      R.flat(pk.x - 12, pk.z - 12, 24, 24, 0.2, [1, 0.85, 0.2, 0.3]);
    }
  }
  if (G.weather && G.weather.raining) {
    const ex = R.eye[0], ez = R.eye[2];
    for (let i = 0; i < (G.settings && G.settings.quality === 'low' ? 30 : 90); i += 1) {
      const rx = ex + ((i * 137.5 + time * 900) % 700) - 350;
      const rz = ez + ((i * 89.3) % 500) - 250;
      const ry = 120 - ((i * 53.7 + time * 700) % 120);
      R.box(rx, ry, rz, 1.5, 22, 1.5, [0.8, 0.85, 1, 0.35]);
    }
  }
  if (G.weather && G.weather.flash > 0) {
    const bx = R.eye[0] + (G.weather.boltX || 200), bz = R.eye[2] + (G.weather.boltZ || -150);
    let lx = bx, lz = bz, ly = 260;
    for (let i = 0; i < 6; i += 1) {
      const nx = lx + (G.rng() - 0.5) * 60, nz = lz + (G.rng() - 0.5) * 60;
      R.box((lx + nx) / 2, ly - 22, (lz + nz) / 2, 6, 46, 6, [1, 1, 0.95, G.weather.flash]);
      lx = nx; lz = nz; ly -= 44;
    }
    R.box(R.eye[0], R.eye[1] + 120, R.eye[2], 8, 8, 8, [1, 1, 1, G.weather.flash * 0.5]);
  }
  R.flush();
  return { tris: R.tris, night };
}
