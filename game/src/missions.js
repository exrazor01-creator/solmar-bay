// Solmar Bay — the story: twelve missions with dialogue, objectives, timers and pay.
// Each mission is a small state machine; the runner sets markers and HUD text.
// Vic runs the streets, Marla runs the garage, Dante runs the big jobs.
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
    setup(G) { G.missions.marker = { x: PLACES.garage.x, z: PLACES.garage.z, label: 'Garage Marla' }; G.missions.objective = 'Steal a car (E) and bring it to the garage'; },
    update(G) {
      const m = G.missions;
      if (m.stage === 0 && G.player.inCar) { m.stage = 1; m.objective = 'Drive the car to the garage'; }
      else if (m.stage === 1 && dist(G.player.x, G.player.z, PLACES.garage.x, PLACES.garage.z) < 120) completeMission(G);
    },
  },
  {
    title: 'Cab Fare', giver: 'Marla',
    intro: [D('Marla', 'A fare is waiting at the taxi stand. Pick them up, drop them off. Easy money.'), D('Marla', 'You will need a car. Any car. Do not ask whose.'), D('You', 'One cab ride, coming up.')],
    setup(G) {
      G.missions.marker = { x: PLACES.taxiStand.x, z: PLACES.taxiStand.z, label: 'Taxi Stand' };
      G.missions.objective = 'Get a car, then pick up the fare at the taxi stand';
      const ped = { x: PLACES.taxiStand.x + 30, z: PLACES.taxiStand.z, angle: 0, speed: 0, state: 'walk', kind: 'passenger', hp: 100, tx: PLACES.taxiStand.x, tz: PLACES.taxiStand.z, waitT: 99, fleeT: 0, color: '#f39c12', seed: G.rng() };
      G.peds.push(ped); G.missions.data.passenger = ped;
    },
    update(G, dt) {
      const m = G.missions, p = G.player;
      if (m.stage === 0 && p.inCar && dist(p.x, p.z, PLACES.taxiStand.x, PLACES.taxiStand.z) < 70) {
        m.stage = 1; m.timer = 75; m.objective = 'Fare picked up! Reach the hotel before the timer runs out';
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
    intro: [D('Dante', 'A package. Small. Valuable. Nobody saw you take it.'), D('Dante', 'Grab it at the docks, then run it across town. Ninety seconds. Do not stop for anyone.'), D('You', 'Ninety seconds across Solmar Bay? I drive fast.')],
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
      G.missions.objective = 'Lose the wanted level — stay out of sight until the stars are gone';
      G.missions.marker = null;
    },
    update(G) { if (G.wanted.stars === 0) completeMission(G); },
  },
  {
    title: 'Repo Man', giver: 'Dante',
    intro: [D('Dante', 'There is a violet sports car in the lot on 5th. It is mine. It is guarded. Take it anyway.'), D('Dante', 'The guards are armed. So are you. Bring the car to the garage.'), D('You', 'Armed guards, one violet car. Sounds fair.')],
    setup(G) {
      const car = spawnCar(G, 2000, 1100, 'sport', 'parked');
      car.color = '#8e44ad'; car.repo = true; G.missions.data.repoCar = car;
      for (const [gx, gz] of [[1940, 1060], [2060, 1140]]) {
        G.peds.push({ x: gx, z: gz, angle: 0, speed: 0, state: 'walk', kind: 'guard', hp: 100, tx: gx, tz: gz, waitT: 99, fleeT: 0, color: '#2c3e50', seed: G.rng(), shootCd: 1 });
      }
      G.missions.marker = { x: 2000, z: 1100, label: 'The Violet Car' };
      G.missions.objective = 'Steal the violet sports car from the guarded lot';
    },
    update(G, dt) {
      const m = G.missions, p = G.player;
      guardFire(G, dt);
      if (m.stage === 0 && p.inCar === m.data.repoCar) { m.stage = 1; m.objective = 'Got it! Bring the car to the garage'; G.missions.marker = { x: PLACES.garage.x, z: PLACES.garage.z, label: 'Garage Marla' }; }
      else if (m.stage === 1 && dist(p.x, p.z, PLACES.garage.x, PLACES.garage.z) < 120) completeMission(G);
    },
  },
  {
    title: 'The Distraction', giver: 'Marla',
    intro: [D('Marla', 'Dante needs the cops busy on the other side of town. That is your job.'), D('Marla', 'Get to three stars — any way you like — then slip away to the hideout at the docks.'), D('You', 'Cause a scene, then vanish. My specialty.')],
    setup(G) {
      G.missions.objective = 'Cause trouble until you hit 3 stars, then reach the hideout';
      G.missions.marker = { x: PLACES.hideout.x, z: PLACES.hideout.z, label: 'Hideout' };
    },
    update(G) {
      const m = G.missions;
      if (m.stage === 0 && G.wanted.stars >= 3) { m.stage = 1; m.objective = 'Three stars! Now slip away to the hideout'; }
      else if (m.stage === 1 && dist(G.player.x, G.player.z, PLACES.hideout.x, PLACES.hideout.z) < 130) completeMission(G);
    },
  },
  {
    title: 'The Big Score', giver: 'Dante',
    intro: [D('Dante', 'Solmar First Bank. One vault. One night. We walk out rich or we do not walk out.'), D('Dante', 'Get inside, hold E at the vault until the cash is yours, then lose four stars at the hideout.'), D('You', 'The big score. Let us make Solmar Bay remember my name.')],
    setup(G) {
      G.missions.marker = { x: PLACES.bank.x, z: PLACES.bank.z, label: 'Solmar First Bank' };
      G.missions.objective = 'Get to the bank';
    },
    update(G, dt) {
      const m = G.missions, p = G.player;
      if (m.stage === 0 && dist(p.x, p.z, PLACES.bank.x, PLACES.bank.z) < 110) {
        m.stage = 1; m.progress = 0; m.objective = 'Hold E at the vault to crack it';
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
    intro: [D('Marla', 'The cops sealed the roads, kid. So we take the water.'), D('Marla', 'A boat is waiting at the marina. Sail her east along the coast to the far pier. Fast and quiet.'), D('You', 'A boat chase. Finally, a commute with a view.')],
    setup(G) {
      spawnBoat(G, 400, 2290, 'parked');
      spawnBoat(G, 500, 2300, 'parked');
      G.missions.marker = { x: PLACES.marina.x, z: PLACES.marina.z, label: 'Marina' };
      G.missions.objective = 'Get to the marina and board a boat (E)';
    },
    update(G) {
      const m = G.missions, p = G.player;
      if (m.stage === 0 && dist(p.x, p.z, PLACES.marina.x, PLACES.marina.z) < 120) {
        m.stage = 1; m.objective = 'Sail east to the far pier — stay in the water';
        G.missions.marker = { x: 2800, z: 2330, label: 'Far Pier' };
      } else if (m.stage === 1 && p.inCar && p.inCar.kind === 'boat' && dist(p.x, p.z, 2800, 2330) < 130) {
        completeMission(G);
      }
    },
  },
  {
    title: 'Taxi King', giver: 'Marla',
    intro: [D('Marla', 'Three fares, one shift, no excuses. The whole town is watching the meter.'), D('Marla', 'Pick them up in order: the stand, the hotel, the docks. Do not keep anyone waiting.'), D('You', 'Three fares. One legend. Let us go.')],
    setup(G) {
      G.missions.data.legs = [
        { from: PLACES.taxiStand, to: PLACES.hotel, time: 60 },
        { from: PLACES.hotel, to: PLACES.hideout, time: 75 },
        { from: PLACES.hideout, to: PLACES.bank, time: 75 },
      ];
      G.missions.data.leg = 0;
      const leg = G.missions.data.legs[0];
      G.missions.marker = { x: leg.from.x, z: leg.from.z, label: 'Fare 1 — Taxi Stand' };
      G.missions.objective = 'Get a car, then pick up fare 1 at the taxi stand';
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
    intro: [D('Dante', 'A package sits on the roof of Solmar Tower. The only way up is by air.'), D('Dante', 'Take the helicopter at the helipad. Hover over the roof until the package is yours, then bring it home.'), D('You', 'A helicopter, a rooftop, a payday. Up we go.')],
    setup(G) {
      spawnHeli(G, 2800, 300, 'parked');
      G.missions.marker = { x: PLACES.helipad.x, z: PLACES.helipad.z, label: 'Helipad' };
      G.missions.objective = 'Get to the helipad and take the helicopter (E)';
    },
    update(G, dt) {
      const m = G.missions, p = G.player;
      if (m.stage === 0 && p.inCar && p.inCar.kind === 'heli') {
        m.stage = 1; m.objective = 'Fly to Solmar Tower — hover over the roof to grab the package';
        G.missions.marker = { x: PLACES.tower.x, z: PLACES.tower.z, label: 'Solmar Tower Roof' };
      } else if (m.stage === 1 && p.inCar && p.inCar.kind === 'heli') {
        const heli = p.inCar;
        if (heli.y > 40 && dist(p.x, p.z, PLACES.tower.x, PLACES.tower.z) < 80) {
          m.progress += dt / 2;
          m.objective = 'Hold the hover… package loading';
          if (m.progress >= 1) {
            m.stage = 2; m.progress = 0; m.objective = 'Package secured! Land back at the helipad';
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
    intro: [D('Dante', 'The street racers own the night. Tonight, you take their crown.'), D('Dante', 'Get in a car at the race start. Beat both rivals through the four checkpoints. First across the line takes the pot.'), D('You', 'Two rivals, four checkpoints, one winner. That is me.')],
    setup(G) {
      G.missions.marker = { x: PLACES.raceStart.x, z: PLACES.raceStart.z, label: 'Race Start' };
      G.missions.objective = 'Get in a car at the race start (E)';
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
        m.stage = 1; m.data.cp = 0; m.objective = 'Race! Hit the checkpoints in order — beat both rivals';
        G.missions.marker = { x: RACE_COURSE[0].x, z: RACE_COURSE[0].z, label: 'Checkpoint 1/4' };
        G.audio.jingle();
      } else if (m.stage === 1) {
        // The rivals drive the course on their own.
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
    intro: [D('Dante', 'One more vault. Bigger than the first. Five stars, roadblocks, a helicopter in the sky.'), D('Dante', 'Crack the vault, then run the gauntlet to the hideout. If we pull this off, Solmar Bay is ours.'), D('You', 'The last score. Everything on the line. Let us finish this.')],
    setup(G) {
      G.missions.marker = { x: PLACES.bank.x, z: PLACES.bank.z, label: 'Solmar First Bank' };
      G.missions.objective = 'Get to the bank — one last time';
    },
    update(G, dt) {
      const m = G.missions, p = G.player;
      if (m.stage === 0 && dist(p.x, p.z, PLACES.bank.x, PLACES.bank.z) < 110) {
        m.stage = 1; m.progress = 0; m.objective = 'Hold E at the vault to crack it (5s)';
      } else if (m.stage === 1) {
        const near = dist(p.x, p.z, PLACES.bank.x, PLACES.bank.z) < 110;
        if (near && G.input.keys.has('e')) {
          m.progress += dt / 5;
          if (m.progress >= 1) {
            m.stage = 2; addWanted(G, 10, 'THE LAST SCORE — five stars, roadblocks, the chopper is up');
            m.objective = 'Five stars! Run the gauntlet to the hideout';
            G.missions.marker = { x: PLACES.hideout.x, z: PLACES.hideout.z, label: 'Hideout' };
            G.audio.cash();
          }
        } else m.progress = Math.max(0, m.progress - dt / 2);
      } else if (m.stage === 2 && dist(p.x, p.z, PLACES.hideout.x, PLACES.hideout.z) < 130) {
        completeMission(G, true);
      }
    },
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

export function startMission(G, index) {
  const def = MISSIONS[index];
  G.missions = { index, stage: 0, timer: 0, progress: 0, data: {}, marker: null, objective: '', dialog: def.intro.slice(), dialogIdx: 0, def };
  G.state = 'dialog';
}

export function advanceDialog(G) {
  const m = G.missions;
  m.dialogIdx += 1;
  if (m.dialogIdx >= m.dialog.length) {
    m.def.setup(G);
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
  G.audio.jingle(); G.audio.cash();
  G.banner = { text: `Mission complete — ${m.def.title}  +$${reward}`, t: 4 };
  if (finale) {
    G.state = 'complete';
    G.missions.done = true;
    G.missions.objective = 'Free roam — Solmar Bay is yours. The story is complete.';
    return;
  }
  saveGame(G);
  startMission(G, m.index + 1);
}

export function failMission(G, why) {
  G.banner = { text: why, t: 4 };
  G.audio.fail();
  // Restart the same mission from its intro.
  startMission(G, G.missions.index);
}

export function updateMissions(G, dt) {
  const m = G.missions;
  if (!m || !m.def || m.index >= MISSIONS.length) return;
  if (G.state !== 'playing') return;
  m.def.update(G, dt);
}
