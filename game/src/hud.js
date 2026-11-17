// Solmar Bay — every pixel of interface, drawn on the 2D overlay canvas above the
// WebGL scene: health, cash, ammo, wanted stars, mission objective, the minimap,
// dialogue, banners and the title / pause / wasted screens.
import { VIEW, WORLD, BEACH_Z, WATER_Z, AVENUES, STREETS, MISSION_COUNT, TUNE } from './config.js';
import { clamp } from './random.js';
import { districtAt } from './world.js';

function bar(ctx, x, y, w, h, frac, color, bg) {
  ctx.fillStyle = bg || 'rgba(0,0,0,0.55)'; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = color; ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
}

export function drawHUD(G, ctx) {
  const p = G.player, w = G.wanted;
  ctx.textBaseline = 'alphabetic';
  // Top-left: health + armor + packages.
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(14, 14, 220, 74);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 13px system-ui, sans-serif'; ctx.fillText('VIC', 24, 32);
  bar(ctx, 24, 38, 180, 12, p.hp / 100, p.hp > 30 ? '#2ecc71' : '#e74c3c');
  if (p.armor > 0) bar(ctx, 24, 54, 180, 6, p.armor / 100, '#3498db');
  ctx.fillStyle = '#fff'; ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(`HP ${Math.ceil(p.hp)}`, 210 - 44, 32);
  const gotPk = G.side ? G.side.packages.filter((q) => q.got).length : 0;
  ctx.fillStyle = '#feca57'; ctx.fillText(`📦 ${gotPk}/${TUNE.packageCount}`, 24, 78);
  // Top-right: cash + wanted.
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(VIEW.w - 234, 14, 220, 54);
  ctx.fillStyle = '#2ecc71'; ctx.font = 'bold 20px system-ui, sans-serif'; ctx.textAlign = 'right';
  ctx.fillText(`$${p.money.toLocaleString('en-US')}`, VIEW.w - 24, 40);
  ctx.textAlign = 'left';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillStyle = w.stars > 0 ? '#f1c40f' : 'rgba(255,255,255,0.35)';
  ctx.fillText('★'.repeat(w.stars) + '☆'.repeat(5 - w.stars), VIEW.w - 224, 62);
  // Top-centre: mission objective + timer + district/weather.
  const m = G.missions;
  if (m && m.objective) {
    ctx.font = 'bold 15px system-ui, sans-serif';
    const tw = ctx.measureText(m.objective).width;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(VIEW.w / 2 - tw / 2 - 14, 14, tw + 28, 30);
    ctx.fillStyle = '#feca57'; ctx.textAlign = 'center';
    ctx.fillText(m.objective, VIEW.w / 2, 35); ctx.textAlign = 'left';
    if (m.timer > 0) {
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.fillStyle = m.timer < 15 ? '#e74c3c' : '#fff'; ctx.textAlign = 'center';
      ctx.fillText(`⏱ ${Math.ceil(m.timer)}s`, VIEW.w / 2, 66); ctx.textAlign = 'left';
    }
    if (m.progress > 0) bar(ctx, VIEW.w / 2 - 110, 52, 220, 10, m.progress, '#f1c40f');
  }
  // Side objective (taxi fare / race) under the main one.
  if (G.side) {
    let side = null;
    if (G.side.taxi.active) side = G.side.taxi.stage === 0 ? '🚕 Fare waiting — pick them up' : `🚕 Fare aboard — ${Math.ceil(G.side.taxi.timer)}s to deliver`;
    else if (G.side.race.active) side = `🏁 Race — checkpoint ${G.side.race.cp + 1}/4 — ${G.side.race.timer.toFixed(1)}s`;
    if (side) {
      ctx.font = 'bold 13px system-ui, sans-serif';
      const tw = ctx.measureText(side).width;
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(VIEW.w / 2 - tw / 2 - 12, 48, tw + 24, 24);
      ctx.fillStyle = '#7dd3fc'; ctx.textAlign = 'center'; ctx.fillText(side, VIEW.w / 2, 65); ctx.textAlign = 'left';
    }
  }
  // District + weather, bottom-left above the minimap.
  const dist = districtAt(p.x, p.z);
  const weather = G.weather && G.weather.raining ? '🌧 Rain' : (G.timeOfDay > 0.78 || G.timeOfDay < 0.22 ? '🌙 Night' : G.timeOfDay > 0.68 ? '🌇 Dusk' : G.timeOfDay < 0.3 ? '🌅 Dawn' : '☀️ Clear');
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(14, VIEW.h - 196, 216, 26);
  ctx.fillStyle = '#fff'; ctx.fillText(`${dist} · ${weather}`, 24, VIEW.h - 178);
  // Bottom-right: weapon / vehicle + hints.
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(VIEW.w - 234, VIEW.h - 86, 220, 72);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 16px system-ui, sans-serif';
  const veh = p.inCar ? (p.inCar.kind === 'heli' ? '🚁 FLYING' : p.inCar.kind === 'boat' ? '⛵ SAILING' : '🚗 DRIVING') : (p.weapon === 'shotgun' ? '🔫 SHOTGUN' : '🔫 PISTOL');
  ctx.fillText(veh, VIEW.w - 224, VIEW.h - 60);
  ctx.font = '13px system-ui, sans-serif'; ctx.fillStyle = '#feca57';
  ctx.fillText(p.inCar ? `Vehicle HP ${Math.ceil(p.inCar.hp)}${p.nitro > 0 ? ` · Nitro ${Math.ceil(p.nitro)}` : ''}` : (p.weapon === 'shotgun' ? `Shells ${p.shells} · Q switch` : `Ammo ${p.ammo} · Q switch`), VIEW.w - 224, VIEW.h - 38);
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = '11px system-ui, sans-serif';
  ctx.fillText(p.inCar ? (p.inCar.kind === 'heli' ? 'W/S thrust · A/D turn · Space climb · C land · E exit' : p.inCar.kind === 'boat' ? 'W/S throttle · A/D steer · E exit at shore' : 'W/S drive · A/D steer · Shift nitro · E exit') : 'WASD move · Mouse aim · Click shoot · E car · F punch · Q weapon', VIEW.w - 224, VIEW.h - 22);
  // Shop menu.
  if (G.shopNear) {
    const s = G.shopNear;
    const lines = s.kind === 'ammo'
      ? ['1 — Ammo $40', '2 — Medkit $60', '3 — Armor $120', p.ownsShotgun ? '4 — Shells $60' : '4 — Shotgun $400']
      : ['1 — Repair $100', '2 — Nitro $150'];
    ctx.font = 'bold 13px system-ui, sans-serif';
    const tw = Math.max(...lines.map((l) => ctx.measureText(l).width));
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(VIEW.w / 2 - tw / 2 - 14, VIEW.h - 148, tw + 28, 20 + lines.length * 20);
    ctx.fillStyle = '#2ecc71'; ctx.textAlign = 'center';
    ctx.fillText(s.label, VIEW.w / 2, VIEW.h - 128);
    ctx.fillStyle = '#fff';
    lines.forEach((l, i) => ctx.fillText(l, VIEW.w / 2, VIEW.h - 106 + i * 20));
    ctx.textAlign = 'left';
  }
  // Banner announcements.
  if (G.banner && G.banner.t > 0) {
    ctx.font = 'bold 18px system-ui, sans-serif';
    const tw = ctx.measureText(G.banner.text).width;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(VIEW.w / 2 - tw / 2 - 16, 84, tw + 32, 34);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(G.banner.text, VIEW.w / 2, 107); ctx.textAlign = 'left';
  }
  drawMinimap(G, ctx);
  // Dialogue panel.
  if (G.state === 'dialog' && m && m.dialog[m.dialogIdx]) {
    const line = m.dialog[m.dialogIdx];
    ctx.fillStyle = 'rgba(8,12,24,0.88)'; ctx.fillRect(140, VIEW.h - 208, VIEW.w - 280, 92);
    ctx.strokeStyle = '#feca57'; ctx.lineWidth = 2; ctx.strokeRect(140, VIEW.h - 208, VIEW.w - 280, 92);
    ctx.fillStyle = '#feca57'; ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText(`${line.who} — Mission ${m.index + 1}: ${m.def.title}`, 160, VIEW.h - 182);
    ctx.fillStyle = '#fff'; ctx.font = '16px system-ui, sans-serif';
    wrapText(ctx, line.text, 160, VIEW.h - 158, VIEW.w - 320, 22);
    ctx.fillStyle = '#aaa'; ctx.font = '12px system-ui, sans-serif'; ctx.textAlign = 'right';
    ctx.fillText('E / click to continue', VIEW.w - 160, VIEW.h - 126); ctx.textAlign = 'left';
  }
  // Hurt vignette + rain tint.
  if (p.hurtT > 0) {
    ctx.fillStyle = `rgba(231,76,60,${(p.hurtT / 0.35) * 0.28})`;
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  }
  if (G.weather && G.weather.raining) {
    ctx.fillStyle = 'rgba(70,90,130,0.10)';
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  }
}

