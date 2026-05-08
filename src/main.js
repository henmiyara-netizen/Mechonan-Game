// Boot + orchestration entry point.

import { sfx } from "./audio/sfx-manager.js";
import { showScreen, registerScreen, hideOverlay } from "./ui/screens.js";
import { showAlert, showConfirm } from "./ui/modal.js";
import { renderProfiles, bindProfilePicker } from "./ui/profile-picker.js";
import { renderProgress, bindProgressScreen } from "./ui/progress-screen.js";
import { Hud } from "./ui/hud.js";
import { showQuestion } from "./ui/question-overlay.js";
import { runMidtest } from "./ui/midtest.js";
import { openShop } from "./ui/shop.js";
import { openPractice } from "./ui/practice.js";
import { openHangar } from "./ui/hangar.js";
import { Game } from "./engine/game.js";
import {
  getActiveProfile, listProfiles, updateActiveProgress, addXP, addCoins, recordAchievement, hasAchievement, unlockShip, tickDailyStreak,
} from "./store/profiles.js";
import { getRankForXp, progressToNextRank } from "./store/rank.js";
import { loadAllQuestions, pickQuestion } from "./store/question-bank.js";

// Register all screens
["splash", "profiles", "menu", "game", "question", "progress"].forEach(registerScreen);

// Service worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

// Fetch level definitions
async function loadLevels() {
  const r = await fetch("./src/content/levels.json");
  const data = await r.json();
  return data.levels;
}

let LEVELS = [];
let game = null;
const canvas = document.getElementById("game-canvas");

async function boot() {
  // Splash for ~700ms while loading content
  showScreen("splash");
  try {
    await Promise.all([
      loadAllQuestions(),
      loadLevels().then((lv) => { LEVELS = lv; }),
    ]);
  } catch (e) {
    console.error(e);
    await showAlert({ title: "שגיאה בטעינה", message: "לא הצלחתי לטעון את התוכן. נסה לרענן את הדף." });
  }
  await sleep(600);

  // First-time unlock SFX context (will retry on first user gesture)
  document.addEventListener("pointerdown", () => sfx.unlock(), { once: true });
  document.addEventListener("keydown", () => sfx.unlock(), { once: true });

  // Decide initial screen + daily streak check
  if (listProfiles().length === 0 || !getActiveProfile()) {
    showScreen("profiles");
  } else {
    const streakResult = tickDailyStreak();
    if (streakResult.isNewDay) {
      let msg = `רצף יומי: ${streakResult.consecutive} ימים ברציפות!`;
      if (streakResult.bonusCoins) msg += `\n🪙 בונוס מיוחד: +${streakResult.bonusCoins} מטבעות!`;
      if (streakResult.consecutive >= 2) {
        sfx.play("powerup.weapon");
        await showAlert({ title: `🔥 רצף ${streakResult.consecutive}`, message: msg, confirmLabel: "המשך!" });
      }
    }
    enterMenu();
  }
}

function enterMenu() {
  const profile = getActiveProfile();
  if (!profile) { showScreen("profiles"); return; }
  document.getElementById("menu-pilot-name").textContent = profile.name;
  // Show pilot rank based on XP, not stage level
  const xp = profile.progress.xp || 0;
  const { current, next, percent, xpToNext } = progressToNextRank(xp);
  const rankEl = document.getElementById("menu-level");
  if (rankEl) rankEl.textContent = `${current.emoji} ${current.name}`;
  document.getElementById("menu-xp-fill").style.width = percent + "%";
  // Tooltip with XP info
  const progressBox = rankEl?.parentElement;
  if (progressBox) progressBox.title = next
    ? `${xp} XP — עוד ${xpToNext} XP לדרגה הבאה (${next.name})`
    : `${xp} XP — דרגה מקסימלית!`;
  showScreen("menu");
}

// ===== Profile picker wiring =====
bindProfilePicker({ onSelect: enterMenu });

