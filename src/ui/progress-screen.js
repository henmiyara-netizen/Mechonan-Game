// Progress screen — shows XP, level, accuracy per topic, unlocked weapons & bestiary.

import { getActiveProfile, resetActiveProgress } from "../store/profiles.js";
import { WEAPONS } from "../entities/player.js";
import { sfx } from "../audio/sfx-manager.js";
import { showConfirm } from "./modal.js";
import { progressToNextRank } from "../store/rank.js";

const TOPIC_LABEL = {
  math: "חשבון",
  sentence: "השלמת משפטים",
  relations: "יחסי מילים",
  shapes: "צורות",
  sequences: "סדרות",
  oddOneOut: "יוצא דופן",
};

const root = document.getElementById("progress-stats");
const backBtn = document.getElementById("btn-progress-back");

export function renderProgress() {
  const profile = getActiveProfile();
  if (!profile) {
    root.textContent = "אין נתונים — בחר טייס תחילה.";
    return;
  }
  const p = profile.progress;
  root.innerHTML = "";

  // Rank header
  const { current, next, xpToNext, percent } = progressToNextRank(p.xp || 0);
  const rankBox = document.createElement("div");
  rankBox.style.cssText = "background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; padding: 14px 18px; display: flex; align-items: center; gap: 14px; margin-bottom: 12px;";
  rankBox.innerHTML = `
    <div style="font-size: 42px;">${current.emoji}</div>
    <div style="flex: 1;">
      <div style="font-size: 12px; color: var(--text-dim);">דרגה</div>
      <div style="font-size: 22px; font-weight: 800; color: var(--accent-warm);">${current.name}</div>
      <div style="font-size: 12px; color: var(--text-dim); margin-top: 4px;">
        ${next ? `${p.xp} XP · עוד ${xpToNext} XP לדרגת ${next.name}` : `${p.xp} XP — דרגה מקסימלית!`}
      </div>
      <div class="topic-row__bar" style="margin-top: 6px;">
        <div class="topic-row__fill" style="width: ${percent}%"></div>
      </div>
    </div>
  `;
  root.appendChild(rankBox);

  // Top stats grid
  const grid = document.createElement("div");
  grid.className = "stats-grid";
  grid.appendChild(stat("שלב נוכחי", p.level));
  grid.appendChild(stat("שלב מקסימלי", p.highestLevel));
  grid.appendChild(stat("מטבעות 🪙", p.coins || 0));
  const total = p.totalAnswered;
  const acc = total ? Math.round((p.totalCorrect / total) * 100) : 0;
  grid.appendChild(stat("דיוק כללי", `${acc}%`));
  root.appendChild(grid);

  // Per-topic accuracy
  const topicWrap = document.createElement("div");
  topicWrap.style.marginTop = "20px";
  const h = document.createElement("h2");
  h.textContent = "דיוק לפי פרק";
  h.style.cssText = "font-size: 18px; margin-bottom: 10px;";
  topicWrap.appendChild(h);

  for (const [tid, label] of Object.entries(TOPIC_LABEL)) {
    const t = p.byTopic[tid] || { correct: 0, answered: 0 };
    const pct = t.answered ? Math.round((t.correct / t.answered) * 100) : 0;
    const row = document.createElement("div");
    row.className = "topic-row";
    row.style.flexDirection = "column";
    row.style.alignItems = "stretch";

    const top = document.createElement("div");
    top.style.cssText = "display:flex; align-items:center; gap:10px; width:100%;";
    const nm = document.createElement("span");
    nm.className = "topic-row__name";
    nm.textContent = label;
    const val = document.createElement("span");
    val.className = "topic-row__value";
    val.textContent = `${pct}% (${t.correct}/${t.answered})`;
    top.appendChild(nm);
    top.appendChild(val);
    row.appendChild(top);

    const bar = document.createElement("div");
    bar.className = "topic-row__bar";
    const fill = document.createElement("div");
    fill.className = "topic-row__fill";
    fill.style.width = `${pct}%`;
    bar.appendChild(fill);
    row.appendChild(bar);

    topicWrap.appendChild(row);
  }
  root.appendChild(topicWrap);

  // Weapons gallery
  const wWrap = document.createElement("div");
  wWrap.style.marginTop = "20px";
  const wh = document.createElement("h2");
  wh.textContent = "נשקי הטייס שלי";
  wh.style.cssText = "font-size: 18px; margin-bottom: 10px;";
  wWrap.appendChild(wh);
  for (const id of p.unlockedWeapons) {
    const w = WEAPONS[id];
    if (!w) continue;
    const row = document.createElement("div");
    row.className = "topic-row";
    const nm = document.createElement("span");
    nm.className = "topic-row__name";
    nm.textContent = `🔫 ${w.name}`;
    row.appendChild(nm);
    if (id === p.currentWeapon) {
      const tag = document.createElement("span");
      tag.className = "topic-row__value";
      tag.textContent = "פעיל";
      row.appendChild(tag);
    }
    wWrap.appendChild(row);
  }
  root.appendChild(wWrap);

  // Bestiary count
  if (p.bestiary?.length) {
    const bWrap = document.createElement("div");
    bWrap.style.marginTop = "20px";
    const bh = document.createElement("h2");
    bh.textContent = `אויבים שראית: ${p.bestiary.length}`;
    bh.style.cssText = "font-size: 18px;";
    bWrap.appendChild(bh);
    root.appendChild(bWrap);
  }

  // Reset progress button
  const resetWrap = document.createElement("div");
  resetWrap.style.marginTop = "30px";
  resetWrap.style.paddingTop = "20px";
  resetWrap.style.borderTop = "1px solid var(--border)";
  const resetBtn = document.createElement("button");
  resetBtn.className = "btn btn--danger";
  resetBtn.textContent = "🔄 אפס התקדמות";
  resetBtn.addEventListener("click", async () => {
    sfx.play("ui.click");
    const ok = await showConfirm({
      title: "איפוס התקדמות",
      message: `כל ההתקדמות של "${profile.name}" תאבד: השלבים, ה-XP, המטבעות, הנשקים, השדרוגים והסטטיסטיקה. הטייס עצמו יישאר. האם להמשיך?`,
      confirmLabel: "אפס הכל",
      cancelLabel: "ביטול",
      danger: true,
    });
    if (ok) {
      resetActiveProgress();
      sfx.play("ui.back");
      renderProgress();
    }
  });
  resetWrap.appendChild(resetBtn);
  root.appendChild(resetWrap);
}

function stat(label, value) {
  const card = document.createElement("div");
  card.className = "stat-card";
  const l = document.createElement("span");
  l.className = "stat-card__label";
  l.textContent = label;
  const v = document.createElement("span");
  v.className = "stat-card__value";
  v.textContent = value;
  card.appendChild(l);
  card.appendChild(v);
  return card;
}

export function bindProgressScreen({ onBack }) {
  backBtn.addEventListener("click", () => {
    sfx.play("ui.back");
    onBack();
  });
}
