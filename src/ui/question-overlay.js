// Question overlay UI — renders a question with א/ב/ג/ד choices, returns Promise<{correct, choiceIndex}>.

import { sfx } from "../audio/sfx-manager.js";
import { showOverlay, hideOverlay } from "./screens.js";

const HEB = ["א", "ב", "ג", "ד"];
const overlay = document.getElementById("screen-question");
const topicEl = document.getElementById("question-topic");
const counterEl = document.getElementById("question-counter");
const bodyEl = document.getElementById("question-body");
const choicesEl = document.getElementById("question-choices");
const feedbackEl = document.getElementById("question-feedback");

const TOPIC_LABEL = {
  math: "חשבון",
  sentence: "השלמת משפטים",
  relations: "יחסי מילים",
  shapes: "צורות",
  sequences: "סדרות",
  oddOneOut: "יוצא דופן",
};

export function showQuestion({ question, counterLabel = "" }) {
  return new Promise((resolve) => {
    topicEl.textContent = TOPIC_LABEL[question.topic] || question.topic;
    counterEl.textContent = counterLabel;
    // Body: image-based or text-based
    bodyEl.innerHTML = "";
    if (question.bodyImage) {
      const img = document.createElement("img");
      img.src = question.bodyImage;
      img.alt = question.body || "";
      img.className = "question__image";
      img.style.cssText = "max-width: 100%; max-height: 42vh; height: auto; width: auto; display: block; margin: 0 auto; background: #fff; border-radius: 8px; padding: 6px;";
      bodyEl.appendChild(img);
      if (question.body) {
        const p = document.createElement("p");
        p.textContent = question.body;
        p.style.cssText = "margin-top: 12px; text-align: center;";
        bodyEl.appendChild(p);
      }
    } else {
      bodyEl.textContent = question.body || question.text || "";
    }
    choicesEl.innerHTML = "";
    feedbackEl.textContent = "";
    feedbackEl.className = "question__feedback";

    let resolved = false;
    question.choices.forEach((choice, idx) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.className = "question__choice";
      btn.type = "button";

      const letter = document.createElement("span");
      letter.className = "question__choice-letter";
      letter.textContent = HEB[idx];

      const text = document.createElement("span");
      text.textContent = choice;

      btn.appendChild(letter);
      btn.appendChild(text);

      btn.addEventListener("click", () => {
        if (resolved) return;
        resolved = true;
        const correct = idx === question.correctIndex;
        // Mark choices
        Array.from(choicesEl.querySelectorAll(".question__choice")).forEach((el, i) => {
          el.disabled = true;
          if (i === question.correctIndex) el.classList.add("question__choice--correct");
          else if (i === idx && !correct) el.classList.add("question__choice--wrong");
        });
        feedbackEl.textContent = correct ? "כל הכבוד! ✨" : "טעות, התשובה הנכונה מודגשת בירוק.";
        feedbackEl.className = `question__feedback question__feedback--${correct ? "good" : "bad"}`;
        sfx.play(correct ? "answer.correct" : "answer.wrong");
        setTimeout(() => {
          hideOverlay("question");
          resolve({ correct, choiceIndex: idx });
        }, correct ? 700 : 1300);
      });

      li.appendChild(btn);
      choicesEl.appendChild(li);
    });

    showOverlay("question");
  });
}