function wrapText(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, y); line = word; y += lh; }
    else line = test;
  }
  ctx.fillText(line, x, y);
}

export function drawMinimap(G, ctx) {
  const MW = 216, MH = 152, ox = 16, oy = VIEW.h - MH - 16;
  const sx = MW / WORLD.w, sy = MH / WORLD.h;
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(ox - 4, oy - 4, MW + 8, MH + 8);
  ctx.fillStyle = '#2c6e4f'; ctx.fillRect(ox, oy, MW, MH);
  // Beach + water.
  ctx.fillStyle = '#e8d39a'; ctx.fillRect(ox, oy + BEACH_Z * sy, MW, (WATER_Z - BEACH_Z) * sy);
  ctx.fillStyle = '#2e7f9e'; ctx.fillRect(ox, oy + WATER_Z * sy, MW, MH - WATER_Z * sy);
  // Roads.
  ctx.strokeStyle = '#3a3f47'; ctx.lineWidth = 5;
  for (const a of AVENUES) { ctx.beginPath(); ctx.moveTo(ox + a * sx, oy); ctx.lineTo(ox + a * sx, oy + BEACH_Z * sy); ctx.stroke(); }
  for (const s of STREETS) { ctx.beginPath(); ctx.moveTo(ox, oy + s * sy); ctx.lineTo(ox + MW, oy + s * sy); ctx.stroke(); }
  // Mission marker.
  const m = G.missions;
  if (m && m.marker) {
    const pulse = 5 + Math.sin(G.time * 6) * 2;
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath(); ctx.arc(ox + m.marker.x * sx, oy + m.marker.z * sy, pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000'; ctx.font = 'bold 10px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('◆', ox + m.marker.x * sx, oy + m.marker.z * sy + 3.5); ctx.textAlign = 'left';
  }
  // Side markers: packages, taxi, race.
  if (G.side) {
    ctx.fillStyle = '#fff';
    for (const pk of G.side.packages) {
      if (pk.got) continue;
      ctx.fillRect(ox + pk.x * sx - 2, oy + pk.z * sy - 2, 4, 4);
    }
    if (G.side.taxi.active && G.side.taxi.marker) {
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath(); ctx.arc(ox + G.side.taxi.marker.x * sx, oy + G.side.taxi.marker.z * sy, 4, 0, Math.PI * 2); ctx.fill();
    }
    if (G.side.race.active && G.side.race.marker) {
      ctx.fillStyle = '#f472b6';
      ctx.beginPath(); ctx.arc(ox + G.side.race.marker.x * sx, oy + G.side.race.marker.z * sy, 4, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Police dots (cars + foot + heli).
  ctx.fillStyle = '#3b82f6';
  for (const c of G.cars) if (c.driver === 'police' && !c.dead) { ctx.beginPath(); ctx.arc(ox + c.x * sx, oy + c.z * sy, 3, 0, Math.PI * 2); ctx.fill(); }
  for (const p of G.peds) if (p.kind === 'cop' && p.state !== 'dead') { ctx.beginPath(); ctx.arc(ox + p.x * sx, oy + p.z * sy, 2.5, 0, Math.PI * 2); ctx.fill(); }
  // Player arrow.
  const px = ox + G.player.x * sx, py = oy + G.player.z * sy;
  ctx.save(); ctx.translate(px, py); ctx.rotate(G.player.inCar ? G.player.inCar.angle : G.player.angle);
  ctx.fillStyle = '#ffd23e'; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-6, -5); ctx.lineTo(-6, 5); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.strokeRect(ox, oy, MW, MH);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.fillText('SOLMAR BAY', ox + 6, oy + 12);
}

export function drawTitle(G, ctx) {
  ctx.fillStyle = 'rgba(6,10,22,0.72)'; ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#feca57'; ctx.font = 'bold 84px system-ui, sans-serif';
  ctx.fillText('SOLMAR BAY', VIEW.w / 2, 250);
  ctx.fillStyle = '#fff'; ctx.font = '26px system-ui, sans-serif';
  ctx.fillText('An open-world crime story in 3D', VIEW.w / 2, 292);
  ctx.font = '16px system-ui, sans-serif'; ctx.fillStyle = '#dfe4ea';
  ctx.fillText('Steal cars. Fly helicopters. Sail boats. Outrun the law. Run twelve missions.', VIEW.w / 2, 330);
  ctx.fillStyle = '#ffd23e'; ctx.font = 'bold 22px system-ui, sans-serif';
  const blink = Math.sin(G.time * 4) > -0.2;
  if (blink) ctx.fillText(G.saveExists ? 'ENTER — Continue your story' : 'ENTER — Start a new story', VIEW.w / 2, 430);
  ctx.fillStyle = '#aaa'; ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('WASD move · Mouse aim · Click shoot · E enter / exit · F punch · Q weapon · B shop · T taxi · R race · P pause · M mute', VIEW.w / 2, 500);
  ctx.fillText('Progress saves automatically after every mission.', VIEW.w / 2, 528);
  ctx.textAlign = 'left';
}

export function drawPaused(G, ctx) {
  ctx.fillStyle = 'rgba(6,10,22,0.66)'; ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff'; ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.fillText('PAUSED', VIEW.w / 2, 330);
  ctx.font = '18px system-ui, sans-serif'; ctx.fillStyle = '#dfe4ea';
  ctx.fillText('P / Esc — resume · R — restart the story · M — mute', VIEW.w / 2, 380);
  ctx.fillText(`Missions done: ${G.stats.missionsDone} / ${MISSION_COUNT} · Earned: $${G.stats.earned.toLocaleString('en-US')}`, VIEW.w / 2, 414);
  ctx.textAlign = 'left';
}

export function drawWasted(G, ctx) {
  ctx.fillStyle = 'rgba(40,0,0,0.72)'; ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff6b6b'; ctx.font = 'bold 96px system-ui, sans-serif';
  ctx.fillText('WASTED', VIEW.w / 2, 360);
  ctx.fillStyle = '#fff'; ctx.font = '20px system-ui, sans-serif';
  ctx.fillText('The Solmar Bay PD sends its regards. You wake up at Solmar General, lighter in the wallet.', VIEW.w / 2, 410);
  const blink = Math.sin(G.time * 4) > -0.2;
  if (blink) { ctx.fillStyle = '#ffd23e'; ctx.font = 'bold 22px system-ui, sans-serif'; ctx.fillText('R — Get back on your feet', VIEW.w / 2, 480); }
  ctx.textAlign = 'left';
}

export function drawComplete(G, ctx) {
  ctx.fillStyle = 'rgba(6,22,10,0.72)'; ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#2ecc71'; ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText('THE LAST SCORE!', VIEW.w / 2, 300);
  ctx.fillStyle = '#fff'; ctx.font = '22px system-ui, sans-serif';
  ctx.fillText('You cracked the bank twice, ran the gauntlet, and walked away with the money.', VIEW.w / 2, 350);
  ctx.fillText(`Final take: $${G.player.money.toLocaleString('en-US')} · Missions: ${MISSION_COUNT} / ${MISSION_COUNT}`, VIEW.w / 2, 388);
  ctx.fillStyle = '#ffd23e'; ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText('ENTER — Keep playing free roam', VIEW.w / 2, 460);
  ctx.textAlign = 'left';
}