// ===== Menu wiring =====
document.getElementById("btn-switch-profile").addEventListener("click", () => {
  sfx.play("ui.back");
  renderProfiles({ onSelect: enterMenu });
  showScreen("profiles");
});
document.getElementById("btn-progress").addEventListener("click", () => {
  sfx.play("ui.click");
  renderProgress();
  showScreen("progress");
});
document.getElementById("btn-credits").addEventListener("click", async () => {
  sfx.play("ui.click");
  await showAlert({
    title: "מסע חכם בגלקסיה",
    message: "משחק עזר להכנה למבחן המחוננים שלב ב'.\nפותח באהבה לבן (-:\nשאלות: מכון מיחונן (mihonan.co.il).",
    confirmLabel: "תודה!",
  });
});
document.getElementById("btn-play").addEventListener("click", () => {
  sfx.play("ui.click");
  startCurrentLevel();
});
document.getElementById("btn-shop").addEventListener("click", () => {
  sfx.play("ui.click");
  openShop({ onClose: () => enterMenu() });
});
document.getElementById("btn-hangar").addEventListener("click", () => {
  sfx.play("ui.click");
  openHangar({ onClose: () => enterMenu() });
});
document.getElementById("btn-practice").addEventListener("click", () => {
  sfx.play("ui.click");
  openPractice({ onClose: () => enterMenu() });
});

// ===== Progress screen =====
bindProgressScreen({ onBack: () => { sfx.play("ui.back"); enterMenu(); } });

// ===== Game pause button =====
document.getElementById("btn-pause").addEventListener("click", async () => {
  if (!game) return;
  sfx.play("ui.click");
  game.pause();
  const choice = await showConfirm({
    title: "השהיה",
    message: "מה לעשות?",
    confirmLabel: "המשך לשחק",
    cancelLabel: "צא לתפריט",
  });
  if (choice) {
    game.resume();
  } else {
    game.stop();
    game = null;
    enterMenu();
  }
});

// ===== Game launch =====
// Cache loaded ships roster for the Game class to access
let SHIPS_ROSTER = null;
async function loadShipsRoster() {
  if (SHIPS_ROSTER) return SHIPS_ROSTER;
  const r = await fetch("./src/content/ships.json");
  const data = await r.json();
  SHIPS_ROSTER = data.ships;
  return SHIPS_ROSTER;
}

async function startCurrentLevel() {
  const profile = getActiveProfile();
  if (!profile) { showScreen("profiles"); return; }
  const lvIndex = Math.min(profile.progress.level, LEVELS.length) - 1;
  const lvDef = LEVELS[lvIndex];
  if (!lvDef) {
    await showAlert({
      title: "כל הכבוד!",
      message: "סיימת את כל השלבים הזמינים בגרסה הזו של המשחק. שלבים נוספים יתווספו בקרוב!",
      confirmLabel: "אדיר",
    });
    enterMenu();
    return;
  }

  // Mid-test gate (boss level)
  if (lvDef.isMidtest && !profile.progress[`midtest_${lvDef.id}_done`]) {
    await runMidtest({
      topics: lvDef.midtest.topics,
      questionsPerTopic: lvDef.midtest.questionsPerTopic,
      levelId: lvDef.id,
      onAfter: () => {
        updateActiveProgress((p) => { p[`midtest_${lvDef.id}_done`] = true; });
      },
    });
  }

  showScreen("game");

  game = new Game({
    canvas,
    hud: Hud,
    askQuestion: handleAskQuestion,
    onLevelComplete: handleLevelComplete,
    onGameOver: handleGameOver,
  });
  game.shipsRoster = await loadShipsRoster();
  setTimeout(() => game._resize(), 50);
  game.startLevel(lvDef);
}

