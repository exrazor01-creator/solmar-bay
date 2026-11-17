export const VIEW = { w: 1280, h: 800 };
export const WORLD = { w: 3200, h: 2400 };
export const STEP = 1 / 60;
export const FLOOR_H = 34;
export const PLAYER_H = 36;
export const GUN_H = 22;
export const AVENUES = [400, 800, 1200, 1600, 2000, 2400, 2800];
export const STREETS = [300, 700, 1100, 1500, 1900];
export const ROAD_W = 110;
export const BEACH_Z = 2000;
export const WATER_Z = 2260;
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
  bus: '#27ae60', supercar: '#e84393', suv: '#6c5ce7',
};
export const CAR_STATS = {
  sedan: { max: 560, accel: 520, turn: 2.6, hp: 100, r: 24 },
  taxi: { max: 560, accel: 520, turn: 2.6, hp: 100, r: 24 },
  sport: { max: 680, accel: 640, turn: 3.0, hp: 90, r: 24 },
  supercar: { max: 780, accel: 760, turn: 3.2, hp: 80, r: 24 },
  suv: { max: 600, accel: 540, turn: 2.5, hp: 140, r: 26 },
  truck: { max: 430, accel: 380, turn: 2.0, hp: 180, r: 28 },
  van: { max: 480, accel: 440, turn: 2.2, hp: 120, r: 26 },
  bus: { max: 400, accel: 340, turn: 1.7, hp: 220, r: 30 },
  bike: { max: 640, accel: 720, turn: 3.4, hp: 60, r: 16 },
  police: { max: 600, accel: 560, turn: 2.8, hp: 120, r: 24 },
  heli: { max: 520, accel: 460, turn: 2.2, hp: 120, r: 26 },
  boat: { max: 480, accel: 420, turn: 2.4, hp: 110, r: 26 },
};
export const WEAPONS = {
  pistol: { name: 'PISTOL', dmg: 34, delay: 0.22, pellets: 1, spread: 0.05, range: 0.9, mag: 0 },
  shotgun: { name: 'SHOTGUN', dmg: 18, delay: 0.7, pellets: 6, spread: 0.38, range: 0.5, mag: 0 },
  rifle: { name: 'RIFLE', dmg: 22, delay: 0.11, pellets: 1, spread: 0.09, range: 1.0, mag: 30 },
  sniper: { name: 'SNIPER', dmg: 120, delay: 1.1, pellets: 1, spread: 0.01, range: 1.6, mag: 5 },
};
export const WEAPON_ORDER = ['pistol', 'shotgun', 'rifle', 'sniper'];
export const CHARS = {
  vic: { name: 'VIC', hp: 100, walk: 1.0, sprint: 1.45, shirt: '#2e86de', cap: '#ffd23e', skin: '#f1c27d' },
  luna: { name: 'LUNA', hp: 85, walk: 1.12, sprint: 1.58, shirt: '#e84393', cap: '#2d3436', skin: '#c68642' },
};
export const OUTFITS = [
  { name: 'Street', shirt: null, cap: null },
  { name: 'Night', shirt: '#2d3436', cap: '#6c5ce7' },
  { name: 'Beach', shirt: '#00b8a9', cap: '#fdcb6e' },
];
export const TUNE = {
  walkSpeed: 235, sprintMul: 1.45, playerRadius: 13, playerHp: 100,
  carAccel: 520, carBrake: 900, carMaxSpeed: 560, carReverseMax: 200, carTurn: 2.6,
  carRadius: 24, carHp: 100, bulletSpeed: 900, fireDelay: 0.22, punchDelay: 0.45,
  ammoStart: 48, ammoPrice: 40, ammoPack: 24, medPrice: 60, repairPrice: 100,
  shotgunPrice: 400, shellPrice: 60, shellPack: 8, armorPrice: 120, armorPack: 50, nitroPrice: 150,
  riflePrice: 600, sniperPrice: 900, batPrice: 150, batDmg: 50, punchDmg: 25,
  mealPrice: 30, snackPrice: 15, outfitPrice: 100, safehousePrice: 2000, safehouseIncome: 100,
  heliClimb: 55, heliMaxAlt: 120, boatWake: 1,
  wantedDecaySight: 8, wantedDecayRate: 4, copFootSpeed: 205, copPunchDmg: 8, swatPunchDmg: 14,
  trafficCount: 14, pedCount: 26, maxBullets: 64, maxParticles: 600,
  timeRate: 0.004,
  packageCount: 20, packagePay: 100, taxiFarePay: 150, racePay: 500, racePar: 80,
  deliveryPay: 250, deliveryTime: 90, stuntPay: 200, stuntAir: 0.8,
};
export const START = { x: 860, z: 1180, money: 150, ammo: 48 };
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
  airport: { x: 3010, z: 470, name: 'Solmar International' },
  mall: { x: 2200, z: 1680, name: 'Bayview Mall' },
  nightclub: { x: 1360, z: 430, name: 'Club Neon' },
  gas: { x: 2520, z: 1610, name: 'Fuel & Go' },
  policeStation: { x: 940, z: 420, name: 'Solmar PD HQ' },
  restaurant: { x: 1725, z: 1615, name: 'Diner 44' },
  clothing: { x: 2120, z: 410, name: 'Thread & Co' },
  depot: { x: 2750, z: 1850, name: 'Delivery Depot' },
};
export const MISSION_REWARDS = [300, 400, 500, 600, 800, 900, 2500, 800, 900, 1200, 1500, 4000,
  1000, 1200, 1500, 1400, 1100, 1600, 1800, 2000, 2200, 6000];
export const MISSION_COUNT = 22;
export const RACE_COURSE = [
  { x: 2400, z: 1900 }, { x: 2400, z: 300 }, { x: 800, z: 300 }, { x: 800, z: 1900 },
];
export const RAMPS = [
  { x: 2000, z: 300, angle: 0, name: 'Airport Jump' },
  { x: 400, z: 300, angle: 0, name: 'Old Town Jump' },
];
