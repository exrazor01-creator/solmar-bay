# SOLMAR BAY — Open-World Crime

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/exrazor01-creator/solmar-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/exrazor01-creator/solmar-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Solmar Bay** is a complete open-world crime game in the spirit of GTA 6, playable in a
desktop browser from static files — no build step, no network request, no library.

Built for [make.fun](https://make.fun/bounty/gta6-01) — try it yourself with my referral: https://make.fun/r/9taf1vak

You are Vic, a newcomer in Solmar Bay, a sun-soaked coastal city. Steal cars, outrun the
Solmar Bay PD, run seven story missions for Marla and Dante, and finish with the big score
at Solmar First Bank.

## How to play

Serve the game and open it in desktop Chrome:

```sh
node serve.ts
# open http://localhost:8080
```

| Key | Action |
| --- | --- |
| WASD / arrows | Walk (Shift to sprint) |
| Mouse | Aim |
| Left click | Shoot pistol |
| E | Enter / exit car · advance dialogue · crack the vault |
| F / Space | Punch |
| B | Buy ammo / medkit / car repair near a shop |
| P / Esc | Pause · R restart · M mute |

## The city

- **On foot and by car** — walk the sidewalks or steal any parked or moving car (E) and
  drive it with W/S to accelerate and brake, A/D to steer.
- **Traffic and pedestrians** — cars drive the road grid, stop for each other, and
  pedestrians stroll the sidewalks and run from gunfire.
- **Wanted level** — crimes raise your stars (0–5). Foot cops chase and punch; police cars
  ram. Break line of sight and the heat cools off.
- **Missions and story** — seven missions with dialogue: steal a car, run a cab fare,
  deliver a hot package against the clock, lose a three-star tail, repo a guarded sports
  car, cause a distraction, and rob the bank.
- **Money and progression** — mission pay buys ammo, medkits and repairs. Progress
  autosaves after every mission.
- **HUD and minimap** — health, cash, ammo, wanted stars, objective and timer, plus a
  live minimap of the city, the mission marker and the police.
- **Polish** — synthesized WebAudio sound (gunshots, sirens, engine, a synthwave loop),
  particles, skid marks, screen shake, car smoke, day-to-night light, and a beach at the
  south edge of town.

## Structure

```
game/
  index.html        the page (canvas + module entry)
  src/
    config.js       tuning, palette, road grid, places
    random.js       seeded RNG (deterministic city and shots)
    world.js        city generation + collision
    input.js        keyboard / mouse
    audio.js        synthesized WebAudio: SFX + music loop
    player.js       walking, driving, shooting, shops
    traffic.js      traffic cars + pedestrians
    police.js       wanted system + police AI
    combat.js       bullets, explosions, particles, damage
    missions.js     the seven-mission story + dialogue
    hud.js          HUD, minimap, dialogue, menus
    render.js       camera, city, entities, light
    shots.js        staged screenshot scenes (?shot=…)
    save.js         localStorage saves
    main.js         state, loop, staging, debug handle
```

Screenshots are real renders of the game: `shots.json` maps each one to the `?shot=`
scene that staged it (`cover`, `mission`, `sunset`, `night`).

## License

MIT — see [LICENSE](LICENSE).
