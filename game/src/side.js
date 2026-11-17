import { PLACES, RACE_COURSE, TUNE, WORLD, BEACH_Z, WATER_Z } from './config.js';
import { dist, range, pick } from './random.js';
import { pointInBuilding, onRoad, nearestIntersection } from './world.js';
import { take } from './input.js';
export function initSide(G) {
  const packages = [];
  let guard = 0;
  while (packages.length < TUNE.packageCount && guard < 400) {
    guard += 1;
    const x = range(G.rng, 100, WORLD.w - 100), z = range(G.rng, 100, BEACH_Z - 60);
    if (pointInBuilding(G, x, z) || onRoad(x, z)) continue;
    if (packages.some((p) => dist(p.x, p.z, x, z) < 200)) continue;
    packages.push({ id: packages.length, x, z, got: false });
  }
  G.side = {
    packages,
    taxi: { active: false, stage: 0, timer: 0, marker: null, pickup: null, drop: null },
    race: { active: false, cp: 0, timer: 0, marker: null },
    delivery: { active: false, timer: 0, marker: null, drop: null },
  };
}
function randomRoadSpot(G) {
  const it = nearestIntersection(range(G.rng, 300, WORLD.w - 300), range(G.rng, 200, BEACH_Z - 200));
  return { x: it.x, z: it.z };
}
function startTaxiFare(G) {
  const t = G.side.taxi;
  const pickup = randomRoadSpot(G);
  let drop = randomRoadSpot(G);
  let guard = 0;
  while (dist(pickup.x, pickup.z, drop.x, drop.z) < 800 && guard < 20) { drop = randomRoadSpot(G); guard += 1; }
  t.active = true; t.stage = 0; t.timer = 0; t.pickup = pickup; t.drop = drop;
  t.marker = { x: pickup.x, z: pickup.z, label: 'Fare pickup' };
  const ped = { x: pickup.x + 20, z: pickup.z, angle: 0, speed: 0, state: 'walk', kind: 'passenger', hp: 100, tx: pickup.x, tz: pickup.z, waitT: 99, fleeT: 0, color: '#f39c12', seed: G.rng() };
  G.peds.push(ped); t.passenger = ped;
  G.banner = { text: 'Fare waiting — pick them up, then deliver them. $150 on the meter.', t: 3 };
}
function startRace(G) {
  const r = G.side.race;
  r.active = true; r.cp = 0; r.timer = 0;
  r.marker = { x: RACE_COURSE[0].x, z: RACE_COURSE[0].z, label: 'Checkpoint 1/4' };
  G.banner = { text: `Race! Four checkpoints — beat ${TUNE.racePar}s for $${TUNE.racePay}.`, t: 3 };
}
function startDelivery(G) {
  const d = G.side.delivery;
  let drop = randomRoadSpot(G);
  let guard = 0;
  while (dist(PLACES.depot.x, PLACES.depot.z, drop.x, drop.z) < 800 && guard < 20) { drop = randomRoadSpot(G); guard += 1; }
  d.active = true; d.timer = TUNE.deliveryTime; d.drop = drop;
  d.marker = { x: drop.x, z: drop.z, label: 'Delivery drop-off' };
  G.banner = { text: `Parcel in hand — deliver it across town in ${TUNE.deliveryTime}s for $${TUNE.deliveryPay}.`, t: 3 };
}
export function updateSide(G, dt) {
  const s = G.side;
  if (!s) return;
  const p = G.player, input = G.input;
  for (const pk of s.packages) {
    if (pk.got) continue;
    if (dist(p.x, p.z, pk.x, pk.z) < 34) {
      pk.got = true;
      p.money += TUNE.packagePay; G.stats.earned += TUNE.packagePay;
      G.audio.pickup(); G.audio.cash();
      const got = s.packages.filter((q) => q.got).length;
      G.banner = { text: `Hidden package found! +$${TUNE.packagePay} (${got}/${s.packages.length})`, t: 3 };
    }
  }
  if (!s.taxi.active && p.inCar && dist(p.x, p.z, PLACES.taxiStand.x, PLACES.taxiStand.z) < 80 && take(input, 't')) startTaxiFare(G);
  if (s.taxi.active) {
    const t = s.taxi;
    if (t.stage === 0) {
      if (dist(p.x, p.z, t.pickup.x, t.pickup.z) < 70) {
        t.stage = 1; t.timer = 90;
        const pas = t.passenger; if (pas) { const i = G.peds.indexOf(pas); if (i >= 0) G.peds.splice(i, 1); }
        t.marker = { x: t.drop.x, z: t.drop.z, label: 'Fare drop-off' };
        G.audio.pickup();
        G.banner = { text: 'Fare aboard! Deliver them before the meter runs out.', t: 2.5 };
      }
    } else {
      t.timer -= dt;
      if (dist(p.x, p.z, t.drop.x, t.drop.z) < 110) {
        t.active = false; t.marker = null;
        p.money += TUNE.taxiFarePay; G.stats.earned += TUNE.taxiFarePay;
        G.audio.cash();
        G.banner = { text: `Fare delivered! +$${TUNE.taxiFarePay}`, t: 3 };
      } else if (t.timer <= 0) {
        t.active = false; t.marker = null;
        G.banner = { text: 'The fare gave up waiting. The meter is dead.', t: 3 };
      }
    }
  }
  if (!s.race.active && p.inCar && dist(p.x, p.z, PLACES.raceStart.x, PLACES.raceStart.z) < 80 && take(input, 'r')) startRace(G);
  if (!s.delivery.active && p.inCar && dist(p.x, p.z, PLACES.depot.x, PLACES.depot.z) < 80 && take(input, 'y')) startDelivery(G);
  if (s.delivery.active) {
    const d = s.delivery;
    d.timer -= dt;
    if (dist(p.x, p.z, d.drop.x, d.drop.z) < 110) {
      d.active = false; d.marker = null;
      p.money += TUNE.deliveryPay; G.stats.earned += TUNE.deliveryPay;
      G.audio.cash();
      G.banner = { text: `Delivery complete! +$${TUNE.deliveryPay}`, t: 3 };
    } else if (d.timer <= 0) {
      d.active = false; d.marker = null;
      G.banner = { text: 'The parcel missed its window. The depot has more work when you are ready.', t: 3 };
    }
  }
  if (s.race.active) {
    const r = s.race;
    r.timer += dt;
    const target = RACE_COURSE[r.cp];
    if (dist(p.x, p.z, target.x, target.z) < 110) {
      r.cp += 1;
      G.audio.pickup();
      if (r.cp >= RACE_COURSE.length) {
        r.active = false; r.marker = null;
        if (r.timer <= TUNE.racePar) {
          p.money += TUNE.racePay; G.stats.earned += TUNE.racePay;
          G.audio.jingle(); G.audio.cash();
          G.banner = { text: `Race won in ${r.timer.toFixed(1)}s! +$${TUNE.racePay}`, t: 4 };
        } else {
          G.banner = { text: `Finished in ${r.timer.toFixed(1)}s — over the ${TUNE.racePar}s par. No payout, but the streets respect the run.`, t: 4 };
        }
      } else {
        r.marker = { x: RACE_COURSE[r.cp].x, z: RACE_COURSE[r.cp].z, label: `Checkpoint ${r.cp + 1}/4` };
      }
    }
  }
}
