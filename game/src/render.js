// Solmar Bay — everything the eye sees: the camera, the city, the cars, the people,
// the particles and the light of the time of day. HUD is drawn on top by hud.js.
import { VIEW, WORLD, AVENUES, STREETS, ROAD_W, BEACH_Y, PALETTE } from './config.js';
import { clamp, lerp } from './random.js';
import { drawHUD, drawTitle, drawPaused, drawWasted, drawComplete } from './hud.js';

// Time of day 0..1: 0 = 06:00 dawn, 0.42 = noon, 0.72 = sunset, 0.9+ = night.
export function lighting(tod) {
  if (tod < 0.08) return { sky: 'rgba(255,170,120,0.10)', sun: 0.95 };
  if (tod < 0.6) return { sky: 'rgba(255,255,255,0)', sun: 1 };
  if (tod < 0.8) { const t = (tod - 0.6) / 0.2; return { sky: `rgba(255,120,60,${0.16 * t})`, sun: 1 - t * 0.15 }; }
  if (tod < 0.9) { const t = (tod - 0.8) / 0.1; return { sky: `rgba(40,30,90,${0.22 * t})`, sun: 0.85 - t * 0.2 }; }
  return { sky: 'rgba(8,10,40,0.34)', sun: 0.6 };
}

function drawCar(G, ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y); ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(-24 + 3, -12 + 4, 48, 24);
  // Body.
  ctx.fillStyle = car.color;
  ctx.beginPath(); ctx.roundRect(-24, -12, 48, 24, 6); ctx.fill();
  // Cabin + windshield.
  ctx.fillStyle = 'rgba(20,30,45,0.85)';
  ctx.beginPath(); ctx.roundRect(-8, -10, 16, 20, 4); ctx.fill();
  ctx.fillStyle = 'rgba(159,216,232,0.9)';
  ctx.fillRect(8, -9, 5, 18);
  // Headlights.
  ctx.fillStyle = '#feca57';
  ctx.fillRect(22, -10, 3, 5); ctx.fillRect(22, 5, 3, 5);
  ctx.fillStyle = '#e74c3c';
  ctx.fillRect(-25, -10, 3, 5); ctx.fillRect(-25, 5, 3, 5);
  if (car.driver === 'police') {
    ctx.fillStyle = '#fff'; ctx.font = 'bold 9px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('PD', 0, 3); ctx.textAlign = 'left';
    // Light bar (flashes on game time, so staged screenshots are stable).
    const flash = Math.floor(G.time * 5) % 2 === 0;
    ctx.fillStyle = flash ? '#ff4757' : '#3742fa'; ctx.fillRect(-4, -13, 8, 4);
  }
  if (car.kind === 'taxi') {
    ctx.fillStyle = '#111'; ctx.font = 'bold 8px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 3); ctx.textAlign = 'left';
  }
  ctx.restore();
  // Damage smoke.
  if (car.hp < 45 && !car.dead) {
    ctx.fillStyle = 'rgba(87,101,116,0.5)';
    ctx.beginPath(); ctx.arc(car.x - 10, car.y - 6, 6 + Math.sin(G.time * 6) * 2, 0, Math.PI * 2); ctx.fill();
  }
  if (car.dead) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath(); ctx.arc(car.x, car.y, 26, 0, Math.PI * 2); ctx.fill();
  }
}

