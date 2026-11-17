// Solmar Bay — saving to localStorage. Autosaves after each mission; the title screen
// offers Continue when a save exists. Nothing leaves the browser.
const KEY = 'solmar-bay-save-v1';

export function saveGame(G) {
  try {
    const s = {
      money: G.player.money, ammo: G.player.ammo, hp: G.player.hp,
      x: G.player.x, y: G.player.y, mission: G.missions ? G.missions.index : 0,
      missionsDone: G.stats.missionsDone, earned: G.stats.earned, timeOfDay: G.timeOfDay,
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
