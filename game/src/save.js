const KEY = 'solmar-bay-save-v1';
const keyFor = (slot) => (slot > 0 ? `${KEY}-s${slot}` : KEY);
export function saveGame(G, slot) {
  try {
    const s = {
      slot: slot ?? G.saveSlot ?? 0,
      money: G.player.money, bank: G.player.bank || 0, ammo: G.player.ammo, shells: G.player.shells || 0,
      ownsShotgun: !!G.player.ownsShotgun, ownsRifle: !!G.player.ownsRifle, ownsSniper: !!G.player.ownsSniper,
      rifleMag: G.player.rifleMag || 0, sniperMag: G.player.sniperMag || 0, ownsBat: !!G.player.ownsBat,
      armor: G.player.armor || 0, nitro: G.player.nitro || 0,
      hp: G.player.hp, x: G.player.x, z: G.player.z, mission: G.missions ? G.missions.index : 0,
      missionsDone: G.stats.missionsDone, earned: G.stats.earned, timeOfDay: G.timeOfDay,
      char: G.player.char || 'vic', outfit: G.player.outfit || 0, safehouse: !!G.player.safehouse,
      garage: (G.garage || []).map((c) => c.kind),
      radio: G.settings ? G.settings.radio : 0, volume: G.settings ? G.settings.volume : 0.5,
      quality: G.settings ? G.settings.quality : 'high',
      packages: G.side ? G.side.packages.filter((p) => p.got).map((p) => p.id) : [],
    };
    localStorage.setItem(keyFor(s.slot), JSON.stringify(s));
    return true;
  } catch { return false; }
}
export function loadGame(slot) {
  try {
    const raw = localStorage.getItem(keyFor(slot || 0));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
export function clearSave(slot) {
  try { localStorage.removeItem(keyFor(slot || 0)); } catch { /* no storage */ }
}
