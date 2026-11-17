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

You are Vic — or Luna, his partner — a newcomer in Solmar Bay, a sun-soaked coastal
city. Steal cars, fly helicopters, sail boats, outrun the Solmar Bay PD, run
twenty-two story missions for Marla, Dante and Luna, and finish by taking the crown
at six stars.

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
| Left click | Shoot (pistol / shotgun / rifle / sniper) |
| E | Enter / exit car · advance dialogue · crack the vault |
| F / Space | Punch (a bat doubles the damage) |
| Q | Switch weapon (pistol / shotgun / rifle / sniper) |
| R | Reload the rifle / sniper magazine |
| V | Switch protagonist (Vic / Luna) |
| B / 1–7 | Buy at a shop (ammo, medkit, armor, shotgun, rifle, sniper, bat, repair, nitro, ATM, safehouse, outfit, meals) |
| T | Start a taxi fare near the taxi stand (in a car) |
| Y | Start a delivery run near the depot (in a car) |
| R | Start a street race near the race start (in a car) |
| Space / C | Helicopter: climb / descend |
| Shift | Nitro boost in a car |
| M | Map screen · N mute · P / Esc pause |

## The city

- **A real 3D city** — low-poly buildings in seven districts (Downtown, Harbor, Beach,
  Suburbs, Old Town, Midtown, Airport), Solmar Tower, the Lighthouse, the airport
  terminal with a runway and a parked jet, Bayview Mall, Club Neon, the police HQ,
  the hospital, a diner, a clothing store and a gas station; roads, sidewalks, parks,
  palms, streetlights, traffic lights, neon signs that light up at night, an animated
  sea and a day–dusk–night sky with rain and lightning.
- **Two protagonists** — Vic (steady, tough) and Luna (fast, light). Press V to switch;
  each has their own look, pace and health. Progress and missions carry across.
- **On foot, by car, by air and by sea** — walk the sidewalks or steal any parked or
  moving car (E) and drive it: sedans, taxis, sports cars, supercars, SUVs, trucks,
  vans, buses and bikes. Take the helicopter from the helipad (Space to climb, C to
  land) or a boat from the marina and sail the coast.
- **Weapons** — pistol, shotgun, rifle (30-round mag) and sniper (5-round mag, long
  range), plus a bat for close work. Q cycles what you own, R reloads from your ammo.
- **Wanted level** — crimes raise your stars (0–6). Foot cops chase and punch; police
  cars ram; at four stars the force throws roadblocks across the road and sends the
  police helicopter up; at six stars the SWAT units come out with a second helicopter.
  Break line of sight and the heat cools off.
- **Twenty-two missions and a story** — steal a car, run a cab fare, deliver a hot
  package against the clock, lose a three-star tail, repo a guarded sports car, cause
  a distraction, rob the bank, escape by boat, run three taxi fares in a row, fly a
  helicopter to a rooftop, win a street race, and pull the last score at five stars —
  then ten more: a courier drop, a pink supercar heist, a sky hook at the airport, a
  sniper job at the harbor, a bus job, a storm run to the lighthouse, a night out at
  Club Neon with Luna, an airport cargo run, a gang war at the docks, and the crown —
  a second bank vault at six stars with SWAT on the ground.
- **Economy** — an ATM and a bank balance, a safehouse you can buy at the hideout
  (rest to heal, and it pays a little after every mission), a clothing store with
  three outfits, a diner that heals, and a gun shop that sells the rifle, the sniper
  and the bat.
- **Side activities** — twenty hidden packages to collect, repeatable taxi fares, a
  street-race time trial and delivery runs from the depot, all paying cash.
- **Money and progression** — mission and side pay buys ammo, shells, medkits, armor,
  weapons, repairs and nitro. Progress autosaves after every mission and every minute,
  across three save slots you pick on the title screen.
- **HUD, map and settings** — health, armor, cash, bank balance, ammo and magazine,
  wanted stars (six), objective and timer, district and weather, a speedometer, plus
  a live minimap and a full map screen (M). The pause menu holds volume, quality and
  three radio stations.
- **Weather and sound** — rain, thunderstorms with lightning and thunder, synthesized
  WebAudio sound (gunshots, rifle, sniper, sirens, engine, rotor, boat, footsteps,
  thunder and three procedural radio stations), particles, skid marks, screen shake,
  car smoke, a chase camera that rises above rooftops, and headlights and lit windows
  at night.

## Structure

```
game/
  index.html        the page (WebGL canvas + HUD overlay + module entry)
  src/
    config.js       tuning, palette, road grid, places, vehicles, weapons, heroes
    gl.js           the hand-written WebGL engine: shaders, matrices, renderer
    random.js       seeded RNG (deterministic city and shots)
    world.js        city generation (districts, landmarks, airport) + collision
    input.js        keyboard / mouse
    audio.js        synthesized WebAudio: SFX + three radio stations
    player.js       walking, driving, flying, sailing, shooting, shops, heroes
    traffic.js      traffic cars + pedestrians
    police.js       wanted system (six stars) + police AI + SWAT + roadblocks + helis
    vehicles.js     helicopters, boats, roadblocks, police heli AI
    combat.js       3D bullets, explosions, particles, damage
    missions.js     the twenty-two-mission story + dialogue + step runner
    side.js         hidden packages, taxi fares, street race, delivery runs
    hud.js          HUD, minimap, map screen, dialogue, menus, settings
    render3d.js     chase camera + the 3D scene (city, sea, vehicles, people)
    shots.js        staged screenshot scenes (?shot=…)
    save.js         localStorage saves (three slots)
    main.js         state, loop, staging, debug handle
```

Screenshots are real renders of the game: `shots.json` maps each one to the `?shot=`
scene that staged it (`cover`, `mission`, `sunset`, `night`).

## License

MIT — see [LICENSE](LICENSE).
