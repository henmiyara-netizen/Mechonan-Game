// Pilot rank system — XP determines a rank (title) that the player advances through.
// Each new rank also pays a bonus in coins.

const RANKS = [
  { id: "recruit",    name: "טירון",        minXp: 0,    bonusCoins: 0,  emoji: "🎓" },
  { id: "trainee",    name: "חניך טייס",    minXp: 100,  bonusCoins: 5,  emoji: "✈️" },
  { id: "pilot",      name: "טייס",         minXp: 300,  bonusCoins: 10, emoji: "🛩️" },
  { id: "veteran",    name: "טייס ותיק",   minXp: 600,  bonusCoins: 15, emoji: "🚀" },
  { id: "captain",    name: "סרן",         minXp: 1000, bonusCoins: 20, emoji: "🌟" },
  { id: "major",      name: "רב-סרן",      minXp: 1500, bonusCoins: 25, emoji: "💫" },
  { id: "commander",  name: "סגן-אלוף",    minXp: 2200, bonusCoins: 35, emoji: "🪐" },
  { id: "general",    name: "אלוף-משנה",   minXp: 3000, bonusCoins: 50, emoji: "👑" },
  { id: "admiral",    name: "אלוף החלל",   minXp: 4000, bonusCoins: 75, emoji: "🏆" },
];

export function getRankForXp(xp) {
  let currentRank = RANKS[0];
  for (const r of RANKS) if (xp >= r.minXp) currentRank = r;
  return currentRank;
}

export function getNextRank(xp) {
  for (const r of RANKS) if (r.minXp > xp) return r;
  return null; // already at max rank
}

export function progressToNextRank(xp) {
  const current = getRankForXp(xp);
  const next = getNextRank(xp);
  if (!next) return { current, next: null, percent: 100, xpToNext: 0 };
  const range = next.minXp - current.minXp;
  const inRange = xp - current.minXp;
  return { current, next, percent: Math.min(100, (inRange / range) * 100), xpToNext: next.minXp - xp };
}

export function getAllRanks() { return RANKS.slice(); }
