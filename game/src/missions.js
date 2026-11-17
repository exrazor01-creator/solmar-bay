import { PLACES, MISSION_REWARDS, RACE_COURSE, GUN_H } from './config.js';
import { dist, clamp, angleDiff } from './random.js';
import { spawnCar } from './traffic.js';
import { spawnHeli, spawnBoat } from './vehicles.js';
import { addWanted } from './police.js';
import { spawnBullet } from './combat.js';
import { saveGame } from './save.js';
const D = (who, text) => ({ who, text });
export const MISSIONS = [
  {
    title: 'First Wheels', giver: 'Marla',
    intro: [D('Marla', 'Kid, you walk everywhere in this town. That ends today.'), D('Marla', 'Steal any car — E to get in — and bring it to my garage. No questions.'), D('You', 'Steal a car. Got it. What could go wrong?')],
    setup(G) { G.missions.marker = { x: PLACES.garage.x, z: PLACES.garage.z, label: 'Garage Marla' }; G.missions.objective = 'Steal a car (E) — bring it to the garage'; },
    update(G) {
      const m = G.missions;
      if (m.stage === 0 && G.player.inCar) { m.stage = 1; m.objective = 'Drive the car to the garage'; }
      else if (m.stage === 1 && dist(G.player.x, G.player.z, PLACES.garage.x, PLACES.garage.z) < 120) completeMission(G);
    },
  },
  {
    title: 'Cab Fare', giver: 'Marla',
    intro: [D('Marla', 'A fare waits at the taxi stand. Pick them up, drop them off. Easy money.'), D('Marla', 'You will need a car. Any car. Do not ask whose.'), D('You', 'One cab ride, coming up.')],
    setup(G) {
      G.missions.marker = { x: PLACES.taxiStand.x, z: PLACES.taxiStand.z, label: 'Taxi Stand' };
      G.missions.objective = 'Get a car, pick up the fare at the taxi stand';
      const ped = { x: PLACES.taxiStand.x + 30, z: PLACES.taxiStand.z, angle: 0, speed: 0, state: 'walk', kind: 'passenger', hp: 100, tx: PLACES.taxiStand.x, tz: PLACES.taxiStand.z, waitT: 99, fleeT: 0, color: '#f39c12', seed: G.rng() };
      G.peds.push(ped); G.missions.data.passenger = ped;
    },
    update(G, dt) {
      const m = G.missions, p = G.player;
      if (m.stage === 0 && p.inCar && dist(p.x, p.z, PLACES.taxiStand.x, PLACES.taxiStand.z) < 70) {
        m.stage = 1; m.timer = 75; m.objective = 'Fare aboard! Reach the hotel before time runs out';
        const pas = m.data.passenger; if (pas) { const i = G.peds.indexOf(pas); if (i >= 0) G.peds.splice(i, 1); }
        G.missions.marker = { x: 2400, z: 300, label: 'Hotel Solmar' };
        G.audio.pickup();
      } else if (m.stage === 1) {
        m.timer -= dt;
        if (dist(p.x, p.z, 2400, 300) < 130) completeMission(G);
        else if (m.timer <= 0) failMission(G, 'The fare got out and walked. Try again — the stand is waiting.');
      }
    },
  },
  {
    title: 'Hot Package', giver: 'Dante',
    intro: [D('Dante', 'A package. Small. Valuable. Nobody saw you take it.'), D('Dante', 'Grab it at the docks and run it across town. Ninety seconds. Do not stop.'), D('You', 'Ninety seconds across Solmar Bay? I drive fast.')],
    setup(G) {
      G.missions.marker = { x: 400, z: 1900, label: 'The Docks' };
      G.missions.objective = 'Pick up the package at the docks';
    },
    update(G, dt) {
      const m = G.missions, p = G.player;
      if (m.stage === 0 && dist(p.x, p.z, 400, 1900) < 90) {
        m.stage = 1; m.timer = 90; m.objective = 'Package in hand! Deliver it to the east pier';
        G.missions.marker = { x: 2800, z: 1900, label: 'East Pier' };
        G.audio.pickup();
      } else if (m.stage === 1) {
        m.timer -= dt;
        if (dist(p.x, p.z, 2800, 1900) < 110) completeMission(G);
        else if (m.timer <= 0) failMission(G, 'Too slow — the buyer walked. The package is back at the docks.');
      }
    },
  },
  {
    title: 'Heat Run', giver: 'Marla',
    intro: [D('Marla', 'The cops are all over you. Three stars, kid. That is not a compliment.'), D('Marla', 'Lay low. Break line of sight. When the heat drops to nothing, come see me.'), D('You', 'Lose three stars. In this town? Challenge accepted.')],
    setup(G) {
      addWanted(G, 6, 'The whole force is looking for you');
      G.missions.objective = 'Lose the wanted level — stay out of sight';
      G.missions.marker = null;
    },
    update(G) { if (G.wanted.stars === 0) completeMission(G); },
  },
  {
    title: 'Repo Man', giver: 'Dante',
    intro: [D('Dante', 'A violet sports car in the lot on 5th. Mine. Guarded. Take it anyway.'), D('Dante', 'The guards are armed. So are you. Bring the car to the garage.'), D('You', 'Armed guards, one violet car. Sounds fair.')],
    setup(G) {
      const car = spawnCar(G, 2000, 1100, 'sport', 'parked');
      car.color = '#8e44ad'; car.repo = true; G.missions.data.repoCar = car;
      for (const [gx, gz] of [[1940, 1060], [2060, 1140]]) {
        G.peds.push({ x: gx, z: gz, angle: 0, speed: 0, state: 'walk', kind: 'guard', hp: 100, tx: gx, tz: gz, waitT: 99, fleeT: 0, color: '#2c3e50', seed: G.rng(), shootCd: 1 });
      }
      G.missions.marker = { x: 2000, z: 1100, label: 'The Violet Car' };
      G.missions.objective = 'Steal the violet sports car from the lot';
    },
    update(G, dt) {
      const m = G.missions, p = G.player;
      guardFire(G, dt);
      if (m.stage === 0 && p.inCar === m.data.repoCar) { m.stage = 1; m.objective = 'Got it! Bring it to the garage'; G.missions.marker = { x: PLACES.garage.x, z: PLACES.garage.z, label: 'Garage Marla' }; }
      else if (m.stage === 1 && dist(p.x, p.z, PLACES.garage.x, PLACES.garage.z) < 120) completeMission(G);
    },
  },
  {
    title: 'The Distraction', giver: 'Marla',
    intro: [D('Marla', 'Dante needs the cops busy on the other side of town. That is your job.'), D('Marla', 'Get to three stars any way you like, then slip away to the hideout.'), D('You', 'Cause a scene, then vanish. My specialty.')],
    setup(G) {
      G.missions.objective = 'Cause trouble to 3 stars, then reach the hideout';
      G.missions.marker = { x: PLACES.hideout.x, z: PLACES.hideout.z, label: 'Hideout' };
    },
    update(G) {
      const m = G.missions;
      if (m.stage === 0 && G.wanted.stars >= 3) { m.stage = 1; m.objective = 'Three stars! Slip away to the hideout'; }
      else if (m.stage === 1 && dist(G.player.x, G.player.z, PLACES.hideout.x, PLACES.hideout.z) < 130) completeMission(G);
    },
  },
  {
    title: 'The Big Score', giver: 'Dante',
    intro: [D('Dante', 'Solmar First Bank. One vault. One night. Rich or we do not walk out.'), D('Dante', 'Get inside, hold E at the vault, then lose four stars at the hideout.'), D('You', 'The big score. Let us make Solmar Bay remember my name.')],
    setup(G) {
      G.missions.marker = { x: PLACES.bank.x, z: PLACES.bank.z, label: 'Solmar First Bank' };
      G.missions.objective = 'Get to the bank';
    },
    update(G, dt) {
      const m = G.missions, p = G.player;
      if (m.stage === 0 && dist(p.x, p.z, PLACES.bank.x, PLACES.bank.z) < 110) {
        m.stage = 1; m.progress = 0; m.objective = 'Hold E at the vault';
      } else if (m.stage === 1) {
        const near = dist(p.x, p.z, PLACES.bank.x, PLACES.bank.z) < 110;
        if (near && G.input.keys.has('e')) {
          m.progress += dt / 4;
          if (m.progress >= 1) {
            m.stage = 2; addWanted(G, 8, 'BANK ROBBERY — every cop in Solmar Bay is coming');
            m.objective = 'Cash grabbed! Escape to the hideout';
            G.missions.marker = { x: PLACES.hideout.x, z: PLACES.hideout.z, label: 'Hideout' };
            G.audio.cash();
          }
        } else m.progress = Math.max(0, m.progress - dt / 2);
      } else if (m.stage === 2 && dist(p.x, p.z, PLACES.hideout.x, PLACES.hideout.z) < 130) {
        completeMission(G);
      }
    },
  },
  {
    title: 'The Getaway', giver: 'Marla',
    intro: [D('Marla', 'The cops sealed the roads, kid. So we take the water.'), D('Marla', 'A boat waits at the marina. Sail her east to the far pier. Fast and quiet.'), D('You', 'A boat chase. Finally, a commute with a view.')],
    setup(G) {
      spawnBoat(G, 400, 2290, 'parked');
      spawnBoat(G, 500, 2300, 'parked');
      G.missions.marker = { x: PLACES.marina.x, z: PLACES.marina.z, label: 'Marina' };
      G.missions.objective = 'Get to the marina, board a boat (E)';
    },
    update(G) {
      const m = G.missions, p = G.player;
      if (m.stage === 0 && dist(p.x, p.z, PLACES.marina.x, PLACES.marina.z) < 120) {
        m.stage = 1; m.objective = 'Sail east to the far pier';
        G.missions.marker = { x: 2800, z: 2330, label: 'Far Pier' };
      } else if (m.stage === 1 && p.inCar && p.inCar.kind === 'boat' && dist(p.x, p.z, 2800, 2330) < 130) {
        completeMission(G);
      }
    },
  },
  {
    title: 'Taxi King', giver: 'Marla',
    intro: [D('Marla', 'Three fares, one shift, no excuses. The whole town is watching the meter.'), D('Marla', 'Pick them up in order: stand, hotel, docks. Do not keep anyone waiting.'), D('You', 'Three fares. One legend. Let us go.')],
    setup(G) {
      G.missions.data.legs = [
        { from: PLACES.taxiStand, to: PLACES.hotel, time: 60 },
        { from: PLACES.hotel, to: PLACES.hideout, time: 75 },
        { from: PLACES.hideout, to: PLACES.bank, time: 75 },
      ];
      G.missions.data.leg = 0;
      const leg = G.missions.data.legs[0];
      G.missions.marker = { x: leg.from.x, z: leg.from.z, label: 'Fare 1 — Taxi Stand' };
      G.missions.objective = 'Get a car, pick up fare 1 at the taxi stand';
    },
    update(G, dt) {
      const m = G.missions, p = G.player;
      const legs = m.data.legs, leg = legs[m.data.leg];
      if (m.stage === 0 && p.inCar && dist(p.x, p.z, leg.from.x, leg.from.z) < 70) {
        m.stage = 1; m.timer = leg.time;
        m.objective = `Fare ${m.data.leg + 1} aboard! Deliver to ${leg.to.name} (${leg.time}s)`;
        G.missions.marker = { x: leg.to.x, z: leg.to.z, label: leg.to.name };
        G.audio.pickup();
      } else if (m.stage === 1) {
        m.timer -= dt;
        if (dist(p.x, p.z, leg.to.x, leg.to.z) < 130) {
          m.data.leg += 1;
          if (m.data.leg >= legs.length) { completeMission(G); return; }
          m.stage = 0;
          const next = legs[m.data.leg];
          G.missions.marker = { x: next.from.x, z: next.from.z, label: `Fare ${m.data.leg + 1}` };
          m.objective = `Fare ${m.data.leg + 1} waiting at ${next.from.name} — pick them up`;
          G.audio.cash();
        } else if (m.timer <= 0) failMission(G, 'The fare walked out. The meter is dead — start the shift over.');
      }
    },
  },
  {
    title: 'High Rise', giver: 'Dante',
    intro: [D('Dante', 'A package sits on the roof of Solmar Tower. The only way up is by air.'), D('Dante', 'Take the heli. Hover over the roof until the package is yours, then bring it home.'), D('You', 'A helicopter, a rooftop, a payday. Up we go.')],
    setup(G) {
      spawnHeli(G, 2800, 300, 'parked');
      G.missions.marker = { x: PLACES.helipad.x, z: PLACES.helipad.z, label: 'Helipad' };
      G.missions.objective = 'Get to the helipad, take the helicopter (E)';
    },
    update(G, dt) {
      const m = G.missions, p = G.player;
      if (m.stage === 0 && p.inCar && p.inCar.kind === 'heli') {
        m.stage = 1; m.objective = 'Fly to Solmar Tower — hover over the roof';
        G.missions.marker = { x: PLACES.tower.x, z: PLACES.tower.z, label: 'Solmar Tower Roof' };
      } else if (m.stage === 1 && p.inCar && p.inCar.kind === 'heli') {
        const heli = p.inCar;
        if (heli.y > 40 && dist(p.x, p.z, PLACES.tower.x, PLACES.tower.z) < 80) {
          m.progress += dt / 2;
          m.objective = 'Hold the hover… package loading';
          if (m.progress >= 1) {
            m.stage = 2; m.progress = 0; m.objective = 'Package secured! Land at the helipad';
            G.missions.marker = { x: PLACES.helipad.x, z: PLACES.helipad.z, label: 'Helipad' };
            G.audio.pickup();
          }
        } else m.progress = Math.max(0, m.progress - dt / 2);
      } else if (m.stage === 2 && p.inCar && p.inCar.kind === 'heli' && p.inCar.y <= 0 && dist(p.x, p.z, PLACES.helipad.x, PLACES.helipad.z) < 100) {
        completeMission(G);
      }
    },
  },
  {
    title: 'Street Kings', giver: 'Dante',
    intro: [D('Dante', 'The street racers own the night. Tonight, you take their crown.'), D('Dante', 'Race start. Beat both rivals through four checkpoints. First across the line takes the pot.'), D('You', 'Two rivals, four checkpoints, one winner. That is me.')],
    setup(G) {
      G.missions.marker = { x: PLACES.raceStart.x, z: PLACES.raceStart.z, label: 'Race Start' };
      G.missions.objective = 'Get in a car at the race start';
      G.missions.data.racers = [];
      for (const [rx, rz, col] of [[760, 1850, '#e74c3c'], [840, 1850, '#f39c12']]) {
        const c = spawnCar(G, rx, rz, 'sport', 'racer');
        c.color = col; c.speed = 0; c.cp = 0; c.angle = Math.PI / 2;
        G.missions.data.racers.push(c);
      }
    },
    update(G, dt) {
      const m = G.missions, p = G.player;
      if (m.stage === 0 && p.inCar && dist(p.x, p.z, PLACES.raceStart.x, PLACES.raceStart.z) < 80) {
        m.stage = 1; m.data.cp = 0; m.objective = 'Race! Hit the checkpoints — beat both rivals';
        G.missions.marker = { x: RACE_COURSE[0].x, z: RACE_COURSE[0].z, label: 'Checkpoint 1/4' };
        G.audio.jingle();
      } else if (m.stage === 1) {
        for (const r of m.data.racers) {
          if (r.dead) continue;
          const target = RACE_COURSE[Math.min(r.cp, RACE_COURSE.length - 1)];
          const want = Math.atan2(target.z - r.z, target.x - r.x);
          r.angle += clamp(angleDiff(r.angle, want), -2.0 * dt, 2.0 * dt);
          r.speed = clamp(r.speed + 300 * dt, 0, 430);
          r.x += Math.cos(r.angle) * r.speed * dt;
          r.z += Math.sin(r.angle) * r.speed * dt;
          if (dist(r.x, r.z, target.x, target.z) < 90) r.cp += 1;
        }
        const cp = m.data.cp;
        const target = RACE_COURSE[cp];
        if (dist(p.x, p.z, target.x, target.z) < 110) {
          m.data.cp = cp + 1;
          G.audio.pickup();
          if (m.data.cp >= RACE_COURSE.length) {
            const rivalsDone = m.data.racers.filter((r) => r.cp >= RACE_COURSE.length).length;
            if (rivalsDone === 0) completeMission(G);
            else failMission(G, 'A rival crossed the line first. The crown stays with the streets — for now.');
            return;
          }
          G.missions.marker = { x: RACE_COURSE[m.data.cp].x, z: RACE_COURSE[m.data.cp].z, label: `Checkpoint ${m.data.cp + 1}/4` };
          m.objective = `Checkpoint ${m.data.cp + 1}/4 — keep the lead`;
        }
      }
    },
  },
  {
    title: 'The Last Score', giver: 'Dante',
    intro: [D('Dante', 'One more vault. Bigger. Five stars, roadblocks, a helicopter in the sky.'), D('Dante', 'Crack the vault and run the gauntlet to the hideout. Pull this off and the bay is ours.'), D('You', 'The last score. Everything on the line. Let us finish this.')],
    setup(G) {
      G.missions.marker = { x: PLACES.bank.x, z: PLACES.bank.z, label: 'Solmar First Bank' };
      G.missions.objective = 'Get to the bank, one last time';
    },
    update(G, dt) {
      const m = G.missions, p = G.player;
      if (m.stage === 0 && dist(p.x, p.z, PLACES.bank.x, PLACES.bank.z) < 110) {
        m.stage = 1; m.progress = 0; m.objective = 'Hold E at the vault (5s)';
      } else if (m.stage === 1) {
        const near = dist(p.x, p.z, PLACES.bank.x, PLACES.bank.z) < 110;
        if (near && G.input.keys.has('e')) {
          m.progress += dt / 5;
          if (m.progress >= 1) {
            m.stage = 2; addWanted(G, 10, 'THE LAST SCORE — five stars, roadblocks, the chopper is up');
            m.objective = 'Five stars! Run to the hideout';
            G.missions.marker = { x: PLACES.hideout.x, z: PLACES.hideout.z, label: 'Hideout' };
            G.audio.cash();
          }
        } else m.progress = Math.max(0, m.progress - dt / 2);
      } else if (m.stage === 2 && dist(p.x, p.z, PLACES.hideout.x, PLACES.hideout.z) < 130) {
        completeMission(G);
      }
    },
  },
  {
    title: 'The Drop', giver: 'Dante',
    intro: [D('Dante', 'A courier job. Quiet money. Docks, then hotel — seventy-five seconds.')],
    steps: [
      { k: 'go', x: 400, z: 1900, label: 'The Docks', obj: 'Pick up the drop at the docks' },
      { k: 'timed', x: 2400, z: 300, t: 75, label: 'Hotel Solmar', obj: 'Deliver to the hotel — 75s!', fail: 'Too slow — the buyer walked.' },
    ],
  },
  {
    title: 'Hot Wheels', giver: 'Marla',
    intro: [D('Marla', 'A pink supercar sits in the mall lot. Two guards. It is not theirs anymore.')],
    steps: [
      { k: 'go', x: 2200, z: 1680, label: 'Bayview Mall', obj: 'Get to the mall lot' },
      { k: 'kill', guards: [[2140, 1640], [2260, 1720]], label: 'Mall Guards', obj: 'Take out the two guards' },
      { k: 'enter', veh: { kind: 'supercar', x: 2200, z: 1680, color: '#e84393' }, label: 'Pink Supercar', obj: 'Steal the pink supercar (E)' },
      { k: 'car', x: 800, z: 1180, label: 'Garage Marla', obj: 'Bring it to the garage' },
    ],
  },
  {
    title: 'Sky Hook', giver: 'Dante',
    intro: [D('Dante', 'Cargo comes in by air. Meet it at the airport, then bring the heli home.')],
    steps: [
      { k: 'go', x: 2800, z: 300, label: 'Helipad', obj: 'Get to the helipad and take the helicopter' },
      { k: 'heli', x: 3010, z: 470, alt: 40, label: 'Solmar International', obj: 'Fly to the airport — stay above the roofs' },
      { k: 'land', x: 2800, z: 300, label: 'Helipad', obj: 'Land back at the helipad' },
    ],
  },
  {
    title: "Sniper's Perch", giver: 'Dante',
    intro: [D('Dante', 'Three harbor crew need to stop working tonight. Here is a rifle — make it count.')],
    steps: [
      { k: 'kill', guards: [[2740, 1660], [2860, 1740], [2800, 1600]], give: 'sniper', label: 'Harbor Crew', obj: 'Take out the three harbor guards (sniper provided)' },
      { k: 'go', x: 400, z: 1900, label: 'Hideout', obj: 'Slip away to the hideout' },
    ],
  },
  {
    title: 'The Bus Job', giver: 'Marla',
    intro: [D('Marla', 'The city bus is at the depot. Big, slow, and worth more than it looks.')],
    steps: [
      { k: 'enter', veh: { kind: 'bus', x: 2750, z: 1850, color: '#27ae60' }, label: 'City Bus', obj: 'Steal the city bus at the depot (E)' },
      { k: 'car', x: 800, z: 1180, label: 'Garage Marla', obj: 'Drive the bus to the garage' },
    ],
  },
  {
    title: 'Storm Run', giver: 'Dante',
    intro: [D('Dante', 'Rain is coming. The lighthouse keeper waits, and he does not wait long.')],
    steps: [
      { k: 'go', x: 400, z: 1900, label: 'The Docks', obj: 'Pick up the storm parcel at the docks' },
      { k: 'timed', x: 3050, z: 2100, t: 100, label: 'Lighthouse', obj: 'Deliver to the lighthouse — 100s!', fail: 'The keeper gave up. The parcel is back at the docks.' },
    ],
  },
  {
    title: 'Club Neon', giver: 'Luna',
    intro: [D('Luna', 'Club Neon, midnight. Stir up the cops, then vanish before they see your face.')],
    steps: [
      { k: 'go', x: 1360, z: 430, label: 'Club Neon', obj: 'Get to Club Neon' },
      { k: 'wanted', n: 2, label: 'Heat', obj: 'Cause trouble — hit 2 stars' },
      { k: 'calm', label: 'Hideout', obj: 'Lose the heat, then reach the hideout' },
      { k: 'go', x: 400, z: 1900, label: 'Hideout', obj: 'Reach the hideout' },
    ],
  },
  {
    title: 'The Airport Run', giver: 'Dante',
    intro: [D('Dante', 'Cargo lands at the terminal. Load it at the doors, then run it to the harbor.')],
    steps: [
      { k: 'go', x: 3010, z: 470, label: 'Solmar International', obj: 'Get to the airport terminal' },
      { k: 'hold', x: 3010, z: 470, s: 4, label: 'Terminal Doors', obj: 'Hold E at the terminal doors to load the cargo' },
      { k: 'timed', x: 2800, z: 1700, t: 90, label: 'Harbor', obj: 'Deliver to the harbor — 90s!', fail: 'The cargo missed its boat.' },
    ],
  },
  {
    title: 'Gang War', giver: 'Dante',
    intro: [D('Dante', 'The dock gang moved on our turf. Five of them. End it, then come home.')],
    steps: [
      { k: 'kill', guards: [[360, 1860], [440, 1940], [400, 1820], [340, 1960], [460, 1880]], label: 'Dock Gang', obj: 'Take out the five dock gang members' },
      { k: 'go', x: 400, z: 1900, label: 'Hideout', obj: 'Get back to the hideout' },
    ],
  },
  {
    title: 'The Crown', giver: 'Dante', finale: true,
    intro: [D('Dante', 'The bank again. Bigger vault, six stars, SWAT on the ground. The crown, kid.'), D('Dante', 'Crack it, then run. If we walk out of this, Solmar Bay is ours — all of it.')],
    steps: [
      { k: 'go', x: 1600, z: 700, label: 'Solmar First Bank', obj: 'Get to the bank — one last crown' },
      { k: 'hold', x: 1600, z: 700, s: 6, add: 12, why: 'THE CROWN — six stars, SWAT is coming', label: 'The Vault', obj: 'Hold E at the vault to crack it (6s)' },
      { k: 'go', x: 400, z: 1900, label: 'Hideout', obj: 'Six stars! Run the gauntlet to the hideout' },
    ],
  },
];
function guardFire(G, dt) {
  for (const g of G.peds) {
    if (g.kind !== 'guard' || g.state === 'dead') continue;
    g.shootCd = Math.max(0, (g.shootCd || 0) - dt);
    const d = dist(g.x, g.z, G.player.x, G.player.z);
    if (d < 340 && g.shootCd <= 0 && G.state === 'playing') {
      g.shootCd = 1.1;
      const a = Math.atan2(G.player.z - g.z, G.player.x - g.x) + (G.rng() - 0.5) * 0.2;
      spawnBullet(G, g.x, GUN_H, g.z, a, 'enemy', 20);
      G.audio.shoot();
    }
  }
}
function spawnGuard(G, x, z) {
  const g = { x, z, angle: 0, speed: 0, state: 'walk', kind: 'guard', hp: 100, tx: x, tz: z, waitT: 99, fleeT: 0, color: '#2c3e50', seed: G.rng(), shootCd: 1 };
  G.peds.push(g);
  return g;
}
export function dslSetup(G) {
  const m = G.missions;
  m.step = 0; m.stepInit = -1; m.data = {};
}
function dslUpdate(G, dt) {
  const m = G.missions, def = m.def, steps = def.steps;
  if (m.step >= steps.length) { completeMission(G, def.finale); return; }
  const s = steps[m.step], p = G.player;
  guardFire(G, dt);
  if (m.stepInit !== m.step) {
    m.stepInit = m.step; m.timer = s.t || 0; m.progress = 0;
    if (s.guards) m.data.guards = s.guards.map(([gx, gz]) => spawnGuard(G, gx, gz));
    if (s.veh) {
      const c = spawnCar(G, s.veh.x, s.veh.z, s.veh.kind, 'parked');
      if (s.veh.color) c.color = s.veh.color;
      m.data.veh = c;
    }
    if (s.give === 'sniper' && !p.ownsSniper) { p.ownsSniper = true; p.sniperMag = 5; G.banner = { text: 'Sniper rifle provided — 5 rounds. Make them count.', t: 3 }; }
    G.missions.marker = s.x !== undefined ? { x: s.x, z: s.z, label: s.label } : null;
    G.missions.objective = s.obj;
  }
  let done = false;
  if (s.k === 'go') done = dist(p.x, p.z, s.x, s.z) < 110;
  else if (s.k === 'car') done = !!p.inCar && dist(p.x, p.z, s.x, s.z) < 120;
  else if (s.k === 'timed') {
    m.timer -= dt;
    done = dist(p.x, p.z, s.x, s.z) < 120;
    if (!done && m.timer <= 0) { failMission(G, s.fail || 'Too slow.'); return; }
  } else if (s.k === 'hold') {
    const near = dist(p.x, p.z, s.x, s.z) < 110;
    if (near && G.input.keys.has('e')) {
      m.progress += dt / s.s;
      if (m.progress >= 1) done = true;
    } else m.progress = Math.max(0, m.progress - dt / 2);
  } else if (s.k === 'wanted') done = G.wanted.stars >= s.n;
  else if (s.k === 'calm') done = G.wanted.stars === 0;
  else if (s.k === 'boat') done = !!p.inCar && p.inCar.kind === 'boat' && dist(p.x, p.z, s.x, s.z) < 130;
  else if (s.k === 'heli') done = !!p.inCar && p.inCar.kind === 'heli' && p.inCar.y > (s.alt || 40) && dist(p.x, p.z, s.x, s.z) < 90;
  else if (s.k === 'land') done = !!p.inCar && p.inCar.kind === 'heli' && p.inCar.y <= 0 && dist(p.x, p.z, s.x, s.z) < 100;
  else if (s.k === 'kill') done = (m.data.guards || []).every((g) => g.state === 'dead');
  else if (s.k === 'enter') done = p.inCar === m.data.veh;
  if (done) {
    if (s.add) addWanted(G, s.add, s.why || '');
    m.step += 1; m.stepInit = -1; m.progress = 0;
    if (m.step >= steps.length) completeMission(G, def.finale);
  }
}
export function startMission(G, index) {
  const def = MISSIONS[index];
  G.missions = { index, stage: 0, timer: 0, progress: 0, data: {}, marker: null, objective: '', dialog: def.intro.slice(), dialogIdx: 0, def, step: 0, stepInit: -1 };
  G.state = 'dialog';
}
export function advanceDialog(G) {
  const m = G.missions;
  m.dialogIdx += 1;
  if (m.dialogIdx >= m.dialog.length) {
    (m.def.setup || dslSetup)(G);
    G.state = 'playing';
    G.banner = { text: `Mission ${m.index + 1} — ${m.def.title}`, t: 3 };
  }
}
export function completeMission(G, finale) {
  const m = G.missions;
  const reward = MISSION_REWARDS[m.index];
  G.player.money += reward;
  G.stats.earned += reward;
  G.stats.missionsDone += 1;
  if (G.player.safehouse) { G.player.bank = (G.player.bank || 0) + 100; }
  G.audio.jingle(); G.audio.cash();
  G.banner = { text: `Mission complete — ${m.def.title}  +$${reward}`, t: 4 };
  if (finale || m.index >= MISSIONS.length - 1) {
    G.state = 'complete';
    G.missions.done = true;
    G.missions.objective = 'Free roam — Solmar Bay is yours. The story is complete.';
    saveGame(G);
    return;
  }
  saveGame(G);
  startMission(G, m.index + 1);
}
export function failMission(G, why) {
  G.banner = { text: why, t: 4 };
  G.audio.fail();
  startMission(G, G.missions.index);
}
export function updateMissions(G, dt) {
  const m = G.missions;
  if (!m || !m.def || m.index >= MISSIONS.length) return;
  if (G.state !== 'playing') return;
  if (m.done) return; // story finished — free roam, the runner must not re-complete
  (m.def.update || dslUpdate)(G, dt);
}
