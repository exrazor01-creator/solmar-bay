# SOLMAR BAY — Open-World Crime in 3D

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/exrazor01-creator/solmar-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/exrazor01-creator/solmar-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Solmar Bay** is a complete open-world crime game in the spirit of GTA 6, in real 3D,
playable in a desktop browser from static files — no build step, no network request,
no library. The 3D engine is hand-written raw WebGL: one shader, one dynamic buffer,
low-poly vertex-colour geometry, a directional sun, fog and a chase camera.

Built for [make.fun](https://make.fun/bounty/gta6-01) — try it yourself with my referral: https://make.fun/r/9taf1vak

You are Vic, a newcomer in Solmar Bay, a sun-soaked coastal city. Steal cars, fly
helicopters, sail boats, outrun the Solmar Bay PD, run twelve story missions for Marla
and Dante, and finish with the last score at Solmar First Bank.

## How to play

Serve the game and open it in desktop Chrome:

```sh
node serve.ts
# open http://localhost:8080
```

| Key | Action |
| --- | --- |
| WASD / arrows | Walk (Shift to sprint) |
| Mouse | Aim (ray through the 3D camera) |
| Left click | Shoot (pistol / shotgun) |
| E | Enter / exit car · advance dialogue · crack the vault |
| F / Space | Punch |
| Q | Switch weapon (pistol / shotgun) |
| B / 1–4 | Buy at a shop (ammo, medkit, armor, shotgun, repair, nitro) |
| T | Start a taxi fare near the taxi stand (in a car) |
| R | Start a street race near the race start (in a car) |
| Space / C | Helicopter: climb / descend |
| Shift | Nitro boost in a car |
| P / Esc | Pause · R restart · M mute |

## The city

- **A real 3D city** — low-poly buildings in six districts (Downtown, Harbor, Beach,
  Suburbs, Old Town, Midtown), Solmar Tower and the Lighthouse, roads, sidewalks, parks,
  palms, streetlights, an animated sea and a day–dusk–night sky with rain.
- **On foot, by car, by air and by sea** — walk the sidewalks or steal any parked or
  moving car (E) and drive it; take the helicopter from the helipad (Space to climb,
  C to land) or a boat from the marina and sail the coast.
- **Traffic and pedestrians** — sedans, taxis, sports cars, trucks, vans and bikes drive
  the road grid, stop for each other and unstick themselves; pedestrians stroll the
  sidewalks and run from gunfire.
- **Wanted level** — crimes raise your stars (0–5). Foot cops chase and punch; police
  cars ram; at four stars the force throws roadblocks across the road and sends the
  police helicopter up. Break line of sight and the heat cools off.
- **Twelve missions and a story** — steal a car, run a cab fare, deliver a hot package
  against the clock, lose a three-star tail, repo a guarded sports car, cause a
  distraction, rob the bank, escape by boat, run three taxi fares in a row, fly a
  helicopter to a rooftop, win a street race, and pull the last score at five stars.
- **Side activities** — ten hidden packages to collect, repeatable taxi fares and a
  street-race time trial, all paying cash.
- **Money and progression** — mission and side pay buys ammo, shells, medkits, armor,
  a shotgun, repairs and nitro. Progress autosaves after every mission.
- **HUD and minimap** — health, armor, cash, ammo, wanted stars, objective and timer,
  district and weather, plus a live minimap of the city, the mission marker, side
  markers, packages and the police.
- **Polish** — synthesized WebAudio sound (gunshots, shotgun, sirens, engine, rotor,
  boat, a synthwave loop), particles, skid marks, screen shake, car smoke, a chase
  camera that rises above rooftops, and headlights and lit windows at night.

## Structure

```
game/
  index.html        the page (WebGL canvas + HUD overlay + module entry)
  src/
    config.js       tuning, palette, road grid, places, vehicles, weapons
    gl.js           the hand-written WebGL engine: shaders, matrices, renderer
    random.js       seeded RNG (deterministic city and shots)
    world.js        city generation (districts, landmarks) + collision
    input.js        keyboard / mouse
    audio.js        synthesized WebAudio: SFX + music loop
    player.js       walking, driving, flying, sailing, shooting, shops
    traffic.js      traffic cars + pedestrians
    police.js       wanted system + police AI + roadblocks + police heli
    vehicles.js     helicopters, boats, roadblocks, police heli AI
    combat.js       3D bullets, explosions, particles, damage
    missions.js     the twelve-mission story + dialogue
    side.js         hidden packages, taxi fares, street race
    hud.js          HUD, minimap, dialogue, menus
    render3d.js     chase camera + the 3D scene (city, sea, vehicles, people)
    shots.js        staged screenshot scenes (?shot=…)
    save.js         localStorage saves
    main.js         state, loop, staging, debug handle
```

Screenshots are real renders of the game: `shots.json` maps each one to the `?shot=`
scene that staged it (`cover`, `mission`, `sunset`, `night`).

## License

MIT — see [LICENSE](LICENSE).
