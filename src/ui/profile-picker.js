// Profile picker UI — list profiles, create/delete, select.

import { listProfiles, createProfile, deleteProfile, setActiveProfile } from "../store/profiles.js";
import { showAlert, showConfirm, showPrompt } from "./modal.js";
import { sfx } from "../audio/sfx-manager.js";

const listEl = document.getElementById("profile-list");
const addBtn = document.getElementById("btn-add-profile");

function avatarEmojiFor(name) {
  const emojis = ["🚀", "👨‍🚀", "👩‍🚀", "🛸", "👽", "🪐", "⭐", "🌟", "💫", "🌠"];
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return emojis[h % emojis.length];
}

export function renderProfiles({ onSelect }) {
  listEl.innerHTML = "";
  const profiles = listProfiles();

  if (profiles.length === 0) {
    const empty = document.createElement("li");
    empty.style.cssText = "color: var(--text-dim); text-align: center; padding: 18px;";
    empty.textContent = "אין עדיין טייסים. לחץ על \"+ טייס חדש\" כדי להתחיל.";
    listEl.appendChild(empty);
  }

  for (const p of profiles) {
    const li = document.createElement("li");
    const card = document.createElement("button");
    card.type = "button";
    card.className = "profile-card";

    const avatar = document.createElement("div");
    avatar.className = "profile-card__avatar";
    avatar.textContent = avatarEmojiFor(p.name);
    card.appendChild(avatar);

    const main = document.createElement("div");
    main.className = "profile-card__main";
    const name = document.createElement("div");
    name.className = "profile-card__name";
    name.textContent = p.name;
    const sub = document.createElement("div");
    sub.className = "profile-card__sub";
    const lvl = p.progress?.level ?? 1;
    const xp = p.progress?.xp ?? 0;
    sub.textContent = `שלב ${lvl} · ${xp} XP`;
    main.appendChild(name);
    main.appendChild(sub);
    card.appendChild(main);

    card.addEventListener("click", () => {
      sfx.play("ui.click");
      setActiveProfile(p.id);
      onSelect();
    });

    const del = document.createElement("button");
    del.type = "button";
    del.className = "profile-card__delete";
    del.textContent = "מחק";
    del.setAttribute("aria-label", `מחק את ${p.name}`);
    del.addEventListener("click", async (e) => {
      e.stopPropagation();
      const ok = await showConfirm({
        title: "מחיקת טייס",
        message: `למחוק את הטייס "${p.name}"? כל ההתקדמות שלו תאבד.`,
        confirmLabel: "מחק",
        cancelLabel: "ביטול",
        danger: true,
      });
      if (!ok) return;
      deleteProfile(p.id);
      renderProfiles({ onSelect });
    });

    li.appendChild(card);
    li.appendChild(del);
    li.style.display = "flex";
    li.style.alignItems = "center";
    li.style.gap = "8px";
    listEl.appendChild(li);
  }
}

export function bindProfilePicker({ onSelect }) {
  addBtn.addEventListener("click", async () => {
    sfx.play("ui.click");
    const name = await showPrompt({
      title: "טייס חדש",
      message: "מה השם שיופיע על החללית?",
      placeholder: "לדוגמה: יוסף",
      confirmLabel: "התחל",
      cancelLabel: "ביטול",
      validate: (v) => {
        if (!v) return "צריך לכתוב שם";
        if (v.length > 18) return "השם ארוך מדי (עד 18 תווים)";
        return null;
      },
    });
    if (!name) return;
    createProfile(name);
    sfx.play("powerup.weapon");
    onSelect();
  });

  renderProfiles({ onSelect });
}