async function handleAskQuestion({ topic, kind }) {
  const q = pickQuestion(topic);
  if (!q) return null;
  if (kind === "asteroid") {
    return { question: q, correctIndex: q.correctIndex };
  }
  // Popup mode
  const res = await showQuestion({ question: q, counterLabel: "" });
  if (res.correct) {
    const ru = addXP(20);
    addCoins(2);
    if (ru) await celebrateRankUp(ru);
  }
  // Track
  const { recordAnswer } = await import("./store/profiles.js");
  recordAnswer({ topic: q.topic, questionId: q.id, correct: res.correct });
  return { correct: res.correct, choiceIndex: res.choiceIndex };
}

async function celebrateRankUp(ru) {
  const ranks = (await import("./store/rank.js")).getAllRanks();
  const r = ranks.find((x) => x.id === ru.toId);
  if (!r) return;
  sfx.play("midtest.fanfare");
  await showAlert({
    title: `${r.emoji} עלית דרגה!`,
    message: `הדרגה החדשה שלך: ${r.name}\nקיבלת ${ru.bonusCoins} מטבעות בונוס!`,
    confirmLabel: "אדיר!",
  });
}

async function handleLevelComplete(lvDef, meta = {}) {
  game?.stop();
  game = null;

  // Level gating: if any end-of-level question was answered wrong, don't advance level.
  if (!meta.allEndQuestionsCorrect && meta.endQuestionsAsked > 0) {
    sfx.play("ui.back");
    await showAlert({
      title: "כמעט הצלחת!",
      message: `סיימת את הירי, אבל ענית נכון על ${meta.endQuestionsCorrect} מתוך ${meta.endQuestionsAsked} שאלות בשלב זה.\nכדי לעבור לשלב הבא צריך לענות נכון על כולן.\nנסה שוב את אותו שלב!`,
      confirmLabel: "אשתדל שוב!",
    });
    enterMenu();
    return;
  }

  // Bump player progress + level reward
  addCoins(5);
  const profile = updateActiveProgress((p) => {
    if (lvDef.id >= p.level) p.level = Math.min(lvDef.id + 1, LEVELS.length + 1);
    if (lvDef.id > p.highestLevel) p.highestLevel = lvDef.id;
  });

  // Achievement: level 15 perfect (no life lost)
  if (lvDef.id === 15 && !meta.lostLifeThisLevel && !hasAchievement("level15Perfect")) {
    if (recordAchievement("level15Perfect")) {
      sfx.play("midtest.fanfare");
      await showAlert({
        title: "🏆 הישג חדש!",
        message: "סיימת שלב 15 ללא איבוד אף חיים!\nהחללית 👻 פאנטום זמינה לפתיחה במוסך.",
        confirmLabel: "מגניב!",
      });
    }
  }
  // Achievement: defeat boss at level 30
  if (lvDef.id === 30 && !hasAchievement("boss30")) {
    if (recordAchievement("boss30")) {
      sfx.play("midtest.fanfare");
      await showAlert({
        title: "🏆 הישג אגדי!",
        message: "נצחת את הבוס בשלב 30!\nהחללית 🌌 סופר-נובה זמינה לפתיחה במוסך.",
        confirmLabel: "אדיר!",
      });
    }
  }

  // Stat snapshot for this level
  const accForLevel = (() => {
    if (!profile) return 0;
    const t = profile.totalAnswered;
    return t ? Math.round((profile.totalCorrect / t) * 100) : 0;
  })();

  await showAlert({
    title: `שלב ${lvDef.id} — הושלם! 🚀`,
    message: `${lvDef.name}\nקיבלת 5 מטבעות בונוס. דיוק כללי: ${accForLevel}%.`,
    confirmLabel: "לחנות!",
  });
  // Open shop, then return to menu
  openShop({ onClose: () => enterMenu() });
}

async function handleGameOver() {
  game?.stop();
  game = null;
  const choice = await showConfirm({
    title: "💥 הפסדת",
    message: "החללית התפוצצה. רוצה לנסות שוב?",
    confirmLabel: "ננסה שוב!",
    cancelLabel: "חזרה לתפריט",
  });
  if (choice) {
    startCurrentLevel();
  } else {
    enterMenu();
  }
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// Boot
boot();
