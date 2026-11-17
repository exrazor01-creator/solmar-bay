// Solmar Bay — the game itself: state, the fixed-step loop, menus, staging and the
// debug handle the tests use. Every other module does one job; this one wires them.
import { VIEW, WORLD, STEP, START, TUNE } from './config.js';
import { mulberry32 } from './random.js';
import { buildWorld } from './world.js';
import { createInput, justPressed, endFrame } from './input.js';
import { createAudio } from './audio.js';
import { updatePlayer } from './player.js';
import { spawnTraffic, spawnPeds, updateTraffic, updatePeds } from './traffic.js';
import { updateWanted, updatePolice } from './police.js';
import { updateBullets } from './combat.js';
import { startMission, advanceDialog, updateMissions } from './missions.js';
import { render } from './render.js';
import { stageShot } from './shots.js';
import { saveGame, loadGame, clearSave } from './save.js';

const canvas = document.getElementById('game');
canvas.width = VIEW.w; canvas.height = VIEW.h;
const ctx = canvas.getContext('2d');

const params = new URLSearchParams(location.search);
const SEED = Number(params.get('seed') || 7);
const SHOT = params.get('shot') || '';

function freshState(seed) {
  const rng = mulberry32(seed);
  const G = {
    seed, rng, world: buildWorld(rng), input: createInput(canvas), audio: createAudio(),
    ctx, canvas, state: 'title', time: 0, timeOfDay: 0.25, frozen: false,
    player: {
      x: START.x, y: START.y, angle: -Math.PI / 2, walkAngle: 0, hp: TUNE.playerHp,
      money: START.money, ammo: START.ammo, inCar: null, fireCd: 0, punchCd: 0, hurtT: 0, moving: false,
    },
    cars: [], peds: [], bullets: [], particles: [], skids: [],
    wanted: { stars: 0, points: 0, quietT: 0 },
    pendingWanted: 0,
    missions: null, camera: { x: 0, y: 0, shake: 0 },
    stats: { kills: 0, stolen: 0, earned: 0, shots: 0, missionsDone: 0 },
    banner: null, shopNear: null, saveExists: false, muted: false,
  };
  G.reset = function resetGame() {
    const keep = { input: G.input, audio: G.audio, ctx: G.ctx, canvas: G.canvas };
    const fresh = freshState(seed);
    Object.assign(G, fresh, keep);
    G.reset = resetGame;
    G.camera.x = clampCam(G.player.x - VIEW.w / 2, 0, WORLD.w - VIEW.w);
    G.camera.y = clampCam(G.player.y - VIEW.h / 2, 0, WORLD.h - VIEW.h);
  };
  spawnTraffic(G); spawnPeds(G);
  G.camera.x = clampCam(G.player.x - VIEW.w / 2, 0, WORLD.w - VIEW.w);
  G.camera.y = clampCam(G.player.y - VIEW.h / 2, 0, WORLD.h - VIEW.h);
  return G;
}
function clampCam(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

const G = freshState(SEED);
G.saveExists = !!loadGame();

// One fixed step of live play (used by the loop and by the shot stager).
function stepPlaying(dt) {
  G.time += dt;
  G.timeOfDay = Math.min(0.98, G.timeOfDay + TUNE.timeRate * dt);
  if (G.banner) { G.banner.t -= dt; if (G.banner.t <= 0) G.banner = null; }
  updatePlayer(G, dt);
  updateTraffic(G, dt);
  updatePeds(G, dt);
  updateWanted(G, dt);
  updatePolice(G, dt);
  updateBullets(G, dt);
  updateMissions(G, dt);
  G.audio.music(dt);
}

function startStory() {
  const save = loadGame();
  G.audio.ensure(); G.audio.startMusic();
  if (save && save.mission >= 0 && save.mission < 7) {
    G.player.money = save.money; G.player.ammo = save.ammo; G.player.hp = save.hp;
    G.player.x = save.x; G.player.y = save.y; G.timeOfDay = save.timeOfDay ?? 0.25;
    G.stats.missionsDone = save.missionsDone || 0; G.stats.earned = save.earned || 0;
    startMission(G, save.mission);
  } else {
    startMission(G, 0);
  }
}

function respawn() {
  const p = G.player;
  p.hp = TUNE.playerHp; p.money = Math.floor(p.money * 0.8);
  p.x = 2400; p.y = 760; p.inCar = null; p.ammo = Math.max(p.ammo, 12);
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
  if (justPressed(input, 'm')) { G.muted = !G.muted; G.audio.setMuted(G.muted); }
  if (G.state === 'title') {
    if (justPressed(input, 'Enter')) startStory();
    return;
  }
  if (G.state === 'dialog') {
    if (justPressed(input, 'e', 'Enter') || input.mouseClicked) advanceDialog(G);
    return;
  }
  if (G.state === 'playing') {
    if (justPressed(input, 'p', 'Escape')) { G.state = 'paused'; return; }
    return;
  }
  if (G.state === 'paused') {
    if (justPressed(input, 'p', 'Escape')) G.state = 'playing';
    else if (justPressed(input, 'r')) restartStory();
    return;
  }
  if (G.state === 'wasted') {
    if (justPressed(input, 'r')) respawn();
    return;
  }
  if (G.state === 'complete') {
    if (justPressed(input, 'Enter')) { G.state = 'playing'; G.missions.objective = 'Free roam — Solmar Bay is yours.'; }
  }
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
  teleport(x, y) { G.player.x = x; G.player.y = y; if (G.player.inCar) { G.player.inCar.x = x; G.player.inCar.y = y; } },
  state() {
    return {
      state: G.state, x: Math.round(G.player.x), y: Math.round(G.player.y),
      hp: G.player.hp, money: G.player.money, ammo: G.player.ammo,
      inCar: !!G.player.inCar, wanted: G.wanted.stars, mission: G.missions ? G.missions.index : -1,
      stage: G.missions ? G.missions.stage : -1, objective: G.missions ? G.missions.objective : '',
      cars: G.cars.length, peds: G.peds.length, bullets: G.bullets.length,
      timeOfDay: G.timeOfDay,
    };
  },
};
