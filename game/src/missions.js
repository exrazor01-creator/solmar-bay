// Solmar Bay — the story: seven missions with dialogue, objectives, timers and pay.
// Each mission is a small state machine; the runner sets markers and HUD text.
import { PLACES, MISSION_REWARDS, TUNE } from './config.js';
import { dist } from './random.js';
import { spawnCar } from './traffic.js';
import { addWanted } from './police.js';
import { spawnBullet } from './combat.js';
import { saveGame } from './save.js';

const D = (who, text) => ({ who, text });

export const MISSIONS = [
  {
    title: 'First Wheels', giver: 'Marla',
    intro: [D('Marla', 'Kid, you walk everywhere in this town. That ends today.'), D('Marla', 'Steal any car — E to get in — and bring it to my garage. No questions.'), D('You', 'Steal a car. Got it. What could go wrong?')],
    setup(G) { G.missions.marker = { x: PLACES.garage.x, y: PLACES.garage.y, label: 'Garage Marla' }; G.missions.objective = 'Steal a car (E) and bring it to the garage'; },
    update(G) {
      const m = G.missions;
      if (m.stage === 0 && G.player.inCar) { m.stage = 1; m.objective = 'Drive the car to the garage'; }
      else if (m.stage === 1 && dist(G.player.x, G.player.y, PLACES.garage.x, PLACES.garage.y) < 120) completeMission(G);
    },
  },
  {
    title: 'Cab Fare', giver: 'Marla',
    intro: [D('Marla', 'A fare is waiting at the taxi stand. Pick them up, drop them off. Easy money.'), D('Marla', 'You will need a car. Any car. Do not ask whose.'), D('You', 'One cab ride, coming up.')],
    setup(G) {
      G.missions.marker = { x: PLACES.taxiStand.x, y: PLACES.taxiStand.y, label: 'Taxi Stand' };
      G.missions.objective = 'Get a car, then pick up the fare at the taxi stand';
      const ped = { x: PLACES.taxiStand.x + 30, y: PLACES.taxiStand.y, angle: 0, speed: 0, state: 'walk', kind: 'passenger', hp: 100, tx: PLACES.taxiStand.x, ty: PLACES.taxiStand.y, waitT: 99, fleeT: 0, shirt: '#f39c12' };
      G.peds.push(ped); G.missions.data.passenger = ped;
    },
    update(G, dt) {
      const m = G.missions, p = G.player;
      if (m.stage === 0 && p.inCar && dist(p.x, p.y, PLACES.taxiStand.x, PLACES.taxiStand.y) < 70) {
        m.stage = 1; m.timer = 75; m.objective = 'Fare picked up! Reach the hotel before the timer runs out';
        const pas = m.data.passenger; if (pas) { const i = G.peds.indexOf(pas); if (i >= 0) G.peds.splice(i, 1); }
        G.missions.marker = { x: 2400, y: 300, label: 'Hotel Solmar' };
        G.audio.pickup();
      } else if (m.stage === 1) {
        m.timer -= dt;
        if (dist(p.x, p.y, 2400, 300) < 130) completeMission(G);
        else if (m.timer <= 0) failMission(G, 'The fare got out and walked. Try again — the stand is waiting.');
      }
    },
  },
  {
    title: 'Hot Package', giver: 'Dante',
    intro: [D('Dante', 'A package. Small. Valuable. Nobody saw you take it.'), D('Dante', 'Grab it at the docks, then run it across town. Ninety seconds. Do not stop for anyone.'), D('You', 'Ninety seconds across Solmar Bay? I drive fast.')],
    setup(G) {
      G.missions.marker = { x: 400, y: 1900, label: 'The Docks' };
      G.missions.objective = 'Pick up the package at the docks';
    },
    update(G, dt) {
      const m = G.missions, p = G.player;
      if (m.stage === 0 && dist(p.x, p.y, 400, 1900) < 90) {
        m.stage = 1; m.timer = 90; m.objective = 'Package in hand! Deliver it to the east pier';
        G.missions.marker = { x: 2800, y: 1900, label: 'East Pier' };
        G.audio.pickup();
      } else if (m.stage === 1) {
        m.timer -= dt;
        if (dist(p.x, p.y, 2800, 1900) < 110) completeMission(G);
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
      for (const [gx, gy] of [[1940, 1060], [2060, 1140]]) {
        G.peds.push({ x: gx, y: gy, angle: 0, speed: 0, state: 'walk', kind: 'guard', hp: 100, tx: gx, ty: gy, waitT: 99, fleeT: 0, shirt: '#2c3e50', shootCd: 1 });
      }
      G.missions.marker = { x: 2000, y: 1100, label: 'The Violet Car' };
      G.missions.objective = 'Steal the violet sports car from the guarded lot';
    },
    update(G, dt) {
      const m = G.missions, p = G.player;
      guardFire(G, dt);
      if (m.stage === 0 && p.inCar === m.data.repoCar) { m.stage = 1; m.objective = 'Got it! Bring the car to the garage'; G.missions.marker = { x: PLACES.garage.x, y: PLACES.garage.y, label: 'Garage Marla' }; }
      else if (m.stage === 1 && dist(p.x, p.y, PLACES.garage.x, PLACES.garage.y) < 120) completeMission(G);
    },
  },
  {
    title: 'The Distraction', giver: 'Marla',
    intro: [D('Marla', 'Dante needs the cops busy on the other side of town. That is your job.'), D('Marla', 'Get to three stars — any way you like — then slip away to the hideout at the docks.'), D('You', 'Cause a scene, then vanish. My specialty.')],
    setup(G) {
      G.missions.objective = 'Cause trouble until you hit 3 stars, then reach the hideout';
      G.missions.marker = { x: PLACES.hideout.x, y: PLACES.hideout.y, label: 'Hideout' };
    },
    update(G) {
      const m = G.missions;
      if (m.stage === 0 && G.wanted.stars >= 3) { m.stage = 1; m.objective = 'Three stars! Now slip away to the hideout'; }
      else if (m.stage === 1 && dist(G.player.x, G.player.y, PLACES.hideout.x, PLACES.hideout.y) < 130) completeMission(G);
    },
  },
  {
    title: 'The Big Score', giver: 'Dante',
    intro: [D('Dante', 'Solmar First Bank. One vault. One night. We walk out rich or we do not walk out.'), D('Dante', 'Get inside, hold E at the vault until the cash is yours, then lose four stars at the hideout.'), D('You', 'The big score. Let us make Solmar Bay remember my name.')],
    setup(G) {
      G.missions.marker = { x: PLACES.bank.x, y: PLACES.bank.y, label: 'Solmar First Bank' };
      G.missions.objective = 'Get to the bank';
    },
    update(G, dt) {
      const m = G.missions, p = G.player;
      if (m.stage === 0 && dist(p.x, p.y, PLACES.bank.x, PLACES.bank.y) < 110) {
        m.stage = 1; m.progress = 0; m.objective = 'Hold E at the vault to crack it';
      } else if (m.stage === 1) {
        const near = dist(p.x, p.y, PLACES.bank.x, PLACES.bank.y) < 110;
        if (near && G.input.keys.has('e')) {
          m.progress += dt / 4;
          if (m.progress >= 1) {
            m.stage = 2; addWanted(G, 8, 'BANK ROBBERY — every cop in Solmar Bay is coming');
            m.objective = 'Cash grabbed! Escape to the hideout';
            G.missions.marker = { x: PLACES.hideout.x, y: PLACES.hideout.y, label: 'Hideout' };
            G.audio.cash();
          }
        } else m.progress = Math.max(0, m.progress - dt / 2);
      } else if (m.stage === 2 && dist(p.x, p.y, PLACES.hideout.x, PLACES.hideout.y) < 130) {
        completeMission(G, true);
      }
    },
  },
];

function guardFire(G, dt) {
  for (const g of G.peds) {
    if (g.kind !== 'guard' || g.state === 'dead') continue;
    g.shootCd = Math.max(0, (g.shootCd || 0) - dt);
    const d = dist(g.x, g.y, G.player.x, G.player.y);
    if (d < 340 && g.shootCd <= 0 && G.state === 'playing') {
      g.shootCd = 1.1;
      const a = Math.atan2(G.player.y - g.y, G.player.x - g.x) + (G.rng() - 0.5) * 0.2;
      spawnBullet(G, g.x, g.y, a, 'enemy', 20);
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
