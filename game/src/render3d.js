import { AVENUES, STREETS, ROAD_W, WORLD, BEACH_Z, WATER_Z, PALETTE, FLOOR_H, CHARS, OUTFITS } from './config.js';
import { skyAt, pCol } from './gl.js';
import { clamp, lerp, dist, angleDiff } from './random.js';
import { pointInBuilding } from './world.js';
const PC = { garage: '#e67e22', hospital: '#e74c3c', bank: '#f1c40f', ammoShop: '#2ecc71', repairShop: '#3498db', hideout: '#9b59b6', taxiStand: '#f7c948', helipad: '#e67e22', marina: '#1abc9c', tower: '#ecf0f1', raceStart: '#e84393', lighthouse: '#f1c40f', harbor: '#95a5a6', hotel: '#fd79a8', airport: '#00cec9', mall: '#6c5ce7', nightclub: '#e84393', gas: '#fdcb6e', policeStation: '#0984e3', restaurant: '#fab1a0', clothing: '#a29bfe', depot: '#636e72' };
const SKIN = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524'];
const HAIR = ['#2d3436', '#8a6b46', '#e67e22', '#7f8c8d', '#d35400', '#6c5ce7'];
function buildingAt(G, x, z) {
  for (const b of G.world.buildings) if (x >= b.x && x <= b.x + b.w && z >= b.z && z <= b.z + b.d) return b;
  return null;
}
export function updateCamera(G, dt) {
  const p = G.player, cam = G.camera, inCar = p.inCar;
  const mode = inCar ? (inCar.kind === 'heli' ? 'heli' : inCar.kind === 'boat' ? 'boat' : 'car') : 'foot';
  const cfg = mode === 'heli' ? { dist: 250, height: 160 } : mode === 'foot' ? { dist: 120, height: 65 } : { dist: 185, height: 95 };
  const heading = inCar ? inCar.angle : p.angle;
  cam.heading += angleDiff(cam.heading, heading) * (1 - Math.exp(-dt * 2.2));
  const px = p.x, pz = p.z, py = (inCar && inCar.kind === 'heli') ? inCar.y : 0;
  const wantEye = [px - Math.cos(cam.heading) * cfg.dist, py + cfg.height, pz - Math.sin(cam.heading) * cfg.dist];
  const b = buildingAt(G, wantEye[0], wantEye[2]);
  if (b) wantEye[1] = Math.max(wantEye[1], b.floors * FLOOR_H + 40);
  wantEye[1] = Math.max(wantEye[1], 32);
  const k = 1 - Math.exp(-dt * 4.5);
  cam.eye[0] += (wantEye[0] - cam.eye[0]) * k; cam.eye[1] += (wantEye[1] - cam.eye[1]) * k; cam.eye[2] += (wantEye[2] - cam.eye[2]) * k;
  const wt = [px, py + 22, pz], k2 = 1 - Math.exp(-dt * 7);
  cam.target[0] += (wt[0] - cam.target[0]) * k2; cam.target[1] += (wt[1] - cam.target[1]) * k2; cam.target[2] += (wt[2] - cam.target[2]) * k2;
  if (cam.shake > 0) {
    cam.shake = Math.max(0, cam.shake - dt * 22);
    const s = cam.shake;
    cam.eye[0] += (G.rng() - 0.5) * s; cam.eye[1] += (G.rng() - 0.5) * s * 0.6; cam.eye[2] += (G.rng() - 0.5) * s;
  }
}
const BODY = {
  sedan: [-26, 13, 3, 9, -14, 13, 3, 13, -2, 12, 3, 16, 10, 12, 3, 15, 20, 12, 3, 11, 26, 12, 3, 9],
  sport: [-26, 12, 3, 8, -14, 12, 3, 11, -2, 11, 3, 13, 10, 11, 3, 12, 20, 11, 3, 9, 26, 11, 3, 8],
  suv: [-27, 14, 3, 12, -14, 14, 3, 17, -2, 13, 3, 19, 10, 13, 3, 18, 20, 13, 3, 14, 27, 13, 3, 12],
  truck: [-30, 14, 3, 12, -18, 14, 3, 16, 0, 14, 3, 16, 14, 14, 3, 13, 30, 14, 3, 10],
  van: [-27, 14, 3, 12, -14, 14, 3, 20, -2, 13, 3, 22, 10, 13, 3, 21, 20, 13, 3, 17, 27, 13, 3, 14],
  bus: [-34, 15, 3, 12, -18, 15, 3, 22, 0, 15, 3, 24, 18, 15, 3, 23, 34, 15, 3, 14],
};
function drawCar(R, car, time) {
  const { x, z, angle: a } = car, y = car.y || 0;
  const fx = Math.cos(a), fz = Math.sin(a), rx = -fz, rz = fx;
  if (car.kind !== 'boat') {
    const sh = car.kind === 'heli' ? clamp(1 - car.y / 260, 0.25, 1) : 1;
    R.flat(x - 26, z - 20, 52, 40, 0.2, [0, 0, 0, 0.28 * sh]);
  }
  if (car.dead) { R.box(x, y + 7, z, 52, 12, 26, '#2f3542', a); return; }
  if (car.kind === 'heli') {
    const alt = car.y;
    R.sh = 0.6; R.hull(x, alt, z, a, [-22, 12, 6, 18, -8, 13, 6, 20, 6, 12, 6, 19, 20, 11, 6, 16, 24, 10, 6, 12], car.color); R.sh = 0;
    R.box(x - fx * 34, alt + 12, z - fz * 34, 26, 8, 8, car.color, a);
    R.sh = 0.9; R.lathe(x + fx * 16, alt + 12, z + fz * 16, [0, 0, 9, 1, 9, 5, 6, 8, 0, 9], '#9fd8e8', 8, a); R.sh = 0;
    R.cyl(x, alt + 20, z, 1.5, 6, '#2f3542', 5);
    const rot = car.rotor || 0;
    R.box(x, alt + 26, z, 64, 1.5, 3, '#2f3542', rot);
    R.box(x, alt + 26, z, 3, 1.5, 64, '#2f3542', rot);
    R.flat(x - 32, z - 32, 64, 64, alt + 26, [0.75, 0.75, 0.75, 0.14]);
    for (const sg of [-1, 1]) R.box(x + rx * 12 * sg, alt + 2, z + rz * 12 * sg, 30, 2, 3, '#2f3542', a);
    if (car.driver === 'police') {
      const fl = Math.floor(time * 6) % 2 === 0 ? '#ff4757' : '#3742fa';
      R.box(x, alt + 21, z, 10, 4, 10, fl, a);
    }
    return;
  }
  if (car.kind === 'boat') {
    R.sh = 0.5; R.hull(x, y, z, a, [-27, 13, 2, 9, -10, 13, 2, 11, 8, 12, 2, 10, 27, 10, 2, 7], '#ecf0f1'); R.sh = 0;
    R.box(x, y + 12, z, 22, 9, 16, '#2e7f9e', a);
    R.sh = 0.9; R.lathe(x + fx * 6, y + 20, z + fz * 6, [0, 0, 9, 1, 9, 4, 5, 7, 0, 8], '#9fd8e8', 8, a); R.sh = 0;
    R.box(x - fx * 24, y + 10, z - fz * 24, 8, 9, 18, '#c0392b', a);
    R.box(x - fx * 30, y + 6, z - fz * 30, 5, 10, 5, '#2f3542', a);
    return;
  }
  const k = car.kind;
  if (k === 'bike') {
    R.sh = 0.6; R.hull(x, y, z, a, [-18, 5, 6, 12, -6, 6, 6, 14, 6, 5, 6, 12, 18, 4, 6, 9], car.color); R.sh = 0;
    R.tube(x - fx * 8, y + 14, z - fz * 8, x + fx * 10, y + 20, z + fz * 10, 2, '#2f3542', 5);
    R.sph(x - fx * 4, y + 26, z - fz * 4, 5.5, 5.5, 5.5, SKIN[0], 6);
    R.lathe(x - fx * 4, y + 28, z - fz * 4, [0, 0, 6, 0, 6, 2, 3, 4.5, 0, 5], '#1a1a1a', 8, a);
    for (const sg of [-1, 1]) {
      const wx = x + fx * 17 * sg, wz = z + fz * 17 * sg;
      R.tube(wx - rx * 2, y + 6, wz - rz * 2, wx + rx * 2, y + 6, wz + rz * 2, 6, '#1a1a1a', 6);
      R.disc(wx + rx * 2.2, y + 6, wz + rz * 2.2, rx, rz, 2.5, '#c8ccd2', 6);
    }
    return;
  }
  const prof = BODY[k] || BODY.sedan;
  const len = k === 'truck' ? 60 : k === 'bus' ? 68 : k === 'supercar' ? 52 : k === 'suv' ? 54 : 52;
  const wid = k === 'truck' ? 28 : k === 'bus' ? 30 : 26;
  R.sh = 0.75; R.hull(x, y, z, a, prof, car.color); R.sh = 0;
  const cab = k === 'truck' ? [-16, 11, 14, 24, -2, 11, 14, 26, 8, 11, 14, 24] : k === 'bus' ? [-28, 12, 16, 26, 0, 12, 16, 27, 26, 12, 16, 25] : k === 'van' ? [-20, 11, 14, 24, 0, 11, 14, 25, 18, 11, 14, 23] : [-10, 10, 12, 22, 2, 10, 12, 23, 12, 9, 12, 20];
  R.sh = 0.95; R.hull(x, y, z, a, cab, '#16242f'); R.sh = 0;
  for (const s of [-1, 1]) for (const t of [-1, 1]) {
    const wx = x + fx * len * 0.32 * s + rx * wid * 0.5 * t, wz = z + fz * len * 0.32 * s + rz * wid * 0.5 * t;
    R.tube(wx - rx * 3 * t, y + 6, wz - rz * 3 * t, wx + rx * 3 * t, y + 6, wz + rz * 3 * t, 6, '#1a1a1a', 6);
    R.disc(wx + rx * 3.2 * t, y + 6, wz + rz * 3.2 * t, rx, rz, 3, '#c8ccd2', 6);
  }
  for (const s of [-1, 1]) {
    R.box(x + fx * (len / 2 + 1) + rx * wid * 0.3 * s, y + 7, z + fz * (len / 2 + 1) + rz * wid * 0.3 * s, 2, 4, 6, '#fff7cc', a);
    R.box(x - fx * (len / 2 + 1) + rx * wid * 0.3 * s, y + 7, z - fz * (len / 2 + 1) + rz * wid * 0.3 * s, 2, 4, 6, '#e74c3c', a);
    R.box(x + fx * len * 0.1 + rx * wid * 0.52 * s, y + 13, z + fz * len * 0.1 + rz * wid * 0.52 * s, 4, 3, 2, '#2f3542', a);
  }
  R.box(x + fx * (len / 2 + 1), y + 4, z + fz * (len / 2 + 1), 2, 5, wid * 0.7, '#2f3542', a);
  R.box(x - fx * (len / 2 + 1), y + 4, z - fz * (len / 2 + 1), 2, 5, wid * 0.7, '#2f3542', a);
  R.box(x + fx * len * 0.5, y + 6, z + fz * len * 0.5, 2, 4, wid * 0.6, '#3a3f47', a);
  if (k === 'taxi') R.box(x, y + 24, z, 14, 5, 10, '#f7c948', a);
  if (k === 'police') {
    const fl = Math.floor(time * 6) % 2 === 0 ? '#ff4757' : '#3742fa';
    R.box(x - fx * 4, y + 22, z - fz * 4, 16, 4, 8, fl, a);
    R.box(x, y + 6, z, len * 0.9, 3, wid + 1, '#ecf0f1', a);
  }
  if (k === 'truck') R.box(x - fx * 20, y + 20, z - fz * 20, 26, 18, 22, '#b0a08a', a);
  if (k === 'bus') R.box(x + fx * 30, y + 8, z + fz * 30, 6, 8, 12, '#f1c40f', a);
  if (k === 'supercar' || k === 'sport') R.box(x - fx * 26, y + 12, z - fz * 26, 10, 2.5, 22, '#2f3542', a);
  if (k === 'suv') R.box(x - fx * 12, y + 20, z - fz * 12, 18, 6, 18, '#2c3e50', a);
}
function drawFig(R, x, z, a, o, time) {
  const s = o.h || 1, sw = o.moving ? Math.sin(time * 9 + (o.ph || 0)) * 5 * s : 0;
  const fx = Math.cos(a), fz = Math.sin(a), rx = -fz, rz = fx;
  R.flat(x - 10 * s, z - 8 * s, 20 * s, 16 * s, 0.2, [0, 0, 0, 0.28]);
  for (const sg of [-1, 1]) {
    const hx = x + rx * 4 * s * sg, hz = z + rz * 4 * s * sg;
    const kx = hx + fx * sw * sg * 0.6, kz = hz + fz * sw * sg * 0.6;
    const ax = hx + fx * sw * sg, az = hz + fz * sw * sg;
    R.tube(hx, 14 * s, hz, kx, 7 * s, kz, 2.8 * s, o.pants || '#2d3436', 5);
    R.tube(kx, 7 * s, kz, ax, 0.5 * s, az, 2.4 * s, o.pants || '#2d3436', 5);
    R.box(ax, 1.5 * s, az, 7 * s, 3 * s, 4.5 * s, '#1a1a1a', a);
    const sx2 = x + rx * 8 * s * sg, sz2 = z + rz * 8 * s * sg;
    const ex = sx2 - fx * sw * sg * 0.5, ez = sz2 - fz * sw * sg * 0.5;
    const wx = sx2 - fx * sw * sg, wz = sz2 - fz * sw * sg;
    R.tube(sx2, 26 * s, sz2, ex, 19 * s, ez, 2.2 * s, o.shirt, 5);
    R.tube(ex, 19 * s, ez, wx, 13 * s, wz, 2 * s, o.skin, 5);
    R.sph(wx, 12 * s, wz, 2.6 * s, 2.6 * s, 2.6 * s, o.skin, 5);
    if (o.fingers) for (let f = -1; f <= 1; f += 1) R.tube(wx + rx * f * 1.7 * s, 12 * s, wz + rz * f * 1.7 * s, wx + fx * 3.5 * s + rx * f * 1.7 * s, 11 * s, wz + fz * 3.5 * s + rz * f * 1.7 * s, 0.8 * s, o.skin, 3);
  }
  R.cyl(x, 12 * s, z, 6.5 * s, 15 * s, o.shirt, 7);
  R.sph(x, 26 * s, z, 7.5 * s, 3.5 * s, 5 * s, o.shirt, 6);
  if (o.vest) R.cyl(x, 16 * s, z, 7 * s, 10 * s, o.vest, 7);
  R.quad([x - rx * 3 * s, 24 * s, z - rz * 3 * s], [x - rx * 1 * s, 24 * s, z - rz * 1 * s], [x - rx * 1 * s, 14 * s, z - rz * 1 * s], [x - rx * 3 * s, 14 * s, z - rz * 3 * s], [0, 0, 0, 0.16], [fx, 0, fz]);
  R.quad([x + rx * 1 * s, 24 * s, z + rz * 1 * s], [x + rx * 3 * s, 24 * s, z + rz * 3 * s], [x + rx * 3 * s, 14 * s, z + rz * 3 * s], [x + rx * 1 * s, 14 * s, z + rz * 1 * s], [0, 0, 0, 0.16], [fx, 0, fz]);
  R.sh = 0.12; R.lathe(x, 28 * s, z, [0, 0, 5.5, 1, 6, 3, 5.5, 6, 3, 8.5, 0, 9], o.skin, 8, a); R.sh = 0;
  R.sph(x + fx * 5.4 * s + rx * 2.2 * s, 33.5 * s, z + fz * 5.4 * s + rz * 2.2 * s, 0.9 * s, 0.9 * s, 0.9 * s, '#1a1a1a', 4);
  R.sph(x + fx * 5.4 * s - rx * 2.2 * s, 33.5 * s, z + fz * 5.4 * s - rz * 2.2 * s, 0.9 * s, 0.9 * s, 0.9 * s, '#1a1a1a', 4);
  R.box(x + fx * 5.8 * s, 31.5 * s, z + fz * 5.8 * s, 1.6 * s, 2 * s, 1.6 * s, o.skin, a);
  R.box(x + fx * 5.9 * s, 29.5 * s, z + fz * 5.9 * s, 1.2 * s, 1 * s, 3.6 * s, '#7a3b2e', a);
  if (o.hat) R.lathe(x, 35 * s, z, [0, 0, 6.5, 0, 6.5, 2, 0, 4], o.hat, 8, a);
  else if (o.longHair) { R.lathe(x, 34 * s, z, [0, 0, 6, 0, 6, 2.5, 4, 4.5, 0, 5.5], o.hair || '#2d3436', 8, a); R.box(x - fx * 4 * s, 24 * s, z - fz * 4 * s, 3.5 * s, 16 * s, 7 * s, o.hair || '#2d3436', a); }
  else R.lathe(x, 34 * s, z, [0, 0, 6, 0, 6, 2.5, 4, 4.5, 0, 5.5], o.hair || '#2d3436', 8, a);
  if (o.gun) R.box(x + fx * 13, 20 * s, z + fz * 13, 14, 3, 3, '#1a1a1a', a);
}
function drawPed(R, ped, time) {
  const skin = SKIN[Math.floor(ped.seed * 4) % 4];
  const base = { skin, h: 1, ph: ped.seed * 10, moving: ped.state === 'walk' || ped.state === 'flee' };
  const hair = HAIR[Math.floor(ped.seed * 6) % 6];
  if (ped.kind === 'cop') drawFig(R, ped.x, ped.z, ped.angle, { ...base, shirt: '#1c4ed8', pants: '#1c4ed8', hat: '#1c4ed8', vest: '#0f2a6b', gun: true }, time);
  else if (ped.kind === 'swat') drawFig(R, ped.x, ped.z, ped.angle, { ...base, shirt: '#2d3436', pants: '#2d3436', hat: '#2d3436', vest: '#1a1a1a', gun: true }, time);
  else if (ped.kind === 'guard') drawFig(R, ped.x, ped.z, ped.angle, { ...base, shirt: '#2c3e50', pants: '#2c3e50', hat: '#1a1a1a', gun: true }, time);
  else drawFig(R, ped.x, ped.z, ped.angle, { ...base, shirt: ped.color || '#7f8c8d', pants: '#2d3436', hair, longHair: (ped.seed * 7) % 1 < 0.35 }, time);
  if (ped.kind === 'passenger') R.box(ped.x, 52 + Math.sin(time * 3) * 3, ped.z, 10, 10, 10, '#f7c948', time * 2);
}
function drawPlayer(R, G, time) {
  const p = G.player;
  if (p.inCar) return;
  const ch = CHARS[p.char || 'vic'], outfit = OUTFITS[p.outfit || 0] || OUTFITS[0];
  drawFig(R, p.x, p.z, p.angle, {
    shirt: outfit.shirt || ch.shirt, pants: '#2d3436', skin: ch.skin, hat: outfit.cap || ch.cap,
    h: p.char === 'luna' ? 0.92 : 1, moving: p.moving, gun: true, fingers: true,
    longHair: p.char === 'luna',
  }, time);
}
function drawStall(R, s) {
  const fx = Math.cos(s.ry), fz = Math.sin(s.ry);
  R.flat(s.x - 24, s.z - 16, 48, 32, 0.18, [0, 0, 0, 0.2]);
  R.box(s.x, 8, s.z, 44, 14, 26, s.c2, s.ry);
  R.box(s.x, 20, s.z, 40, 6, 22, '#f1c40f', s.ry);
  for (const [ox, oz] of [[-22, -13], [22, -13], [-22, 13], [22, 13]]) R.box(s.x + ox * fx - oz * fz, 22, s.z + ox * fz + oz * fx, 2, 20, 2, '#2f3542');
  for (let i = 0; i < 4; i += 1) R.flat(s.x - 24 + i * 12, s.z - 15, 12, 30, 32, i % 2 === 0 ? s.c1 : '#ecf0f1');
  R.box(s.x - 30, 6, s.z + 18, 12, 10, 12, '#a67c52', s.ry);
  R.box(s.x + 30, 6, s.z - 18, 12, 10, 12, '#8a6b46', s.ry);
  R.sph(s.x - 10, 28, s.z, 5, 4, 5, '#e74c3c', 5);
  R.sph(s.x + 8, 28, s.z + 4, 4, 3.5, 4, '#f39c12', 5);
  R.sph(s.x + 16, 28, s.z - 6, 4.5, 3.5, 4.5, '#2ecc71', 5);
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
      R.flat(x0 - 2, b.z + b.d + 0.8, cw * 0.55 + 4, 2, y0 - 2, '#5b6470');
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
  const W = G.world, t = G.time, sky = skyAt(G.timeOfDay), night = sky.night;
  R.setCamera(G.camera.eye, G.camera.target);
  R.begin(sky);
  const ex = R.eye[0], ez = R.eye[2], fx = R.fwd[0], fz = R.fwd[2];
  const vis = (x, z, r) => { const dx = x - ex, dz = z - ez; return dx * fx + dz * fz > -r && dx * dx + dz * dz < 2600 * 2600; };
  const sd = sky.dir;
  if (night) R.sph(ex + 700, 700, ez - 500, 50, 50, 50, '#f5f6fa', 6);
  else R.sph(ex + sd[0] * 1400, Math.max(90, 200 + sd[1] * 1400), ez + sd[2] * 1400, 70, 70, 70, '#fff3b0', 6);
  for (let i = 0; i < 3; i += 1) { const cx = ((i * 733 + t * 4) % 2400) + 400, cz = 300 + i * 300; R.flat(cx - 150, cz - 40, 300, 80, 500 + i * 10, [1, 1, 1, 0.14]); }
  R.flat(0, 0, WORLD.w, BEACH_Z, 0, PALETTE.grass);
  R.flat(0, BEACH_Z, WORLD.w, WATER_Z - BEACH_Z, 0.05, PALETTE.sand);
  const cw = WORLD.w / 8, cd = (WORLD.h - WATER_Z) / 3;
  for (let i = 0; i < 8; i += 1) for (let j = 0; j < 3; j += 1) {
    const x0 = i * cw, z0 = WATER_Z + j * cd;
    const wv = (x, z) => Math.sin(x * 0.02 + t * 1.2) * 1.4 + Math.cos(z * 0.03 + t * 0.9) * 1.4;
    R.quad([x0, -2 + wv(x0, z0), z0], [x0 + cw, -2 + wv(x0 + cw, z0), z0], [x0 + cw, -2 + wv(x0 + cw, z0 + cd), z0 + cd], [x0, -2 + wv(x0, z0 + cd), z0 + cd], j >= 2 ? PALETTE.waterDeep : PALETTE.water, [0, 1, 0]);
  }
  for (const a of AVENUES) { R.flat(a - ROAD_W / 2, 0, ROAD_W, BEACH_Z, 0.1, PALETTE.road); R.flat(a - ROAD_W / 2 - 14, 0, 14, BEACH_Z, 0.12, PALETTE.sidewalk); R.flat(a + ROAD_W / 2, 0, 14, BEACH_Z, 0.12, PALETTE.sidewalk); }
  for (const s of STREETS) { R.flat(0, s - ROAD_W / 2, WORLD.w, ROAD_W, 0.1, PALETTE.road); R.flat(0, s - ROAD_W / 2 - 14, WORLD.w, 14, 0.12, PALETTE.sidewalk); R.flat(0, s + ROAD_W / 2, WORLD.w, 14, 0.12, PALETTE.sidewalk); }
  for (const a of AVENUES) for (let z = 100; z < BEACH_Z - 60; z += 200) R.flat(a - 3, z, 6, 60, 0.14, PALETTE.roadLine);
  for (const s of STREETS) for (let x = 100; x < WORLD.w - 60; x += 200) R.flat(x, s - 3, 60, 6, 0.14, PALETTE.roadLine);
  for (const a of AVENUES) for (const s of STREETS) {
    if (!vis(a, s, 200)) continue;
    for (let i = 0; i < 4; i += 1) R.flat(a - 22 + i * 12, s - ROAD_W / 2 - 12, 8, 10, 0.15, '#ecf0f1');
    R.flat(a - 40, s - 4, 80, 8, 0.13, '#f7c948');
  }
  for (const b of W.buildings) {
    const cx = b.x + b.w / 2, cz = b.z + b.d / 2;
    if (!vis(cx, cz, 300)) continue;
    const h = b.floors * FLOOR_H;
    R.box(cx, h / 2, cz, b.w, h, b.d, b.color);
    if (b.floors >= 8) { const w2 = b.w * 0.72, d2 = b.d * 0.72; R.box(cx, h + FLOOR_H * 0.8, cz, w2, FLOOR_H * 1.6, d2, b.color); if (b.floors >= 14) { const w3 = b.w * 0.45, d3 = b.d * 0.45; R.box(cx, h + FLOOR_H * 2.4, cz, w3, FLOOR_H * 1.6, d3, b.color); } }
    R.box(cx, h + 2, cz, b.w + 4, 4, b.d + 4, '#5b6470');
    if (b.floors >= 8) { R.box(cx + b.w * 0.2, h + FLOOR_H * 1.6 + 4, cz, 8, 10, 8, '#7f8c8d'); R.cyl(cx - b.w * 0.25, h + FLOOR_H * 1.6 + 6, cz + b.d * 0.2, 4, 12, '#95a5a6', 5); }
    for (let f = 1; f < b.floors; f += 2) { const by = 8 + f * FLOOR_H; R.flat(b.x + 4, b.z + b.d + 1, b.w - 8, 6, by, '#5b6470'); R.box(b.x + 6, by + 2, b.z + b.d + 3, b.w - 12, 2, 2, '#7f8c8d'); }
    if (b.landmark) { const ne = b.landmark === 'club' ? '#ff2e88' : b.landmark === 'mall' ? '#00e5ff' : '#ffd23e'; R.box(cx, h * 0.75, cz + b.d / 2 + 2, b.w * 0.6, 10, 3, ne); R.flat(cx - b.w * 0.35, cz + b.d / 2 + 6, b.w * 0.7, 18, 0.2, [1, 0.3, 0.6, 0.12]); }
    winGrid(R, b, night);
  }
  for (const sg of W.signs) { R.box(sg.x, 46, sg.z, sg.w, 16, 4, sg.c); R.box(sg.x, 46, sg.z + 3, sg.w * 0.7, 4, 2, '#ecf0f1'); }
  for (const tr of W.trees) {
    if (!vis(tr.x, tr.z, 60)) continue;
    const s = tr.s, H = 26 * s;
    if (tr.z > BEACH_Z) {
      R.cyl(tr.x, H * 0.4, tr.z, 2.5 * s, H * 0.8, '#8a6b46', 5);
      for (let i = 0; i < 5; i += 1) { const fa = (i / 5) * Math.PI * 2; R.tube(tr.x, H * 0.8, tr.z, tr.x + Math.cos(fa) * 16 * s, H * 0.62, tr.z + Math.sin(fa) * 16 * s, 2.5 * s, '#27ae60', 4); }
      R.sph(tr.x, H * 0.85, tr.z, 4 * s, 3 * s, 4 * s, '#8a6b46', 5);
    } else {
      R.lathe(tr.x, 0, tr.z, [0, 0, 3, 2, 4, 8, 2.5, 16, 1.5, 22, 0.8, 26, 0, 28].map((v) => v * s), '#6b4a2f', 6, 0);
      R.sph(tr.x, H * 0.75, tr.z, H * 0.42, H * 0.5, H * 0.42, '#2e7d32', 7);
      R.sph(tr.x + H * 0.25, H * 0.6, tr.z + H * 0.15, H * 0.28, H * 0.32, H * 0.28, '#388e3c', 6);
      R.sph(tr.x - H * 0.22, H * 0.62, tr.z - H * 0.12, H * 0.26, H * 0.3, H * 0.26, '#43a047', 6);
    }
  }
  for (const s of W.stalls) if (vis(s.x, s.z, 80)) drawStall(R, s);
  for (const [k, pl] of Object.entries(G.places)) {
    const col = PC[k] || '#ecf0f1';
    R.cyl(pl.x, 90, pl.z, 4, 180, col, 6);
    R.sph(pl.x, 185, pl.z, 10, 10, 10, col, 6);
    R.box(pl.x, 4, pl.z, 26, 8, 26, col);
  }
  for (const a of AVENUES) for (const s of STREETS) {
    if (!vis(a, s, 120)) continue;
    R.box(a + 62, 12, s + 62, 3, 24, 3, '#2f3542');
    R.box(a + 62, 26, s + 62, 9, 3, 9, night ? '#ffe66d' : '#cbd5e1');
    if (night) R.flat(a + 52, s + 52, 20, 20, 0.2, [1, 0.9, 0.5, 0.18]);
    const go = Math.floor(t / 8) % 2 === 0;
    R.box(a - 62, 14, s - 62, 3, 28, 3, '#2f3542');
    R.box(a - 62, 30, s - 62, 8, 16, 8, '#2f3542');
    R.box(a - 62, 34, s - 62, 5, 5, 5, go ? '#2ecc71' : '#e74c3c');
    R.box(a - 62, 27, s - 62, 5, 5, 5, go ? '#e74c3c' : '#2ecc71');
  }
  for (const car of G.cars) if (!car.hidden && vis(car.x, car.z, 120)) drawCar(R, car, t);
  for (const ped of G.peds) if (!ped.hidden && vis(ped.x, ped.z, 80)) drawPed(R, ped, t);
  drawPlayer(R, G, t);
  if (G.weather && G.weather.raining) {
    for (let i = 0; i < 40; i += 1) {
      const rx = G.player.x + ((i * 97 + t * 300) % 600) - 300, rz = G.player.z + ((i * 61) % 600) - 300;
      R.tube(rx, 120, rz, rx - 6, 0, rz - 6, 0.8, [0.7, 0.85, 1, 0.5], 3);
    }
    for (const a of AVENUES) R.flat(a - ROAD_W / 2 + 10, 0, ROAD_W - 20, BEACH_Z, 0.13, [0.6, 0.7, 0.9, 0.22]);
    for (let i = 0; i < 6; i += 1) { const px = G.player.x + ((i * 173) % 400) - 200, pz = G.player.z + ((i * 131) % 400) - 200; R.flat(px - 18, pz - 12, 36, 24, 0.14, [0.65, 0.75, 0.95, 0.3]); }
  }
  if (G.weather && G.weather.flash > 0) {
    const bx = ex + (G.weather.boltX || 200), bz = ez + (G.weather.boltZ || -150);
    let lx = bx, lz = bz, ly = 260;
    for (let i = 0; i < 6; i += 1) {
      const nx = lx + (G.rng() - 0.5) * 60, nz = lz + (G.rng() - 0.5) * 60;
      R.box((lx + nx) / 2, ly - 22, (lz + nz) / 2, 6, 46, 6, [1, 1, 0.95, G.weather.flash]);
      lx = nx; lz = nz; ly -= 44;
    }
    R.box(ex, R.eye[1] + 120, ez, 8, 8, 8, [1, 1, 1, G.weather.flash * 0.5]);
  }
  R.flush();
  return { tris: R.tris, night };
}
