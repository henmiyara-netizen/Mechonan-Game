// Multi-pilot profiles + progress persistence in localStorage.
//
// Schema:
// {
//   profiles: [{ id, name, createdAt, lastPlayedAt, progress: { ... } }],
//   activeId: string | null
// }

const STORE_KEY = "mechonan-galaxy.v1";

const EMPTY_SHIP_UPGRADES = () => ({ speedBoost: 0, damageBoost: 0, fireRateBoost: 0, maxLivesBoost: 0 });

const DEFAULT_PROGRESS = {
  level: 1,
  xp: 0,
  coins: 0,
  highestLevel: 1,
  totalCorrect: 0,
  totalAnswered: 0,
  byTopic: {
    math: { correct: 0, answered: 0 },
    sentence: { correct: 0, answered: 0 },
    relations: { correct: 0, answered: 0 },
    shapes: { correct: 0, answered: 0 },
    sequences: { correct: 0, answered: 0 },
    oddOneOut: { correct: 0, answered: 0 },
  },
  unlockedWeapons: ["single"],
  currentWeapon: "single",
  // Per-ship state. Each ship has its own upgrades + nickname.
  // Migrated from old global `upgrades` if present.
  ships: {
    scout: { unlocked: true, upgrades: EMPTY_SHIP_UPGRADES(), nickname: "" },
  },
  currentShip: "scout",
  // Achievement IDs the player has earned (used to unlock special ships).
  achievementsEarned: [],
  // Daily streak
  streak: { lastDate: null, consecutive: 0 },
  bestiary: [],
  achievements: [],
  questionStats: {},
};

function freshStore() {
  return { profiles: [], activeId: null };
}

function migrateProgress(p) {
  // Ensure new fields exist on old profiles
  if (!p.ships) {
    p.ships = { scout: { unlocked: true, upgrades: EMPTY_SHIP_UPGRADES(), nickname: "" } };
    // Migrate global upgrades onto scout
    if (p.upgrades) {
      p.ships.scout.upgrades = { ...EMPTY_SHIP_UPGRADES(), ...p.upgrades };
    }
  }
  if (!p.currentShip) p.currentShip = "scout";
  if (!p.achievementsEarned) p.achievementsEarned = [];
  if (!p.streak) p.streak = { lastDate: null, consecutive: 0 };
  return p;
}

function read() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return freshStore();
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.profiles)) return freshStore();
    for (const p of parsed.profiles) if (p.progress) migrateProgress(p.progress);
    return parsed;
  } catch {
    return freshStore();
  }
}

