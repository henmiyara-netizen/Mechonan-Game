// Question bank — loads all topic JSONs and provides a smart picker.
// Picker prefers questions the active profile has seen less, with anti-repeat.

import { getActiveProfile } from "./profiles.js";

const TOPIC_FILES = {
  math: "./src/content/questions/math.json",
  sentence: "./src/content/questions/sentence-completion.json",
  relations: "./src/content/questions/word-relations.json",
  shapes: "./src/content/questions/shapes.json",
  sequences: "./src/content/questions/sequences.json",
  oddOneOut: "./src/content/questions/odd-one-out.json",
};

const pools = {};                    // topic -> [questions]
const recent = { _all: [] };         // recent questionIds (for anti-repeat)
const RECENT_WINDOW = 4;

export async function loadAllQuestions() {
  for (const topic of Object.keys(TOPIC_FILES)) {
    try {
      const r = await fetch(TOPIC_FILES[topic]);
      const data = await r.json();
      const valid = (data.questions || []).filter((q) => !q._disabled && Array.isArray(q.choices) && q.choices.length === 4);
      pools[topic] = valid.map((q) => ({ ...q, topic }));
    } catch (e) {
      console.error(`Failed to load ${topic}:`, e);
      pools[topic] = [];
    }
  }
  return pools;
}

export function pickQuestion(topic, opts = {}) {
  const requested = topic;
  let pool = pools[requested];
  if (!pool || pool.length === 0) {
    // Fallback: any non-empty pool
    pool = Object.values(pools).flat();
    if (pool.length === 0) return null;
  }

  const profile = getActiveProfile();
  const stats = profile?.progress.questionStats || {};

  // Score: lower = better. Combine "seen less" + "recently shown penalty".
  const recentSet = new Set(recent._all.slice(-RECENT_WINDOW));
  const candidates = pool
    .map((q) => {
      const s = stats[q.id] || { seen: 0, correct: 0 };
      const recencyPenalty = recentSet.has(q.id) ? 1000 : 0;
      const seenScore = s.seen * 4;
      const wrongBonus = (s.seen - s.correct) * -1; // questions answered wrong recently are good to revisit
      return { q, score: seenScore + recencyPenalty + wrongBonus + Math.random() * 2 };
    })
    .sort((a, b) => a.score - b.score);

  const chosen = candidates[0]?.q;
  if (!chosen) return null;
  recent._all.push(chosen.id);
  if (recent._all.length > RECENT_WINDOW * 4) recent._all.shift();
  return chosen;
}

export function pickQuestions(topic, count) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const q = pickQuestion(topic);
    if (q) out.push(q);
  }
  return out;
}

export function topicCount(topic) { return pools[topic]?.length || 0; }
