// Solmar Bay — saving to localStorage. Autosaves after each mission; the title screen
// offers Continue when a save exists. Nothing leaves the browser.
const KEY = 'solmar-bay-save-v1';

export function saveGame(G) {
  try {
    const s = {
      money: G.player.money, ammo: G.player.ammo, shells: G.player.shells || 0,
      ownsShotgun: !!G.player.ownsShotgun, armor: G.player.armor || 0, nitro: G.player.nitro || 0,
      hp: G.player.hp, x: G.player.x, z: G.player.z, mission: G.missions ? G.missions.index : 0,
      missionsDone: G.stats.missionsDone, earned: G.stats.earned, timeOfDay: G.timeOfDay,
      packages: G.side ? G.side.packages.filter((p) => p.got).map((p) => p.id) : [],
    };
    localStorage.setItem(KEY, JSON.stringify(s));
    return true;
  } catch { return false; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* no storage */ }
}