function drawPed(ctx, ped, G) {
  if (ped.state === 'dead') {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(ped.x, ped.y, 13, 6, ped.angle, 0, Math.PI * 2); ctx.fill();
    return;
  }
  ctx.save();
  ctx.translate(ped.x, ped.y);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(2, 3, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
  // Body + head, facing the walk direction.
  ctx.rotate(ped.angle);
  ctx.fillStyle = ped.shirt || '#3498db';
  ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f5c396';
  ctx.beginPath(); ctx.arc(5, 0, 5, 0, Math.PI * 2); ctx.fill();
  if (ped.kind === 'cop') {
    ctx.fillStyle = '#0f2a6b'; ctx.beginPath(); ctx.arc(5, 0, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 6px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('PD', 5, 2); ctx.textAlign = 'left';
  }
  if (ped.kind === 'guard') { ctx.fillStyle = '#111'; ctx.fillRect(6, -2, 8, 3); }
  if (ped.kind === 'passenger') { ctx.fillStyle = '#f39c12'; ctx.beginPath(); ctx.arc(0, -12, 4, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  if (ped.state === 'flee') {
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('!', ped.x, ped.y - 18); ctx.textAlign = 'left';
  }
}

export function render(G) {
  const ctx = G.ctx;
  const cam = G.camera;
  // Camera follows the player with a look-ahead and a shake.
  const tx = clamp(G.player.x - VIEW.w / 2, 0, WORLD.w - VIEW.w);
  const ty = clamp(G.player.y - VIEW.h / 2, 0, WORLD.h - VIEW.h);
  cam.x = lerp(cam.x, tx, 0.08); cam.y = lerp(cam.y, ty, 0.08);
  const shx = cam.shake > 0 ? (Math.random() - 0.5) * cam.shake : 0;
  const shy = cam.shake > 0 ? (Math.random() - 0.5) * cam.shake : 0;
  cam.shake = Math.max(0, cam.shake - 0.6);
  ctx.save();
  ctx.translate(-Math.round(cam.x + shx), -Math.round(cam.y + shy));
  const vx0 = cam.x - 60, vy0 = cam.y - 60, vx1 = cam.x + VIEW.w + 60, vy1 = cam.y + VIEW.h + 60;
  const L = lighting(G.timeOfDay);
  // Ground.
  ctx.fillStyle = PALETTE.grass; ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
  // Parks.
  for (const pk of G.world.parks) {
    if (pk.x > vx1 || pk.x + pk.w < vx0 || pk.y > vy1 || pk.y + pk.h < vy0) continue;
    ctx.fillStyle = '#5d9c4a'; ctx.fillRect(pk.x, pk.y, pk.w, pk.h);
    ctx.fillStyle = '#6fae56';
    for (let i = 0; i < 4; i += 1) { ctx.beginPath(); ctx.arc(pk.x + 20 + i * 30, pk.y + pk.h / 2, 9, 0, Math.PI * 2); ctx.fill(); }
  }
  // Beach + water.
  ctx.fillStyle = PALETTE.sand; ctx.fillRect(Math.max(vx0, 0), BEACH_Y, Math.min(vx1, WORLD.w) - Math.max(vx0, 0), WORLD.h - BEACH_Y);
  ctx.fillStyle = PALETTE.water; ctx.fillRect(Math.max(vx0, 0), WORLD.h - 70, Math.min(vx1, WORLD.w) - Math.max(vx0, 0), 70);
  ctx.fillStyle = PALETTE.waterDeep; ctx.fillRect(Math.max(vx0, 0), WORLD.h - 34, Math.min(vx1, WORLD.w) - Math.max(vx0, 0), 34);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(Math.max(vx0, 0), WORLD.h - 70); ctx.lineTo(Math.min(vx1, WORLD.w), WORLD.h - 70); ctx.stroke();
  // Roads.
  ctx.fillStyle = PALETTE.road;
  for (const a of AVENUES) ctx.fillRect(a - ROAD_W / 2, 0, ROAD_W, BEACH_Y);
  for (const s of STREETS) ctx.fillRect(0, s - ROAD_W / 2, WORLD.w, ROAD_W);
  // Sidewalks.
  ctx.fillStyle = PALETTE.sidewalk;
  for (const a of AVENUES) { ctx.fillRect(a - ROAD_W / 2 - 12, 0, 12, BEACH_Y); ctx.fillRect(a + ROAD_W / 2, 0, 12, BEACH_Y); }
  for (const s of STREETS) { ctx.fillRect(0, s - ROAD_W / 2 - 12, WORLD.w, 12); ctx.fillRect(0, s + ROAD_W / 2, WORLD.w, 12); }
  // Centre dashes.
  ctx.fillStyle = PALETTE.roadLine;
  for (const a of AVENUES) for (let y = 40; y < BEACH_Y; y += 70) ctx.fillRect(a - 2, y, 4, 34);
  for (const s of STREETS) for (let x = 40; x < WORLD.w; x += 70) ctx.fillRect(x, s - 2, 34, 4);
  // Skid marks.
  ctx.strokeStyle = 'rgba(20,20,20,0.35)'; ctx.lineWidth = 4;
  for (const sk of G.skids) {
    ctx.globalAlpha = Math.min(1, sk.life / 5);
    ctx.beginPath(); ctx.moveTo(sk.x1, sk.y1); ctx.lineTo(sk.x2, sk.y2); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // Buildings.
  for (const b of G.world.buildings) {
    if (b.x > vx1 || b.x + b.w < vx0 || b.y > vy1 || b.y + b.h < vy0) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(b.x + 7, b.y + 9, b.w, b.h);
    ctx.fillStyle = b.color; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fillRect(b.x, b.y, b.w, 8);
    ctx.fillStyle = PALETTE.glass;
    const cols = Math.max(2, Math.floor(b.w / 34)), rows = Math.max(1, Math.floor(b.h / 38));
    for (let cx = 0; cx < cols; cx += 1) for (let cy = 0; cy < rows; cy += 1) {
      if (((cx * 7 + cy * 3 + Math.floor(b.seed)) % 5) === 0) continue;
      ctx.fillRect(b.x + 12 + cx * ((b.w - 20) / cols), b.y + 14 + cy * ((b.h - 24) / rows), 12, 14);
    }
  }
  // Trees.
  for (const t of G.world.trees) {
    if (t.x < vx0 || t.x > vx1 || t.y < vy0 || t.y > vy1) continue;
    ctx.fillStyle = PALETTE.trunk; ctx.fillRect(t.x - 2, t.y - 2, 4, 12);
    ctx.fillStyle = PALETTE.palm;
    ctx.beginPath(); ctx.arc(t.x, t.y - 6, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.beginPath(); ctx.arc(t.x - 3, t.y - 9, 4, 0, Math.PI * 2); ctx.fill();
  }
  // Place labels + markers.
  drawPlaces(G, ctx);
  // Mission marker column.
  const m = G.missions;
  if (m && m.marker) {
    const bob = Math.sin(G.time * 5) * 6;
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath(); ctx.moveTo(m.marker.x, m.marker.y - 46 + bob); ctx.lineTo(m.marker.x - 12, m.marker.y - 66 + bob); ctx.lineTo(m.marker.x + 12, m.marker.y - 66 + bob); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(241,196,15,0.7)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(m.marker.x, m.marker.y, 26 + Math.sin(G.time * 5) * 4, 0, Math.PI * 2); ctx.stroke();
  }
  // Cars (wrecks under, then the rest).
  for (const car of G.cars) if (car.dead) drawCar(G, ctx, car);
  for (const car of G.cars) if (!car.dead) drawCar(G, ctx, car);
  // Bullets.
  ctx.fillStyle = '#feca57';
  for (const b of G.bullets) { ctx.fillRect(b.x - 3, b.y - 3, 6, 6); }
  // Peds.
  for (const ped of G.peds) drawPed(ctx, ped, G);
  // Player.
  drawPlayer(G, ctx);
  // Particles.
  for (const pt of G.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Sun tint.
  if (L.sky !== 'rgba(255,255,255,0)') { ctx.fillStyle = L.sky; ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0); }
  // Night headlights.
  if (G.timeOfDay > 0.85) {
    ctx.fillStyle = 'rgba(254,202,87,0.10)';
    for (const car of G.cars) {
      if (car.dead) continue;
      ctx.beginPath(); ctx.arc(car.x + Math.cos(car.angle) * 60, car.y + Math.sin(car.angle) * 60, 46, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
  drawHUD(G, ctx);
  if (G.state === 'title') drawTitle(G, ctx);
  else if (G.state === 'paused') drawPaused(G, ctx);
  else if (G.state === 'wasted') drawWasted(G, ctx);
  else if (G.state === 'complete') drawComplete(G, ctx);
}

function drawPlaces(G, ctx) {
  const places = [
    { x: 800, y: 1180, label: 'GARAGE', color: '#feca57' },
    { x: 2400, y: 700, label: 'HOSPITAL', color: '#fff' },
    { x: 1600, y: 700, label: 'BANK', color: '#2ecc71' },
    { x: 1200, y: 1500, label: 'AMMO', color: '#e74c3c' },
    { x: 2000, y: 1500, label: 'REPAIR', color: '#3498db' },
    { x: 400, y: 1900, label: 'HIDEOUT', color: '#9b59b6' },
  ];
  ctx.font = 'bold 11px system-ui, sans-serif'; ctx.textAlign = 'center';
  for (const pl of places) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(pl.x - 34, pl.y - 30, 68, 16);
    ctx.fillStyle = pl.color; ctx.fillText(pl.label, pl.x, pl.y - 18);
  }
  ctx.textAlign = 'left';
}

function drawPlayer(G, ctx) {
  const p = G.player;
  if (p.inCar) return; // The car is drawn instead.
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(2, 4, 11, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(p.angle);
  // Body.
  ctx.fillStyle = PALETTE.playerShirt;
  ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
  // Head + gun.
  ctx.fillStyle = '#f5c396'; ctx.beginPath(); ctx.arc(6, 0, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2c3e50'; ctx.fillRect(8, -2, 14, 4);
  ctx.fillStyle = PALETTE.player;
  ctx.beginPath(); ctx.arc(-4, 0, 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
