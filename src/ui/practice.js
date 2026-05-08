// Practice mode — earn or lose coins by answering questions on chosen topic.
// Rules: must have >= 1 coin to enter; +1 coin correct, -1 coin wrong; exit when out of coins or by player choice.

import { showQuestion } from "./question-overlay.js";
import { pickQuestion, topicCount } from "../store/question-bank.js";
import { sfx } from "../audio/sfx-manager.js";
import { showAlert, showConfirm } from "./modal.js";
import { showOverlay, hideOverlay } from "./screens.js";
import { getActiveProfile, addCoins, recordAnswer } from "../store/profiles.js";

const TOPICS = [
  { id: "math", label: "חשבון", emoji: "➕" },
  { id: "sentence", label: "השלמת משפטים", emoji: "📝" },
  { id: "relations", label: "יחסי מילים", emoji: "🔗" },
  { id: "oddOneOut", label: "יוצא דופן", emoji: "🎯" },
  { id: "shapes", label: "צורות", emoji: "🔷" },
  { id: "sequences", label: "סדרות בצורות", emoji: "🔢" },
];

export async function openPractice({ onClose }) {
  const profile = getActiveProfile();
  const coins = profile?.progress.coins ?? 0;
  if (coins < 1) {
    await showAlert({
      title: "אין לך מטבעות",
      message: "צריך לפחות מטבע אחד כדי להיכנס לתרגול. שחק שלב במשימה כדי להרוויח מטבעות.",
      confirmLabel: "בסדר",
    });
    onClose?.();
    return;
  }
  showTopicPicker(onClose);
}

function getOrCreateScreen() {
  let screen = document.getElementById("screen-practice");
  if (screen) return screen;
  screen = document.createElement("section");
  screen.id = "screen-practice";
  screen.className = "screen screen--overlay";
  document.querySelector("#app").appendChild(screen);
  return screen;
}

function showTopicPicker(onClose) {
  const profile = getActiveProfile();
  const screen = getOrCreateScreen();
  const coins = profile?.progress.coins ?? 0;
  screen.innerHTML = `
    <div class="container practice-container">
      <header class="practice-header">
        <button id="prc-back" class="btn btn--ghost btn--small">← חזרה</button>
        <h1 class="title">תתרגל ותרוויח</h1>
        <div class="practice-coins">🪙 <strong id="prc-coins">${coins}</strong></div>
      </header>
      <p class="practice-intro">בחר פרק שאלות. <strong>+1 מטבע</strong> לתשובה נכונה, <strong>-1 מטבע</strong> לטעות.</p>
      <ul id="prc-topic-list" class="practice-topic-list"></ul>
    </div>
  `;
  const list = screen.querySelector("#prc-topic-list");
  for (const topic of TOPICS) {
    const count = topicCount(topic.id);
    if (count === 0) continue;
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.className = "practice-topic-btn";
    btn.innerHTML = `
      <span class="practice-topic-btn__emoji">${topic.emoji}</span>
      <span class="practice-topic-btn__label">${topic.label}</span>
      <span class="practice-topic-btn__count">${count} שאלות</span>
    `;
    btn.addEventListener("click", () => {
      sfx.play("ui.click");
      runPracticeSession(topic, onClose);
    });
    li.appendChild(btn);
    list.appendChild(li);
  }
  screen.querySelector("#prc-back").addEventListener("click", () => {
    sfx.play("ui.back");
    hideOverlay("practice");
    onClose?.();
  });
  showOverlay("practice");
}

async function runPracticeSession(topic, onClose) {
  hideOverlay("practice");
  let stats = { asked: 0, correct: 0, wrong: 0, earned: 0 };

  while (true) {
    const profile = getActiveProfile();
    const coins = profile?.progress.coins ?? 0;
    if (coins < 1) {
      await showAlert({
        title: "נגמרו לך המטבעות",
        message: `סיימת את התרגול! ענית על ${stats.asked} שאלות (${stats.correct} נכונות, ${stats.wrong} שגויות). חזור לשלבים כדי להרוויח עוד מטבעות.`,
        confirmLabel: "סגור",
      });
      onClose?.();
      return;
    }

    const q = pickQuestion(topic.id);
    if (!q) {
      await showAlert({
        title: "אין יותר שאלות",
        message: `אין שאלות זמינות בפרק "${topic.label}".`,
        confirmLabel: "סגור",
      });
      onClose?.();
      return;
    }

    const counterLabel = `${topic.label} · 🪙 ${coins}`;
    const res = await showQuestion({
      question: q,
      counterLabel,
      allowExit: true,
      exitMessage: "אם תצא עכשיו ירד לך מטבע אחד. בטוח שאתה רוצה לצאת?",
    });

    // Player chose to exit mid-question — penalize and end session
    if (res.exited) {
      addCoins(-1);
      await showAlert({
        title: "יצאת מהתרגול",
        message: `יצאת באמצע השאלה — ירד לך מטבע אחד.\nענית בסה"כ ${stats.asked} שאלות (${stats.correct} נכונות).`,
        confirmLabel: "סגור",
      });
      onClose?.();
      return;
    }

    stats.asked += 1;
    recordAnswer({ topic: q.topic, questionId: q.id, correct: res.correct });
    if (res.correct) {
      stats.correct += 1; stats.earned += 1; addCoins(1);
    } else {
      stats.wrong += 1; stats.earned -= 1; addCoins(-1);
    }

    // After EVERY question — ask continue or stop
    const newCoins = getActiveProfile()?.progress.coins ?? 0;
    const cont = await showConfirm({
      title: res.correct ? "תשובה נכונה! 🎉" : "טעית — נסה שוב בשאלה הבאה",
      message: `ענית ${stats.asked} שאלות (${stats.correct} נכונות).\nרווח: ${stats.earned >= 0 ? "+" : ""}${stats.earned} מטבעות. סך הכל יש לך ${newCoins} 🪙.\nלהמשיך לשאלה נוספת?`,
      confirmLabel: "עוד שאלה!",
      cancelLabel: "סיום תרגול",
    });
    if (!cont) {
      onClose?.();
      return;
    }
  }
}