function write(store) {
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

export function listProfiles() {
  return read().profiles;
}

export function getActiveProfile() {
  const s = read();
  if (!s.activeId) return null;
  return s.profiles.find((p) => p.id === s.activeId) || null;
}

export function setActiveProfile(id) {
  const s = read();
  if (!s.profiles.find((p) => p.id === id)) return false;
  s.activeId = id;
  write(s);
  return true;
}

export function createProfile(name) {
  const s = read();
  const trimmed = (name || "").trim();
  if (!trimmed) return null;
  const id = `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const profile = {
    id,
    name: trimmed,
    createdAt: Date.now(),
    lastPlayedAt: Date.now(),
    progress: structuredClone(DEFAULT_PROGRESS),
  };
  s.profiles.push(profile);
  s.activeId = id;
  write(s);
  return profile;
}

export function deleteProfile(id) {
  const s = read();
  s.profiles = s.profiles.filter((p) => p.id !== id);
  if (s.activeId === id) s.activeId = s.profiles[0]?.id || null;
  write(s);
}

export function updateActiveProgress(updater) {
  const s = read();
  const p = s.profiles.find((x) => x.id === s.activeId);
  if (!p) return null;
  updater(p.progress);
  p.lastPlayedAt = Date.now();
  write(s);
  return p.progress;
}

export function recordAnswer({ topic, questionId, correct }) {
  return updateActiveProgress((prog) => {
    prog.totalAnswered += 1;
    if (correct) prog.totalCorrect += 1;
    if (!prog.byTopic[topic]) prog.byTopic[topic] = { correct: 0, answered: 0 };
    prog.byTopic[topic].answered += 1;
    if (correct) prog.byTopic[topic].correct += 1;
    const stat = prog.questionStats[questionId] || { seen: 0, correct: 0 };
    stat.seen += 1;
    if (correct) stat.correct += 1;
    prog.questionStats[questionId] = stat;
  });
}

// Returns { rankUp: { from, to, bonusCoins } } if a new rank was reached.
export function addXP(amount) {
  let rankUp = null;
  updateActiveProgress((p) => {
    const before = p.xp || 0;
    const after = Math.max(0, before + amount);
    p.xp = after;
    if (amount > 0) {
      // Lazy import to avoid circular dependency at module load
      try {
        const RANKS = [
          { id: "recruit", minXp: 0, bonusCoins: 0 },
          { id: "trainee", minXp: 100, bonusCoins: 5 },
          { id: "pilot", minXp: 300, bonusCoins: 10 },
          { id: "veteran", minXp: 600, bonusCoins: 15 },
          { id: "captain", minXp: 1000, bonusCoins: 20 },
          { id: "major", minXp: 1500, bonusCoins: 25 },
          { id: "commander", minXp: 2200, bonusCoins: 35 },
          { id: "general", minXp: 3000, bonusCoins: 50 },
          { id: "admiral", minXp: 4000, bonusCoins: 75 },
        ];
        const rankFor = (xp) => RANKS.reduce((acc, r) => xp >= r.minXp ? r : acc, RANKS[0]);
        const before_r = rankFor(before);
        const after_r = rankFor(after);
        if (after_r.id !== before_r.id && after_r.minXp > before_r.minXp) {
          p.coins = (p.coins || 0) + after_r.bonusCoins;
          rankUp = { fromId: before_r.id, toId: after_r.id, bonusCoins: after_r.bonusCoins };
        }
      } catch {}
    }
  });
  return rankUp;
}

export function addCoins(amount) {
  return updateActiveProgress((p) => { p.coins = Math.max(0, (p.coins || 0) + amount); });
}

export function spendCoins(amount) {
  let success = false;
  updateActiveProgress((p) => {
    if ((p.coins || 0) >= amount) { p.coins -= amount; success = true; }
  });
  return success;
}

// Upgrades are per-ship now. shipId defaults to currentShip.
export function purchaseUpgrade(upgradeId, shipId) {
  return updateActiveProgress((p) => {
    const sid = shipId || p.currentShip || "scout";
    if (!p.ships) p.ships = {};
    if (!p.ships[sid]) p.ships[sid] = { unlocked: true, upgrades: EMPTY_SHIP_UPGRADES(), nickname: "" };
    if (!p.ships[sid].upgrades) p.ships[sid].upgrades = EMPTY_SHIP_UPGRADES();
    p.ships[sid].upgrades[upgradeId] = (p.ships[sid].upgrades[upgradeId] || 0) + 1;
  });
}

// Get upgrades for a specific ship (or current if not specified).
export function getShipUpgrades(shipId) {
  const p = getActiveProfile()?.progress;
  if (!p) return EMPTY_SHIP_UPGRADES();
  const sid = shipId || p.currentShip || "scout";
  return p.ships?.[sid]?.upgrades || EMPTY_SHIP_UPGRADES();
}

export function unlockShip(shipId) {
  return updateActiveProgress((p) => {
    if (!p.ships) p.ships = {};
    if (!p.ships[shipId]) p.ships[shipId] = { unlocked: true, upgrades: EMPTY_SHIP_UPGRADES(), nickname: "" };
    else p.ships[shipId].unlocked = true;
  });
}

export function setActiveShip(shipId) {
  return updateActiveProgress((p) => {
    if (p.ships?.[shipId]?.unlocked) p.currentShip = shipId;
  });
}

export function setShipNickname(shipId, nickname) {
  return updateActiveProgress((p) => {
    if (p.ships?.[shipId]) p.ships[shipId].nickname = (nickname || "").slice(0, 18);
  });
}

export function recordAchievement(achievementId) {
  let isNew = false;
  updateActiveProgress((p) => {
    if (!p.achievementsEarned) p.achievementsEarned = [];
    if (!p.achievementsEarned.includes(achievementId)) {
      p.achievementsEarned.push(achievementId);
      isNew = true;
    }
  });
  return isNew;
}

export function hasAchievement(achievementId) {
  return getActiveProfile()?.progress?.achievementsEarned?.includes(achievementId) || false;
}

// Daily streak — call once on boot. Returns { streak, isNewDay, isReset, bonusCoins }.
export function tickDailyStreak() {
  let result = { consecutive: 0, isNewDay: false, isReset: false, bonusCoins: 0 };
  updateActiveProgress((p) => {
    if (!p.streak) p.streak = { lastDate: null, consecutive: 0 };
    const today = new Date().toISOString().slice(0, 10);
    const last = p.streak.lastDate;
    if (last === today) {
      result.consecutive = p.streak.consecutive;
      return;
    }
    result.isNewDay = true;
    if (!last) {
      p.streak.consecutive = 1;
    } else {
      const lastDate = new Date(last + "T00:00:00");
      const now = new Date(today + "T00:00:00");
      const dayDiff = Math.round((now - lastDate) / (24 * 3600 * 1000));
      if (dayDiff === 1) {
        p.streak.consecutive = (p.streak.consecutive || 0) + 1;
      } else {
        p.streak.consecutive = 1;
        result.isReset = true;
      }
    }
    p.streak.lastDate = today;
    // Reward at every 7-day milestone
    if (p.streak.consecutive % 7 === 0 && p.streak.consecutive > 0) {
      p.coins = (p.coins || 0) + 20;
      result.bonusCoins = 20;
    }
    result.consecutive = p.streak.consecutive;
  });
  return result;
}

// Reset progress for the active profile — keeps the profile + name, wipes all stats/upgrades/coins/level.
export function resetActiveProgress() {
  return updateActiveProgress((p) => {
    const fresh = structuredClone(DEFAULT_PROGRESS);
    Object.keys(p).forEach((k) => delete p[k]);
    Object.assign(p, fresh);
  });
}

export function unlockWeapon(weaponId) {
  return updateActiveProgress((p) => {
    if (!p.unlockedWeapons.includes(weaponId)) p.unlockedWeapons.push(weaponId);
  });
}

export function setCurrentWeapon(weaponId) {
  return updateActiveProgress((p) => { p.currentWeapon = weaponId; });
}

export function recordEnemySeen(enemyId) {
  return updateActiveProgress((p) => {
    if (!p.bestiary.includes(enemyId)) p.bestiary.push(enemyId);
  });
}
