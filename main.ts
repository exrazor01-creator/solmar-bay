// Solmar Bay — packager for the make.fun gta6-01 entry.
//
// The game itself lives in game/ next to this file: a plain static page
// (game/index.html plus its ES modules, no library, no build step, nothing
// fetched from the network). All this script does is stage that game, along
// with the staged screenshots in screenshots/, into the grader's output
// directory, and then ask the vendored make.fun library to write the dossier
// the judges read. Packaging is copying plus counting — the game does the
// rest.
//
// Local runs, outside the grader's container:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// To play it in a browser instead:
//   node serve.ts        # then open http://localhost:8080

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// This file's own directory is the entry root; the packaged entry lands in
// the folder the grader points at, or /output when nothing points elsewhere.
const entryRoot = dirname(fileURLToPath(import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function stageFolder(name) {
  const from = join(entryRoot, name);
  const to = join(outputDir, name);
  mkdirSync(to, { recursive: true });
  if (existsSync(from)) cpSync(from, to, { recursive: true });
}

// The game folder is the entry, so it must be there; the screenshots folder
// is expected too (four staged shots), but an empty one is still created so
// the dossier builder always finds the directory it counts.
stageFolder('game');
stageFolder('screenshots');

// The competition's own caps, from reference/gate.json. Only the text cap
// trims anything — it shapes how much of the entry's text the dossier
// carries. The rest are hard refusals the library enforces on our behalf:
// more than four screenshots, or any one over 256 KiB; more than 993 files
// or 48 MiB in total under game/; any path under game/ longer than 1000
// bytes. Raising here beats handing in an entry the scorer would refuse.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});

writeFileSync(join(outputDir, 'dossier.json'), dossier);
