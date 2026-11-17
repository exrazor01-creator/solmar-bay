// Solmar Bay — tuning, palette and world layout. One clear job: constants only.
export const VIEW = { w: 1280, h: 800 };
export const WORLD = { w: 3200, h: 2400 };
export const STEP = 1 / 60;

// Road grid: avenues run north-south, streets east-west. Road centre lines.
export const AVENUES = [400, 800, 1200, 1600, 2000, 2400, 2800];
export const STREETS = [300, 700, 1100, 1500, 1900];
export const ROAD_W = 110;
export const BEACH_Y = 2150; // sand starts here; water at the very bottom

export const PALETTE = {
  grass: '#7fae5a', grassDry: '#a8b25e', sand: '#e8d39a', water: '#2e7f9e', waterDeep: '#1f5f7d',
  road: '#3a3f47', roadLine: '#e8d44d', sidewalk: '#b9b3a4', curb: '#8f887a',
  roofA: '#c96f4a', roofB: '#e0a458', roofC: '#5e8f7b', roofD: '#b0563e', roofE: '#d9c27a', roofF: '#7a6a9e',
  wall: '#e8dcc8', glass: '#9fd8e8', palm: '#4d8a4a', trunk: '#8a6b46',
  player: '#ffd23e', playerShirt: '#2e86de', cop: '#1c4ed8', copCar: '#1e40af',
  taxi: '#f7c948', sedan: '#c0392b', sport: '#8e44ad', truck: '#7f8c8d', van: '#16a085',
};

export const TUNE = {
  walkSpeed: 235, sprintMul: 1.45, playerRadius: 13, playerHp: 100,
  carAccel: 520, carBrake: 900, carMaxSpeed: 560, carReverseMax: 200, carTurn: 2.6,
  carRadius: 24, carHp: 100, bulletSpeed: 900, fireDelay: 0.22, punchDelay: 0.45,
  ammoStart: 48, ammoPrice: 40, ammoPack: 24, medPrice: 60, repairPrice: 100,
  wantedDecaySight: 8, wantedDecayRate: 4, copFootSpeed: 205, copPunchDmg: 8,
  trafficCount: 14, pedCount: 26, maxBullets: 64, maxParticles: 600,
  timeRate: 0.004, // time-of-day advance per second of play
};

export const START = { x: 860, y: 1180, money: 150, ammo: 48 };

// Key places (x, y) — garage, hospital, bank, shops, hideout.
export const PLACES = {
  garage: { x: 800, y: 1180, name: 'Garage Marla' },
  hospital: { x: 2400, y: 700, name: 'Solmar General' },
  bank: { x: 1600, y: 700, name: 'Solmar First Bank' },
  ammoShop: { x: 1200, y: 1500, name: 'Ammo & Health' },
  repairShop: { x: 2000, y: 1500, name: 'Pit Stop Repair' },
  hideout: { x: 400, y: 1900, name: 'Hideout — The Docks' },
  taxiStand: { x: 800, y: 1100, name: 'Taxi Stand' },
};

export const MISSION_REWARDS = [300, 400, 500, 600, 800, 900, 2500];
