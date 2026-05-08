// HUD — thin wrapper over DOM nodes for game stats.

const els = {
  level: document.getElementById("hud-level"),
  wave: document.getElementById("hud-wave"),
  waveTotal: document.getElementById("hud-wave-total"),
  lives: document.getElementById("hud-lives"),
  xp: document.getElementById("hud-xp"),
  coins: document.getElementById("hud-coins"),
  weapon: document.getElementById("hud-weapon"),
};

export const Hud = {
  setLevel(v) { if (els.level) els.level.textContent = v; },
  setWave(v, total) {
    if (els.wave) els.wave.textContent = v;
    if (els.waveTotal) els.waveTotal.textContent = total;
  },
  setLives(v) { if (els.lives) els.lives.textContent = v; },
  setXP(v) { if (els.xp) els.xp.textContent = v; },
  setCoins(v) { if (els.coins) els.coins.textContent = v; },
  setWeapon(name) { if (els.weapon) els.weapon.textContent = name; },
};
