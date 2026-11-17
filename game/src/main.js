// Solmar Bay — the game itself: state, the fixed-step loop, menus, staging and the
import { VIEW, WORLD, STEP, START, TUNE, PLACES, MISSION_COUNT } from './config.js';
import { mulberry32 } from './random.js';
import { buildWorld } from './world.js';
import { createRenderer } from './gl.js';
import { render3D, updateCamera } from './render3d.js';
import { createInput, take, endFrame } from './input.js';
import { createAudio } from './audio.js';
import { updatePlayer } from './player.js';
import { spawnTraffic, spawnPeds, updateTraffic, updatePeds } from './traffic.js';
import { spawnHeli, spawnBoat, updateVehicles } from './vehicles.js';
import { updateWanted, updatePolice } from './police.js';
import { updateBullets } from './combat.js';
import { startMission, advanceDialog, updateMissions } from './missions.js';
import { initSide, updateSide } from './side.js';
import { drawHUD, drawTitle, drawPaused, drawWasted, drawComplete, drawMap } from './hud.js';
import { stageShot } from './shots.js';
import { saveGame, loadGame, clearSave } from './save.js';
const canvas = document.getElementById('game');
canvas.width = VIEW.w; canvas.height = VIEW.h;
const hudCanvas = document.getElementById('hud');
hudCanvas.width = VIEW.w; hudCanvas.height = VIEW.h;
const hctx = hudCanvas.getContext('2d');
const R = createRenderer(canvas);
const params = new URLSearchParams(location.search);
const SEED = Number(params.get('seed') || 7);
const SHOT = params.get('shot') || '';
function freshState(seed) {
  const rng = mulberry32(seed);
  const G = {
    seed, rng, world: buildWorld(rng), input: createInput(canvas), audio: createAudio(),
    canvas, state: 'title', time: 0, timeOfDay: 0.25, frozen: false,
    player: {
      x: START.x, z: START.z, angle: -Math.PI / 2, walkAngle: 0, hp: TUNE.playerHp, maxHp: TUNE.playerHp,
      money: START.money, bank: 0, ammo: START.ammo, shells: 0, weapon: 'pistol', ownsShotgun: false,
      ownsRifle: false, ownsSniper: false, rifleMag: 0, sniperMag: 0, ownsBat: false,
      armor: 0, nitro: 0, inCar: null, fireCd: 0, punchCd: 0, hurtT: 0, moving: false,
      char: 'vic', outfit: 0, safehouse: false,
    },
    cars: [], peds: [], bullets: [], particles: [], skids: [],
    wanted: { stars: 0, points: 0, quietT: 0 },
    pendingWanted: 0, roadblock: null, roadblockSet: false,
    missions: null, places: PLACES, aim: null,
    weather: { raining: false, t: 0, flash: 0, nextBolt: 30, boltX: 200, boltZ: -150 },
    settings: { volume: 0.5, quality: 'high', radio: 0 },
    saveSlot: 0, slotSaves: [0, 1, 2].map((s) => !!loadGame(s)), saveExists: false, muted: false,
    lastAuto: 0,
    camera: { eye: [START.x, 120, START.z + 200], target: [START.x, 20, START.z], heading: -Math.PI / 2, shake: 0 },
    stats: { kills: 0, stolen: 0, earned: 0, shots: 0, missionsDone: 0 },
    banner: null, shopNear: null, saveExists: false, muted: false,
  };
  G.reset = function resetGame() {
    const keep = { input: G.input, audio: G.audio, canvas: G.canvas };
    const fresh = freshState(seed);
    Object.assign(G, fresh, keep);
    G.reset = resetGame;
  };
  spawnTraffic(G); spawnPeds(G);
  initSide(G);
  spawnHeli(G, PLACES.helipad.x, PLACES.helipad.z, 'parked');
  spawnBoat(G, PLACES.marina.x, PLACES.marina.z, 'parked');
  spawnBoat(G, PLACES.marina.x + 110, PLACES.marina.z + 12, 'parked');
  return G;
}
const G = freshState(SEED);
G.saveExists = G.slotSaves[0];
G.renderer = R;
function stepPlaying(dt) {
  G.time += dt;
  G.timeOfDay = Math.min(0.98, G.timeOfDay + TUNE.timeRate * dt);
  G.weather.t += dt;
  G.weather.raining = (G.weather.t % 240) >= 60 && (G.weather.t % 240) < 120;
  if (G.weather.raining && G.time > G.weather.nextBolt) {
    G.weather.flash = 1; G.weather.boltX = 100 + G.rng() * 300; G.weather.boltZ = -250 + G.rng() * 200;
    G.weather.nextBolt = G.time + 8 + G.rng() * 10;
    G.audio.thunder();
  }
  if (G.weather.flash > 0) G.weather.flash = Math.max(0, G.weather.flash - dt * 1.8);
  if (G.time - G.lastAuto > 60) { G.lastAuto = G.time; saveGame(G, G.saveSlot); }
  if (G.banner) { G.banner.t -= dt; if (G.banner.t <= 0) G.banner = null; }
  updateCamera(G, dt);
  G.aim = R.rayGround(G.input.mouse.x, G.input.mouse.y);
  updatePlayer(G, dt);
  updateTraffic(G, dt);
  updatePeds(G, dt);
  updateWanted(G, dt);
  updatePolice(G, dt);
  updateVehicles(G, dt);
  updateBullets(G, dt);
  updateMissions(G, dt);
  updateSide(G, dt);
  G.audio.music(dt);
}
function startStory() {
  const save = loadGame(G.saveSlot);
  G.audio.ensure(); G.audio.startMusic();
  if (save && save.mission >= 0 && save.mission < MISSION_COUNT) {
    const p = G.player;
    p.money = save.money; p.bank = save.bank || 0; p.ammo = save.ammo; p.hp = save.hp;
    p.shells = save.shells || 0; p.ownsShotgun = !!save.ownsShotgun;
    p.ownsRifle = !!save.ownsRifle; p.ownsSniper = !!save.ownsSniper;
    p.rifleMag = save.rifleMag || 0; p.sniperMag = save.sniperMag || 0; p.ownsBat = !!save.ownsBat;
    p.armor = save.armor || 0; p.nitro = save.nitro || 0;
    p.x = save.x; p.z = save.z ?? save.y; G.timeOfDay = save.timeOfDay ?? 0.25;
    p.char = save.char || 'vic'; p.maxHp = p.char === 'luna' ? 85 : 100;
    p.outfit = save.outfit || 0; p.safehouse = !!save.safehouse;
    if (save.radio !== undefined) { G.settings.radio = save.radio; G.audio.setRadio(save.radio); }
    if (save.volume !== undefined) { G.settings.volume = save.volume; G.audio.setVolume(save.volume); }
    if (save.quality) G.settings.quality = save.quality;
    G.stats.missionsDone = save.missionsDone || 0; G.stats.earned = save.earned || 0;
    if (save.packages && G.side) for (const id of save.packages) { const pk = G.side.packages[id]; if (pk) pk.got = true; }
    startMission(G, save.mission);
  } else {
    startMission(G, 0);
  }
}
function respawn() {
  const p = G.player;
  p.hp = p.maxHp || TUNE.playerHp; p.money = Math.floor(p.money * 0.8);
  if (p.safehouse) { p.x = PLACES.hideout.x; p.z = PLACES.hideout.z; }
  else { p.x = 2400; p.z = 760; }
  p.inCar = null; p.ammo = Math.max(p.ammo, 12);
  G.wanted = { stars: 0, points: 0, quietT: 0 };
  G.audio.siren(false);
  G.banner = { text: 'Back on your feet. The city is still yours to take.', t: 3 };
  G.state = 'playing';
}
function restartStory() {
  clearSave(G.saveSlot);
  G.reset();
  G.slotSaves = [0, 1, 2].map((s) => !!loadGame(s));
  G.saveExists = G.slotSaves[G.saveSlot];
  startStory();
}
function handleKeys() {
  const input = G.input;
  if (take(input, 'n')) { G.muted = !G.muted; G.audio.setMuted(G.muted); }
  if (G.state === 'title') {
    for (const n of [1, 2, 3]) if (take(input, String(n))) { G.saveSlot = n - 1; G.saveExists = G.slotSaves[n - 1]; }
    if (take(input, 'Enter')) startStory();
    return;
  }
  if (G.state === 'dialog') {
    if (take(input, 'e', 'Enter') || input.mouseClicked) advanceDialog(G);
    return;
  }
  if (G.state === 'playing') {
    if (take(input, 'p', 'Escape')) { G.state = 'paused'; return; }
    if (take(input, 'm')) { G.state = 'map'; return; }
    return;
  }
  if (G.state === 'map') {
    if (take(input, 'm', 'Escape')) G.state = 'playing';
    return;
  }
  if (G.state === 'paused') {
    if (take(input, 'p', 'Escape')) G.state = 'playing';
    else if (take(input, 'r')) restartStory();
    else if (take(input, '1')) { G.settings.volume = Math.max(0, G.settings.volume - 0.1); G.audio.setVolume(G.settings.volume); }
    else if (take(input, '2')) { G.settings.volume = Math.min(1, G.settings.volume + 0.1); G.audio.setVolume(G.settings.volume); }
    else if (take(input, '3')) { G.settings.quality = G.settings.quality === 'high' ? 'low' : 'high'; }
    else if (take(input, '4')) { G.audio.cycleRadio(); G.settings.radio = (G.settings.radio + 1) % 3; }
    return;
  }
  if (G.state === 'wasted') {
    if (take(input, 'r')) respawn();
    return;
  }
  if (G.state === 'complete') {
    if (take(input, 'Enter')) { G.state = 'playing'; G.missions.objective = 'Free roam — Solmar Bay is yours.'; }
  }
}
function render(G) {
  render3D(G, R);
  hctx.clearRect(0, 0, VIEW.w, VIEW.h);
  if (G.state === 'title') drawTitle(G, hctx);
  else if (G.state === 'paused') drawPaused(G, hctx);
  else if (G.state === 'map') drawMap(G, hctx);
  else if (G.state === 'wasted') drawWasted(G, hctx);
  else if (G.state === 'complete') drawComplete(G, hctx);
  else if (G.state === 'playing' || G.state === 'dialog' || G.state === 'shot') drawHUD(G, hctx);
}
let last = performance.now(), acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (G.state === 'playing' || G.state === 'title') {
    acc += dt;
    while (acc >= STEP) { acc -= STEP; stepPlaying(STEP); }
  }
  handleKeys();
  render(G);
  endFrame(G.input);
}
if (SHOT) {
  const result = stageShot(SHOT, G, (dt) => stepPlaying(dt));
  G.state = 'shot'; G.frozen = true;
  render(G);
  window.__SHOT_READY = true;
  window.__SHOT_SCREEN = result.screen;
  requestAnimationFrame(function still() { render(G); requestAnimationFrame(still); });
} else {
  requestAnimationFrame(frame);
}
window.SOLMAR = {
  G, startMission, startStory, respawn,
  setTimeOfDay(t) { G.timeOfDay = t; },
  teleport(x, z) { G.player.x = x; G.player.z = z; if (G.player.inCar) { G.player.inCar.x = x; G.player.inCar.z = z; } },
  state() {
    const gotPk = G.side ? G.side.packages.filter((q) => q.got).length : 0;
    return {
      state: G.state, x: Math.round(G.player.x), z: Math.round(G.player.z),
      hp: G.player.hp, money: G.player.money, bank: G.player.bank || 0, ammo: G.player.ammo, shells: G.player.shells,
      weapon: G.player.weapon, rifleMag: G.player.rifleMag || 0, sniperMag: G.player.sniperMag || 0,
      char: G.player.char || 'vic', outfit: G.player.outfit || 0, safehouse: !!G.player.safehouse,
      armor: Math.round(G.player.armor || 0), nitro: Math.round((G.player.nitro || 0) * 10) / 10,
      inCar: !!G.player.inCar, vehicle: G.player.inCar ? G.player.inCar.kind : null,
      alt: G.player.inCar && G.player.inCar.kind === 'heli' ? Math.round(G.player.inCar.y) : 0,
      wanted: G.wanted.stars, mission: G.missions ? G.missions.index : -1,
      stage: G.missions ? G.missions.stage : -1, objective: G.missions ? G.missions.objective : '',
      cars: G.cars.length, peds: G.peds.length, bullets: G.bullets.length,
      packages: gotPk, timeOfDay: G.timeOfDay, raining: G.weather.raining,
    };
  },
};
