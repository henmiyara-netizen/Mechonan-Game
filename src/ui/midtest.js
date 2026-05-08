// Mid-test flow — for boss levels (every 10). Runs N questions per topic in sequence,
// then awards an "epic" upgrade based on score.

import { showQuestion } from "./question-overlay.js";
import { pickQuestion } from "../store/question-bank.js";
import { sfx } from "../audio/sfx-manager.js";
import { showAlert } from "./modal.js";
import { recordAnswer, addXP, unlockWeapon, setCurrentWeapon } from "../store/profiles.js";

const TOPIC_LABEL = {
  math: "חשבון",
  sentence: "השלמת משפטים",
  relations: "יחסי מילים",
  shapes: "צורות",
  sequences: "סדרות",
  oddOneOut: "יוצא דופן",
};

export async function runMidtest({ topics, questionsPerTopic = 3, levelId = 10, onAfter }) {
  sfx.play("alert");
  await showAlert({
    title: `🚨 מבחן בוס — שלב ${levelId}`,
    message: `לפני שאתה ממשיך, חייבים לעבור מבחן ביניים.\n${topics.length} פרקים, ${questionsPerTopic} שאלות בכל פרק.\nכל הצלחה תיתן לך שדרוג אפי!`,
    confirmLabel: "מתחילים!",
  });
  sfx.play("midtest.fanfare");

  const total = topics.length * questionsPerTopic;
  let counter = 0;
  let correct = 0;

  for (const topic of topics) {
    for (let i = 0; i < questionsPerTopic; i++) {
      const q = pickQuestion(topic);
      if (!q) continue;
      counter += 1;
      const counterLabel = `${counter} / ${total} · ${TOPIC_LABEL[topic] || topic}`;
      const res = await showQuestion({ question: q, counterLabel });
      recordAnswer({ topic: q.topic, questionId: q.id, correct: res.correct });
      if (res.correct) {
        correct += 1;
        addXP(15);
      }
    }
  }

  const pct = total ? Math.round((correct / total) * 100) : 0;
  const reward = computeReward(pct);

  if (reward.weapon) {
    unlockWeapon(reward.weapon);
    setCurrentWeapon(reward.weapon);
  }
  if (reward.bonusXp) addXP(reward.bonusXp);

  sfx.play(pct >= 60 ? "level.complete" : "ui.back");
  await showAlert({
    title: pct >= 80 ? "🏆 ציון מעולה!" : pct >= 60 ? "🎉 כל הכבוד!" : "💪 אפשר עוד טוב יותר",
    message: `צדקת ב-${correct} מתוך ${total} (${pct}%).\n${reward.message}`,
    confirmLabel: "המשך לקרב!",
  });

  if (onAfter) onAfter({ pct, correct, total, reward });
}

function computeReward(pct) {
  // Pick next locked weapon based on score tier
  const profile = (() => { try { return JSON.parse(localStorage.getItem("mechonan-galaxy.v1") || "{}"); } catch { return {}; } })();
  const active = profile.profiles?.find?.((p) => p.id === profile.activeId);
  const unlocked = active?.progress?.unlockedWeapons || ["single"];
  const order = ["single", "double", "triple", "laser", "super", "rapid", "spread5", "pierce", "flank", "storm"];
  const nextLocked = order.find((w) => !unlocked.includes(w));

  if (pct >= 90 && nextLocked) {
    return { weapon: nextLocked, bonusXp: 100, message: `פתחת נשק חדש בציון מצוין!` };
  }
  if (pct >= 70 && nextLocked) {
    return { weapon: nextLocked, bonusXp: 60, message: `פתחת נשק חדש!` };
  }
  if (pct >= 50 && nextLocked) {
    return { weapon: nextLocked, bonusXp: 30, message: `פתחת נשק חדש בציון בינוני!` };
  }
  return { bonusXp: 15, message: "קיבלת בונוס 15 XP. ננסה שוב להוציא נשק חדש בבוס הבא!" };
}
