// Solmar Bay — the game itself: state, the fixed-step loop, menus, staging and the
// debug handle the tests use. Every other module does one job; this one wires them.
// The scene is WebGL (game canvas); the interface is a 2D overlay canvas above it.
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
import { drawHUD, drawTitle, drawPaused, drawWasted, drawComplete } from './hud.js';
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
      x: START.x, z: START.z, angle: -Math.PI / 2, walkAngle: 0, hp: TUNE.playerHp,
      money: START.money, ammo: START.ammo, shells: 0, weapon: 'pistol', ownsShotgun: false,
      armor: 0, nitro: 0, inCar: null, fireCd: 0, punchCd: 0, hurtT: 0, moving: false,
    },
    cars: [], peds: [], bullets: [], particles: [], skids: [],
    wanted: { stars: 0, points: 0, quietT: 0 },
    pendingWanted: 0, roadblock: null, roadblockSet: false,
    missions: null, places: PLACES, aim: null, weather: { raining: false, t: 0 },
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
  // A helicopter on the helipad and boats at the marina, free to take in free roam.
  spawnHeli(G, PLACES.helipad.x, PLACES.helipad.z, 'parked');
  spawnBoat(G, PLACES.marina.x, PLACES.marina.z, 'parked');
  spawnBoat(G, PLACES.marina.x + 110, PLACES.marina.z + 12, 'parked');
  return G;
}

const G = freshState(SEED);
G.saveExists = !!loadGame();
G.renderer = R; // shots.js aims the mouse through the camera

// One fixed step of live play (used by the loop and by the shot stager).
function stepPlaying(dt) {
  G.time += dt;
  G.timeOfDay = Math.min(0.98, G.timeOfDay + TUNE.timeRate * dt);
  // Weather: a deterministic cycle — rain for 60s in every 4 minutes of play.
  G.weather.t += dt;
  G.weather.raining = (G.weather.t % 240) >= 60 && (G.weather.t % 240) < 120;
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
  const save = loadGame();
  G.audio.ensure(); G.audio.startMusic();
  if (save && save.mission >= 0 && save.mission < MISSION_COUNT) {
    G.player.money = save.money; G.player.ammo = save.ammo; G.player.hp = save.hp;
    G.player.shells = save.shells || 0; G.player.ownsShotgun = !!save.ownsShotgun;
    G.player.armor = save.armor || 0; G.player.nitro = save.nitro || 0;
    G.player.x = save.x; G.player.z = save.z ?? save.y; G.timeOfDay = save.timeOfDay ?? 0.25;
    G.stats.missionsDone = save.missionsDone || 0; G.stats.earned = save.earned || 0;
    if (save.packages && G.side) for (const id of save.packages) { const pk = G.side.packages[id]; if (pk) pk.got = true; }
    startMission(G, save.mission);
  } else {
    startMission(G, 0);
  }
}

function respawn() {
  const p = G.player;
  p.hp = TUNE.playerHp; p.money = Math.floor(p.money * 0.8);
  p.x = 2400; p.z = 760; p.inCar = null; p.ammo = Math.max(p.ammo, 12);
  G.wanted = { stars: 0, points: 0, quietT: 0 };
  G.audio.siren(false);
  G.banner = { text: 'Back on your feet. The city is still yours to take.', t: 3 };
  G.state = 'playing';
}

function restartStory() {
  clearSave();
  G.reset();
  G.saveExists = false;
  startStory();
}

function handleKeys() {
  const input = G.input;
  if (take(input, 'm')) { G.muted = !G.muted; G.audio.setMuted(G.muted); }
  if (G.state === 'title') {
    if (take(input, 'Enter')) startStory();
    return;
  }
  if (G.state === 'dialog') {
    if (take(input, 'e', 'Enter') || input.mouseClicked) advanceDialog(G);
    return;
  }
  if (G.state === 'playing') {
    if (take(input, 'p', 'Escape')) { G.state = 'paused'; return; }
    return;
  }
  if (G.state === 'paused') {
    if (take(input, 'p', 'Escape')) G.state = 'playing';
    else if (take(input, 'r')) restartStory();
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
  else if (G.state === 'wasted') drawWasted(G, hctx);
  else if (G.state === 'complete') drawComplete(G, hctx);
  else if (G.state === 'playing' || G.state === 'dialog' || G.state === 'shot') drawHUD(G, hctx);
}

// The fixed-step loop.
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

// Screenshot staging: run the scene, freeze the frame, signal readiness.
if (SHOT) {
  const result = stageShot(SHOT, G, (dt) => stepPlaying(dt));
  G.state = 'shot'; G.frozen = true;
  render(G);
  window.__SHOT_READY = true;
  window.__SHOT_SCREEN = result.screen;
  // Keep rendering the same frozen frame (time does not advance in 'shot' state).
  requestAnimationFrame(function still() { render(G); requestAnimationFrame(still); });
} else {
  requestAnimationFrame(frame);
}

// Debug handle for tests and screenshots (not part of the game UI).
window.SOLMAR = {
  G, startMission, startStory, respawn,
  setTimeOfDay(t) { G.timeOfDay = t; },
  teleport(x, z) { G.player.x = x; G.player.z = z; if (G.player.inCar) { G.player.inCar.x = x; G.player.inCar.z = z; } },
  state() {
    const gotPk = G.side ? G.side.packages.filter((q) => q.got).length : 0;
    return {
      state: G.state, x: Math.round(G.player.x), z: Math.round(G.player.z),
      hp: G.player.hp, money: G.player.money, ammo: G.player.ammo, shells: G.player.shells,
      weapon: G.player.weapon, armor: Math.round(G.player.armor || 0), nitro: Math.round((G.player.nitro || 0) * 10) / 10,
      inCar: !!G.player.inCar, vehicle: G.player.inCar ? G.player.inCar.kind : null,
      alt: G.player.inCar && G.player.inCar.kind === 'heli' ? Math.round(G.player.inCar.y) : 0,
      wanted: G.wanted.stars, mission: G.missions ? G.missions.index : -1,
      stage: G.missions ? G.missions.stage : -1, objective: G.missions ? G.missions.objective : '',
      cars: G.cars.length, peds: G.peds.length, bullets: G.bullets.length,
      packages: gotPk, timeOfDay: G.timeOfDay, raining: G.weather.raining,
    };
  },
};
