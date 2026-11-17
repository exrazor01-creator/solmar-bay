// Solmar Bay — tuning, palette and world layout. One clear job: constants only.
// The game plays on the ground plane (x, z); y is UP. All distances are in world
// units: a person is ~36 tall, a building floor ~34, a car ~52 long.
export const VIEW = { w: 1280, h: 800 };
export const WORLD = { w: 3200, h: 2400 };
export const STEP = 1 / 60;
export const FLOOR_H = 34; // one building floor, in height units
export const PLAYER_H = 36;
export const GUN_H = 22; // height bullets leave the player at

// Road grid: avenues run north-south, streets east-west. Road centre lines.
export const AVENUES = [400, 800, 1200, 1600, 2000, 2400, 2800];
export const STREETS = [300, 700, 1100, 1500, 1900];
export const ROAD_W = 110;
export const BEACH_Z = 2000; // sand starts here; water at WATER_Z
export const WATER_Z = 2260; // the sea: boats sail between here and the bottom edge

// Chase camera: distance behind the player and height above, by situation.
export const CAM = {
  foot: { dist: 170, height: 105, look: 30 },
  car: { dist: 235, height: 135, look: 34 },
  heli: { dist: 300, height: 200, look: 40 },
  boat: { dist: 235, height: 135, look: 34 },
};

export const PALETTE = {
  grass: '#7fae5a', grassDry: '#a8b25e', sand: '#e8d39a', water: '#2e7f9e', waterDeep: '#1f5f7d',
  road: '#3a3f47', roadLine: '#e8d44d', sidewalk: '#b9b3a4', curb: '#8f887a',
  roofA: '#c96f4a', roofB: '#e0a458', roofC: '#5e8f7b', roofD: '#b0563e', roofE: '#d9c27a', roofF: '#7a6a9e',
  wall: '#e8dcc8', glass: '#9fd8e8', palm: '#4d8a4a', trunk: '#8a6b46',
  player: '#ffd23e', playerShirt: '#2e86de', cop: '#1c4ed8', copCar: '#1e40af',
  taxi: '#f7c948', sedan: '#c0392b', sport: '#8e44ad', truck: '#7f8c8d', van: '#16a085',
  heli: '#e67e22', boat: '#ecf0f1', warehouse: '#95a5a6', tower: '#2c3e50',
};

// Per-vehicle tuning: top speed, acceleration, turn rate, hit points, body radius.
export const CAR_STATS = {
  sedan: { max: 560, accel: 520, turn: 2.6, hp: 100, r: 24 },
  taxi: { max: 560, accel: 520, turn: 2.6, hp: 100, r: 24 },
  sport: { max: 680, accel: 640, turn: 3.0, hp: 90, r: 24 },
  truck: { max: 430, accel: 380, turn: 2.0, hp: 180, r: 28 },
  van: { max: 480, accel: 440, turn: 2.2, hp: 120, r: 26 },
  bike: { max: 640, accel: 720, turn: 3.4, hp: 60, r: 16 },
  police: { max: 600, accel: 560, turn: 2.8, hp: 120, r: 24 },
  heli: { max: 520, accel: 460, turn: 2.2, hp: 120, r: 26 },
  boat: { max: 480, accel: 420, turn: 2.4, hp: 110, r: 26 },
};

// Weapons: pistol (starting) and shotgun (bought at the ammo shop).
export const WEAPONS = {
  pistol: { name: 'PISTOL', dmg: 34, delay: 0.22, pellets: 1, spread: 0.05, range: 0.9 },
  shotgun: { name: 'SHOTGUN', dmg: 18, delay: 0.7, pellets: 6, spread: 0.38, range: 0.5 },
};

export const TUNE = {
  walkSpeed: 235, sprintMul: 1.45, playerRadius: 13, playerHp: 100,
  carAccel: 520, carBrake: 900, carMaxSpeed: 560, carReverseMax: 200, carTurn: 2.6,
  carRadius: 24, carHp: 100, bulletSpeed: 900, fireDelay: 0.22, punchDelay: 0.45,
  ammoStart: 48, ammoPrice: 40, ammoPack: 24, medPrice: 60, repairPrice: 100,
  shotgunPrice: 400, shellPrice: 60, shellPack: 8, armorPrice: 120, armorPack: 50, nitroPrice: 150,
  heliClimb: 55, heliMaxAlt: 120, boatWake: 1,
  wantedDecaySight: 8, wantedDecayRate: 4, copFootSpeed: 205, copPunchDmg: 8,
  trafficCount: 14, pedCount: 26, maxBullets: 64, maxParticles: 600,
  timeRate: 0.004, // time-of-day advance per second of play
  packageCount: 10, packagePay: 100, taxiFarePay: 150, racePay: 500, racePar: 80,
};

export const START = { x: 860, z: 1180, money: 150, ammo: 48 };

// Key places (x, z) — garage, hospital, bank, shops, hideout, helipad, marina, tower.
export const PLACES = {
  garage: { x: 800, z: 1180, name: 'Garage Marla' },
  hospital: { x: 2400, z: 700, name: 'Solmar General' },
  bank: { x: 1600, z: 700, name: 'Solmar First Bank' },
  ammoShop: { x: 1200, z: 1500, name: 'Ammo & Health' },
  repairShop: { x: 2000, z: 1500, name: 'Pit Stop Repair' },
  hideout: { x: 400, z: 1900, name: 'Hideout — The Docks' },
  taxiStand: { x: 800, z: 1100, name: 'Taxi Stand' },
  helipad: { x: 2800, z: 300, name: 'Helipad' },
  marina: { x: 400, z: 2290, name: 'Marina' },
  tower: { x: 1800, z: 1300, name: 'Solmar Tower' },
  raceStart: { x: 800, z: 1900, name: 'Race Start' },
  lighthouse: { x: 3050, z: 2100, name: 'Lighthouse' },
  harbor: { x: 2800, z: 1700, name: 'Harbor' },
  hotel: { x: 2400, z: 300, name: 'Hotel Solmar' },
};

export const MISSION_REWARDS = [300, 400, 500, 600, 800, 900, 2500, 800, 900, 1200, 1500, 4000];
export const MISSION_COUNT = 12;

// The street-race course: start, then these checkpoints in order, then back to start.
export const RACE_COURSE = [
  { x: 2400, z: 1900 }, { x: 2400, z: 300 }, { x: 800, z: 300 }, { x: 800, z: 1900 },
];
