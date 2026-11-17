import { VIEW, WORLD, BEACH_Z, WATER_Z, AVENUES, STREETS, MISSION_COUNT, TUNE, CHARS, WEAPONS, CAR_NAMES, REP_LEVELS, REP_STEPS, PORTRAITS } from './config.js';
import { MAX_STARS } from './police.js';
import { clamp, dist } from './random.js';
import { districtAt } from './world.js';
import { MISSIONS } from './missions.js';
function bar(ctx, x, y, w, h, frac, color, bg) {
  ctx.fillStyle = bg || 'rgba(0,0,0,0.55)'; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = color; ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
}
function T(c, x, y, s, f, col, al) {
  c.font = f; c.fillStyle = col;
  if (al) c.textAlign = al;
  c.fillText(s, x, y);
  if (al) c.textAlign = 'left';
}
function repOf(G) {
  const pts = G.stats.earned + G.stats.missionsDone * 500;
  let lv = 0;
  for (let i = 0; i < REP_STEPS.length; i += 1) if (pts >= REP_STEPS[i]) lv = i;
  const lo = REP_STEPS[lv], hi = REP_STEPS[lv + 1] || lo + 5000;
  return { lv, frac: (pts - lo) / (hi - lo) };
}
function policeUnits(G) {
  const p = G.player, out = [];
  for (const c of G.cars) {
    if (c.driver === 'police' && !c.dead) {
      const d = Math.round(dist(c.x, c.z, p.x, p.z) / 10);
      const st = c.kind === 'heli' ? 'SPOTLIGHT ON YOU' : (Math.abs(c.speed) > 200 && d < 15 ? 'RAMMING' : 'CHASING');
      out.push({ name: c.name || 'PD', d, st });
    }
  }
  for (const pd of G.peds) {
    if ((pd.kind === 'cop' || pd.kind === 'swat') && pd.state !== 'dead') {
      const d = Math.round(dist(pd.x, pd.z, p.x, p.z) / 10);
      out.push({ name: pd.name || (pd.kind === 'swat' ? 'SWAT' : 'PD'), d, st: pd.kind === 'swat' ? 'SWAT' : 'ON FOOT' });
    }
  }
  out.sort((a, b) => a.d - b.d);
  return out.slice(0, 3);
}
export function drawHUD(G, ctx) {
  const p = G.player, w = G.wanted;
  ctx.textBaseline = 'alphabetic';
  const rep = repOf(G);
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(14, 14, 220, 96);
  T(ctx, 24, 32, (CHARS[p.char || 'vic'] || CHARS.vic).name, 'bold 13px system-ui, sans-serif', '#fff');
  bar(ctx, 24, 38, 180, 12, p.hp / (p.maxHp || 100), p.hp > 30 ? '#2ecc71' : '#e74c3c');
  if (p.armor > 0) bar(ctx, 24, 54, 180, 6, p.armor / 100, '#3498db');
  T(ctx, 166, 32, `HP ${Math.ceil(p.hp)}`, '12px system-ui, sans-serif', '#fff');
  const gotPk = G.side ? G.side.packages.filter((q) => q.got).length : 0;
  T(ctx, 24, 78, `📦 ${gotPk}/${TUNE.packageCount}`, '12px system-ui, sans-serif', '#feca57');
  T(ctx, 24, 94, `REP ${rep.lv + 1} · ${REP_LEVELS[rep.lv]}`, 'bold 11px system-ui, sans-serif', '#ffd23e');
  bar(ctx, 24, 98, 180, 5, rep.frac, '#ffd23e');
  if (w.stars > 0) {
    const units = policeUnits(G);
    if (units.length) {
      const ph = 24 + units.length * 18;
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(14, 118, 220, ph);
      T(ctx, 24, 136, 'SOLMAR PD RESPONSE', 'bold 11px system-ui, sans-serif', '#ff6b6b');
      units.forEach((u, i) => {
        T(ctx, 24, 154 + i * 18, `${u.name}  ${u.d}m  ${u.st}`, '11px system-ui, sans-serif', '#fff');
      });
    }
  }
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(VIEW.w - 234, 14, 220, 54);
  T(ctx, VIEW.w - 24, 40, `$${p.money.toLocaleString('en-US')}`, 'bold 20px system-ui, sans-serif', '#2ecc71', 'right');
  T(ctx, VIEW.w - 24, 56, `Bank $${(p.bank || 0).toLocaleString('en-US')}`, '12px system-ui, sans-serif', '#7dd3fc', 'right');
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillStyle = w.stars > 0 ? '#f1c40f' : 'rgba(255,255,255,0.35)';
  ctx.fillText('★'.repeat(w.stars) + '☆'.repeat(MAX_STARS - w.stars), VIEW.w - 224, 62);
  const m = G.missions;
  let mBottom = 14;
  if (m && m.objective) {
    const dsl = m.def && m.def.steps;
    const title = `MISSION ${m.index + 1}/${MISSION_COUNT} — ${m.def.title}`;
    const next = dsl && m.step + 1 < m.def.steps.length ? `NEXT: ${m.def.steps[m.step + 1].obj}` : null;
    const stage = dsl ? `STAGE ${m.step + 1}/${m.def.steps.length}` : null;
    ctx.font = 'bold 14px system-ui, sans-serif';
    const tw1 = ctx.measureText(title).width;
    ctx.font = '13px system-ui, sans-serif';
    const tw2 = ctx.measureText(m.objective).width;
    const tw3 = next ? ctx.measureText(next).width : 0;
    const bw = Math.max(tw1, tw2, tw3, 220) + 28;
    let bh = 52;
    if (m.progress > 0) bh += 16;
    if (next) bh += 18;
    if (m.timer > 0) bh += 20;
    const bx = VIEW.w / 2 - bw / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(bx, 14, bw, bh);
    let cy = 33;
    T(ctx, VIEW.w / 2, cy, stage ? `${title}  ·  ${stage}` : title, 'bold 14px system-ui, sans-serif', '#feca57', 'center');
    cy += 20;
    T(ctx, VIEW.w / 2, cy, m.objective, '13px system-ui, sans-serif', '#fff', 'center');
    cy += 12;
    if (m.progress > 0) { bar(ctx, VIEW.w / 2 - 110, cy, 220, 8, m.progress, '#f1c40f'); cy += 16; }
    if (next) { T(ctx, VIEW.w / 2, cy + 6, next, '12px system-ui, sans-serif', '#7dd3fc', 'center'); cy += 18; }
    if (m.timer > 0) T(ctx, VIEW.w / 2, cy + 8, `⏱ ${Math.ceil(m.timer)}s`, 'bold 18px system-ui, sans-serif', m.timer < 15 ? '#e74c3c' : '#fff', 'center');
    mBottom = 14 + bh;
  }
  if (G.side) {
    let side = null;
    if (G.side.taxi.active) side = G.side.taxi.stage === 0 ? '🚕 Fare waiting — pick them up' : `🚕 Fare aboard — ${Math.ceil(G.side.taxi.timer)}s to deliver`;
    else if (G.side.race.active) side = `🏁 Race — checkpoint ${G.side.race.cp + 1}/4 — ${G.side.race.timer.toFixed(1)}s`;
    else if (G.side.delivery.active) side = `📦 Delivery — ${Math.ceil(G.side.delivery.timer)}s to the drop-off`;
    if (side) {
      ctx.font = 'bold 13px system-ui, sans-serif';
      const tw = ctx.measureText(side).width;
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(VIEW.w / 2 - tw / 2 - 12, mBottom + 6, tw + 24, 24);
      T(ctx, VIEW.w / 2, mBottom + 23, side, 'bold 13px system-ui, sans-serif', '#7dd3fc', 'center');
    }
  }
  const dist2 = districtAt(p.x, p.z);
  const weather = G.weather && G.weather.raining ? '🌧 Rain' : (G.timeOfDay > 0.78 || G.timeOfDay < 0.22 ? '🌙 Night' : G.timeOfDay > 0.68 ? '🌇 Dusk' : G.timeOfDay < 0.3 ? '🌅 Dawn' : '☀️ Clear');
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(14, VIEW.h - 214, 216, 44);
  T(ctx, 24, VIEW.h - 196, `${dist2} · ${weather}`, 'bold 13px system-ui, sans-serif', '#fff');
  T(ctx, 24, VIEW.h - 178, `♪ ${G.audio.radioName()}`, '12px system-ui, sans-serif', '#feca57');
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(VIEW.w - 234, VIEW.h - 86, 220, 72);
  const veh = p.inCar ? (p.inCar.kind === 'heli' ? '🚁 FLYING' : p.inCar.kind === 'boat' ? '⛵ SAILING' : '🚗 DRIVING') : `🔫 ${WEAPONS[p.weapon].name}`;
  T(ctx, VIEW.w - 224, VIEW.h - 60, veh, 'bold 16px system-ui, sans-serif', '#fff');
  const ammoLine = p.inCar ? `Vehicle HP ${Math.ceil(p.inCar.hp)}${p.nitro > 0 ? ` · Nitro ${Math.ceil(p.nitro)}` : ''}`
    : p.weapon === 'shotgun' ? `Shells ${p.shells} · Q switch` : p.weapon === 'rifle' ? `Rifle mag ${p.rifleMag || 0}/30 · R reload · Q switch`
    : p.weapon === 'sniper' ? `Sniper mag ${p.sniperMag || 0}/5 · R reload · Q switch` : `Ammo ${p.ammo} · Q switch`;
  T(ctx, VIEW.w - 224, VIEW.h - 38, ammoLine, '13px system-ui, sans-serif', '#feca57');
  T(ctx, VIEW.w - 224, VIEW.h - 22, p.inCar ? (p.inCar.kind === 'heli' ? 'W/S thrust · A/D turn · Space climb · C land · E exit' : p.inCar.kind === 'boat' ? 'W/S throttle · A/D steer · E exit at shore' : 'W/S drive · A/D steer · Shift nitro · E exit') : 'WASD move · Mouse aim · Click shoot · E car · F punch · Q weapon', '11px system-ui, sans-serif', 'rgba(255,255,255,0.75)');
  if (p.inCar) {
    const kmh = Math.round(Math.abs(p.inCar.speed) * 0.18);
    const cond = Math.max(0, Math.round((p.inCar.hp / (p.inCar.maxHp || 100)) * 100));
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(VIEW.w - 120, VIEW.h - 214, 106, 100);
    T(ctx, VIEW.w - 30, VIEW.h - 190, CAR_NAMES[p.inCar.kind] || 'CAR', 'bold 12px system-ui, sans-serif', '#feca57', 'right');
    T(ctx, VIEW.w - 30, VIEW.h - 172, `COND ${cond}%`, '11px system-ui, sans-serif', '#fff', 'right');
    T(ctx, VIEW.w - 30, VIEW.h - 140, `${kmh}`, 'bold 28px system-ui, sans-serif', '#fff', 'right');
    T(ctx, VIEW.w - 30, VIEW.h - 124, 'km/h', '11px system-ui, sans-serif', '#feca57', 'right');
  }
  if (G.shopNear) {
    const s = G.shopNear;
    const lines = s.kind === 'ammo'
      ? ['1 — Ammo $40', '2 — Medkit $60', '3 — Armor $120', p.ownsShotgun ? '4 — Shells $60' : '4 — Shotgun $400', p.ownsRifle ? '5 — Rifle (owned)' : '5 — Rifle $600', p.ownsSniper ? '6 — Sniper (owned)' : '6 — Sniper $900', p.ownsBat ? '7 — Bat (owned)' : '7 — Bat $150']
      : s.kind === 'repair' ? ['1 — Repair $100', '2 — Nitro $150']
      : s.kind === 'atm' ? ['1 — Deposit $100', '2 — Withdraw $100', '3 — Deposit all cash']
      : s.kind === 'safehouse' ? (p.safehouse ? ['1 — Rest (heal to full)'] : ['1 — Buy safehouse $2000'])
      : s.kind === 'clothes' ? ['1 — Next outfit $100']
      : ['1 — Meal $30 (+50 HP)', '2 — Snack $15 (+25 HP)'];
    ctx.font = 'bold 13px system-ui, sans-serif';
    const tw = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const boxH = 20 + lines.length * 20, boxY = VIEW.h - boxH - 8;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(VIEW.w / 2 - tw / 2 - 14, boxY, tw + 28, boxH);
    T(ctx, VIEW.w / 2, boxY + 20, s.label, 'bold 13px system-ui, sans-serif', '#2ecc71', 'center');
    lines.forEach((l, i) => T(ctx, VIEW.w / 2, boxY + 42 + i * 20, l, 'bold 13px system-ui, sans-serif', '#fff', 'center'));
  }
  if (G.banner && G.banner.t > 0) {
    ctx.font = 'bold 18px system-ui, sans-serif';
    const tw = ctx.measureText(G.banner.text).width;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(VIEW.w / 2 - tw / 2 - 16, 120, tw + 32, 34);
    T(ctx, VIEW.w / 2, 143, G.banner.text, 'bold 18px system-ui, sans-serif', '#fff', 'center');
  }
  drawMinimap(G, ctx);
  if (G.state === 'dialog' && m && m.dialog[m.dialogIdx]) {
    const line = m.dialog[m.dialogIdx];
    const po = PORTRAITS[line.who] || PORTRAITS.You;
    ctx.fillStyle = 'rgba(8,12,24,0.88)'; ctx.fillRect(140, VIEW.h - 208, VIEW.w - 280, 92);
    ctx.strokeStyle = '#feca57'; ctx.lineWidth = 2; ctx.strokeRect(140, VIEW.h - 208, VIEW.w - 280, 92);
    ctx.fillStyle = po.skin; ctx.fillRect(156, VIEW.h - 196, 56, 56);
    ctx.fillStyle = po.cap; ctx.fillRect(156, VIEW.h - 196, 56, 14);
    ctx.fillStyle = po.shirt; ctx.fillRect(156, VIEW.h - 152, 56, 12);
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(170, VIEW.h - 178, 6, 6); ctx.fillRect(192, VIEW.h - 178, 6, 6);
    T(ctx, 228, VIEW.h - 182, `${line.who} — Mission ${m.index + 1}: ${m.def.title}`, 'bold 16px system-ui, sans-serif', '#feca57');
    ctx.fillStyle = '#fff'; ctx.font = '16px system-ui, sans-serif';
    wrapText(ctx, line.text, 228, VIEW.h - 158, VIEW.w - 388, 22);
    T(ctx, VIEW.w - 160, VIEW.h - 126, 'E / click to continue', '12px system-ui, sans-serif', '#aaa', 'right');
  }
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
  ctx.fillStyle = '#e8d39a'; ctx.fillRect(ox, oy + BEACH_Z * sy, MW, (WATER_Z - BEACH_Z) * sy);
  ctx.fillStyle = '#2e7f9e'; ctx.fillRect(ox, oy + WATER_Z * sy, MW, MH - WATER_Z * sy);
  ctx.strokeStyle = '#3a3f47'; ctx.lineWidth = 5;
  for (const a of AVENUES) { ctx.beginPath(); ctx.moveTo(ox + a * sx, oy); ctx.lineTo(ox + a * sx, oy + BEACH_Z * sy); ctx.stroke(); }
  for (const s of STREETS) { ctx.beginPath(); ctx.moveTo(ox, oy + s * sy); ctx.lineTo(ox + MW, oy + s * sy); ctx.stroke(); }
  const m = G.missions;
  if (m && m.marker) {
    const pulse = 5 + Math.sin(G.time * 6) * 2;
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath(); ctx.arc(ox + m.marker.x * sx, oy + m.marker.z * sy, pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000'; ctx.font = 'bold 10px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('◆', ox + m.marker.x * sx, oy + m.marker.z * sy + 3.5); ctx.textAlign = 'left';
  }
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
  ctx.fillStyle = '#3b82f6';
  for (const c of G.cars) if (c.driver === 'police' && !c.dead) { ctx.beginPath(); ctx.arc(ox + c.x * sx, oy + c.z * sy, 3, 0, Math.PI * 2); ctx.fill(); }
  for (const p of G.peds) if (p.kind === 'cop' && p.state !== 'dead') { ctx.beginPath(); ctx.arc(ox + p.x * sx, oy + p.z * sy, 2.5, 0, Math.PI * 2); ctx.fill(); }
  const px = ox + G.player.x * sx, py = oy + G.player.z * sy;
  ctx.save(); ctx.translate(px, py); ctx.rotate(G.player.inCar ? G.player.inCar.angle : G.player.angle);
  ctx.fillStyle = '#ffd23e'; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-6, -5); ctx.lineTo(-6, 5); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.strokeRect(ox, oy, MW, MH);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.fillText('SOLMAR BAY', ox + 6, oy + 12);
}
export function drawTitle(G, ctx) {
  ctx.fillStyle = 'rgba(6,10,22,0.55)'; ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  T(ctx, VIEW.w / 2, 250, 'SOLMAR BAY', 'bold 84px system-ui, sans-serif', '#feca57', 'center');
  T(ctx, VIEW.w / 2, 292, 'An open-world crime story in 3D', '26px system-ui, sans-serif', '#fff', 'center');
  T(ctx, VIEW.w / 2, 330, 'Steal cars. Fly helicopters. Sail boats. Outrun the law. Run twenty-two missions.', '16px system-ui, sans-serif', '#dfe4ea', 'center');
  T(ctx, VIEW.w / 2, 362, '22 MISSIONS · 2 HEROES · HELI · BOATS · 6-STAR · 3 SAVE SLOTS', 'bold 15px system-ui, sans-serif', '#7dd3fc', 'center');
  const blink = Math.sin(G.time * 4) > -0.2;
  if (blink) T(ctx, VIEW.w / 2, 430, G.saveExists ? 'ENTER — Continue your story' : 'ENTER — Start a new story', 'bold 22px system-ui, sans-serif', '#ffd23e', 'center');
  const slots = [1, 2, 3].map((n) => `${G.saveSlot === n - 1 ? '▶' : ' '}Slot ${n}${G.slotSaves && G.slotSaves[n - 1] ? ' ✓' : ' —'}`).join('   ');
  T(ctx, VIEW.w / 2, 462, `Save slots (press 1 / 2 / 3):  ${slots}`, 'bold 16px system-ui, sans-serif', '#feca57', 'center');
  T(ctx, VIEW.w / 2, 500, 'WASD move · Mouse aim · Click shoot · E enter / exit · F punch · Q weapon · R reload · V switch hero · B shop · T taxi · Y delivery · M map · P pause · N mute', '15px system-ui, sans-serif', '#aaa', 'center');
  T(ctx, VIEW.w / 2, 528, 'Progress saves automatically after every mission.', '15px system-ui, sans-serif', '#aaa', 'center');
}
export function drawPaused(G, ctx) {
  ctx.fillStyle = 'rgba(6,10,22,0.66)'; ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  T(ctx, VIEW.w / 2, 330, 'PAUSED', 'bold 52px system-ui, sans-serif', '#fff', 'center');
  T(ctx, VIEW.w / 2, 380, 'P / Esc — resume · R — restart the story · N — mute', '18px system-ui, sans-serif', '#dfe4ea', 'center');
  T(ctx, VIEW.w / 2, 414, `Missions done: ${G.stats.missionsDone} / ${MISSION_COUNT} · Earned: $${G.stats.earned.toLocaleString('en-US')}`, '18px system-ui, sans-serif', '#dfe4ea', 'center');
  T(ctx, VIEW.w / 2, 460, 'SETTINGS', 'bold 16px system-ui, sans-serif', '#feca57', 'center');
  const set = G.settings || { volume: 0.5, quality: 'high', radio: 0 };
  T(ctx, VIEW.w / 2, 490, `1 — Volume down · 2 — Volume up  (now ${Math.round(set.volume * 100)}%)`, '16px system-ui, sans-serif', '#dfe4ea', 'center');
  T(ctx, VIEW.w / 2, 516, `3 — Quality: ${set.quality}  ·  4 — Radio: ${G.audio.radioName()}`, '16px system-ui, sans-serif', '#dfe4ea', 'center');
}
export function drawMap(G, ctx) {
  ctx.fillStyle = 'rgba(6,10,22,0.78)'; ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  T(ctx, VIEW.w / 2, 60, 'SOLMAR BAY — MAP', 'bold 28px system-ui, sans-serif', '#feca57', 'center');
  T(ctx, VIEW.w / 2, 86, 'M — close map · Yellow ◆ mission · Blue taxi · Pink race · Orange delivery · White dots packages', '15px system-ui, sans-serif', '#dfe4ea', 'center');
  ctx.save();
  ctx.translate(316, 96);
  ctx.scale(3, 3);
  ctx.translate(-16, -(VIEW.h - 152 - 16));
  drawMinimap(G, ctx);
  ctx.restore();
  const done = G.stats.missionsDone || 0, cur = G.missions ? G.missions.index : 0;
  T(ctx, 1000, 130, 'MISSIONS — 22', 'bold 18px system-ui, sans-serif', '#feca57');
  MISSIONS.forEach((mm, i) => {
    const mark = i < done ? '✓' : i === cur ? '▶' : '·';
    const col = i < done ? '#2ecc71' : i === cur ? '#ffd23e' : '#aaa';
    T(ctx, 1000, 156 + i * 24, `${mark} ${i + 1}. ${mm.title}`, '13px system-ui, sans-serif', col);
  });
  T(ctx, 1000, 700, '2 heroes · helis · boats · 6-star wanted', '12px system-ui, sans-serif', '#7dd3fc');
  T(ctx, 1000, 720, '3 save slots · 20 packages · economy', '12px system-ui, sans-serif', '#7dd3fc');
}
export function drawWasted(G, ctx) {
  ctx.fillStyle = 'rgba(40,0,0,0.72)'; ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  T(ctx, VIEW.w / 2, 360, 'WASTED', 'bold 96px system-ui, sans-serif', '#ff6b6b', 'center');
  T(ctx, VIEW.w / 2, 410, 'The Solmar Bay PD sends its regards. You wake up at Solmar General, lighter in the wallet.', '20px system-ui, sans-serif', '#fff', 'center');
  const blink = Math.sin(G.time * 4) > -0.2;
  if (blink) T(ctx, VIEW.w / 2, 480, 'R — Get back on your feet', 'bold 22px system-ui, sans-serif', '#ffd23e', 'center');
}
export function drawComplete(G, ctx) {
  ctx.fillStyle = 'rgba(6,22,10,0.72)'; ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  T(ctx, VIEW.w / 2, 300, 'THE CROWN!', 'bold 64px system-ui, sans-serif', '#2ecc71', 'center');
  T(ctx, VIEW.w / 2, 350, 'Six stars, SWAT on the ground — and you still walked out with the crown.', '22px system-ui, sans-serif', '#fff', 'center');
  T(ctx, VIEW.w / 2, 388, `Final take: $${G.player.money.toLocaleString('en-US')} · Missions: ${MISSION_COUNT} / ${MISSION_COUNT}`, '22px system-ui, sans-serif', '#fff', 'center');
  T(ctx, VIEW.w / 2, 460, 'ENTER — Keep playing free roam', 'bold 20px system-ui, sans-serif', '#ffd23e', 'center');
}
