// Hangar UI — view all ships, see stats, unlock new ones, set active.

import { showOverlay, hideOverlay } from "./screens.js";
import { showAlert, showConfirm } from "./modal.js";
import { sfx } from "../audio/sfx-manager.js";
import {
  getActiveProfile, spendCoins, unlockShip, setActiveShip, hasAchievement, getShipUpgrades,
} from "../store/profiles.js";
import { getRankForXp } from "../store/rank.js";
import { drawShipById } from "../entities/ship-sprites.js";

let SHIPS = null;
let RARITY_COLORS = null;

async function loadShips() {
  if (SHIPS) return SHIPS;
  const r = await fetch("./src/content/ships.json");
  const data = await r.json();
  SHIPS = data.ships;
  RARITY_COLORS = data.rarityColors;
  return SHIPS;
}

let currentSelectedId = null;

export async function openHangar({ onClose }) {
  await loadShips();
  const screen = getOrCreateScreen();
  const profile = getActiveProfile();
  if (!profile) { onClose?.(); return; }
  currentSelectedId = profile.progress.currentShip || "scout";
  render();
  showOverlay("hangar");
  screen.querySelector("#btn-hangar-back").onclick = () => {
    sfx.play("ui.back");
    hideOverlay("hangar");
    onClose?.();
  };
}

function getOrCreateScreen() {
  let s = document.getElementById("screen-hangar");
  if (s) return s;
  s = document.createElement("section");
  s.id = "screen-hangar";
  s.className = "screen screen--overlay";
  s.innerHTML = `
    <div class="container hangar-container">
      <header class="hangar-header">
        <button id="btn-hangar-back" class="btn btn--ghost btn--small">← חזרה</button>
        <h1 class="title">מוסך החלליות</h1>
        <div class="hangar-coins">🪙 <strong id="hangar-coins">0</strong></div>
      </header>
      <div class="hangar-layout">
        <ul id="hangar-grid" class="hangar-grid"></ul>
        <div id="hangar-detail" class="hangar-detail"></div>
      </div>
    </div>
  `;
  document.querySelector("#app").appendChild(s);
  return s;
}

function isUnlocked(profile, ship) {
  return !!profile.progress.ships?.[ship.id]?.unlocked;
}

function canUnlock(profile, ship) {
  const u = ship.unlock;
  if (!u || u.type === "default") return false;
  if (u.type === "coins") return (profile.progress.coins || 0) >= u.cost;
  if (u.type === "achievement") return hasAchievement(u.id);
  if (u.type === "coinsAndRank") {
    const rank = getRankForXp(profile.progress.xp || 0);
    const rankReached = ["captain","major","commander","general","admiral"].includes(rank.id);
    const haveCoins = (profile.progress.coins || 0) >= u.cost;
    // Check rank requirement matches or exceeds the required one
    const order = ["recruit","trainee","pilot","veteran","captain","major","commander","general","admiral"];
    const reqIdx = order.indexOf(u.rank);
    const cur = order.indexOf(rank.id);
    return haveCoins && cur >= reqIdx;
  }
  return false;
}

function unlockTryDescription(ship) {
  const u = ship.unlock;
  if (!u) return "";
  return u.label || "";
}

function render() {
  const profile = getActiveProfile();
  if (!profile) return;
  document.getElementById("hangar-coins").textContent = profile.progress.coins || 0;
  renderGrid(profile);
  renderDetail(profile);
}

function renderShipPreview(canvas, ship, animate = false) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;
  const phase = animate ? performance.now() / 1000 : 1.5;
  ctx.clearRect(0, 0, w, h);
  // Soft glow background
  ctx.shadowBlur = 18;
  ctx.shadowColor = ship.color || "#4fa3ff";
  drawShipById(ctx, ship.id, w / 2, h / 2, Math.min(w, h) * 0.35, ship.color || "#4fa3ff", phase);
}

const animatingCanvases = new Set();
function startCanvasAnim(canvas, ship) {
  animatingCanvases.add(canvas);
  function tick() {
    if (!document.body.contains(canvas)) { animatingCanvases.delete(canvas); return; }
    if (!animatingCanvases.has(canvas)) return;
    renderShipPreview(canvas, ship, true);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function renderGrid(profile) {
  const grid = document.getElementById("hangar-grid");
  grid.innerHTML = "";
  animatingCanvases.clear();
  for (const ship of SHIPS) {
    const unlocked = isUnlocked(profile, ship);
    const isCurrent = profile.progress.currentShip === ship.id;
    const colors = RARITY_COLORS[ship.rarity] || {};
    const li = document.createElement("li");
    const card = document.createElement("button");
    card.type = "button";
    card.className = "hangar-card";
    card.style.borderColor = colors.border || "var(--border)";
    if (currentSelectedId === ship.id) card.classList.add("hangar-card--selected");
    if (!unlocked) card.classList.add("hangar-card--locked");
    if (isCurrent) card.classList.add("hangar-card--active");

    // Build sprite preview canvas
    const previewWrap = document.createElement("div");
    previewWrap.className = "hangar-card__preview";
    if (unlocked) {
      const cv = document.createElement("canvas");
      cv.width = 90; cv.height = 90;
      previewWrap.appendChild(cv);
      // Render once now; animate only the selected card to save CPU
      renderShipPreview(cv, ship, false);
      if (currentSelectedId === ship.id) startCanvasAnim(cv, ship);
    } else {
      previewWrap.innerHTML = `<div class="hangar-card__lock">🔒</div>`;
    }

    const rarityEl = document.createElement("div");
    rarityEl.className = "hangar-card__rarity";
    rarityEl.style.color = colors.border;
    rarityEl.textContent = colors.label || ship.rarity;

    const nameEl = document.createElement("div");
    nameEl.className = "hangar-card__name";
    nameEl.textContent = unlocked ? ship.name : "??????";

    card.appendChild(rarityEl);
    card.appendChild(previewWrap);
    card.appendChild(nameEl);
    if (isCurrent) {
      const badge = document.createElement("div");
      badge.className = "hangar-card__badge";
      badge.textContent = "פעילה";
      card.appendChild(badge);
    }

    card.onclick = () => { sfx.play("ui.click"); currentSelectedId = ship.id; render(); };
    li.appendChild(card);
    grid.appendChild(li);
  }
}

function renderDetail(profile) {
  const detail = document.getElementById("hangar-detail");
  const ship = SHIPS.find((s) => s.id === currentSelectedId);
  if (!ship) { detail.innerHTML = ""; return; }
  const unlocked = isUnlocked(profile, ship);
  const isCurrent = profile.progress.currentShip === ship.id;
  const colors = RARITY_COLORS[ship.rarity] || {};
  const upgrades = unlocked ? getShipUpgrades(ship.id) : { speedBoost: 0, damageBoost: 0, fireRateBoost: 0, maxLivesBoost: 0 };
  const stats = ship.baseStats;

  let actionHTML = "";
  if (unlocked) {
    if (isCurrent) {
      actionHTML = `<button class="btn btn--ghost btn--full" disabled>הופעלה ✓</button>`;
    } else {
      actionHTML = `<button id="hangar-set-active" class="btn btn--primary btn--big btn--full">בחר חללית זו</button>`;
    }
  } else {
    const u = ship.unlock;
    const canBuy = canUnlock(profile, ship);
    if (u.type === "coins" || u.type === "coinsAndRank") {
      actionHTML = `<button id="hangar-buy" class="btn ${canBuy ? "btn--secondary" : "btn--ghost"} btn--big btn--full" ${canBuy ? "" : "disabled"}>${canBuy ? `קנה (🪙 ${u.cost})` : `נעולה — ${unlockTryDescription(ship)}`}</button>`;
    } else if (u.type === "achievement") {
      const achieved = hasAchievement(u.id);
      actionHTML = achieved
        ? `<button id="hangar-claim" class="btn btn--secondary btn--big btn--full">השג! לחץ לשחרור</button>`
        : `<button class="btn btn--ghost btn--full" disabled>נעולה — ${unlockTryDescription(ship)}</button>`;
    }
  }

  // Build stat bars
  function bar(label, value, max, hint = "") {
    const pct = Math.min(100, (value / max) * 100);
    return `
      <div class="ship-stat">
        <span class="ship-stat__label">${label}</span>
        <div class="ship-stat__bar"><div class="ship-stat__fill" style="width:${pct}%"></div></div>
        <span class="ship-stat__value">${hint || value}</span>
      </div>
    `;
  }

  // Show base stats (raw) — speed: 380 baseline, fireRateMul 1=baseline, lives 5=baseline
  const speedScore = stats.speed / 600;
  const fireRateScore = (1.5 - (stats.fireRateMul || 1)) / 1.0; // lower = faster, invert
  const livesScore = stats.lives / 10;
  const damageScore = (1 + (stats.damageBonus || 0)) / 3;

  detail.innerHTML = `
    <div class="hangar-detail__head" style="background: ${colors.bg || "var(--bg-card)"}; border-color: ${colors.border};">
      ${unlocked ? `<canvas id="hangar-detail-canvas" class="hangar-detail__canvas" width="160" height="160"></canvas>` : `<div class="hangar-detail__emoji">🔒</div>`}
      <div class="hangar-detail__title">
        <div class="hangar-detail__rarity" style="color:${colors.border}">${colors.label || ship.rarity}</div>
        <h2 class="hangar-detail__name">${unlocked ? ship.name : "חללית נעולה"}</h2>
        <div class="hangar-detail__small-emoji">${ship.emoji}</div>
      </div>
    </div>
    <p class="hangar-detail__desc">${ship.description}</p>
    <div class="hangar-detail__stats">
      ${bar("מהירות", Math.round(speedScore * 100), 100)}
      ${bar("חיים", stats.lives, 10, `${stats.lives} חיים`)}
      ${bar("נזק", Math.round(damageScore * 100), 100, `+${stats.damageBonus || 0}`)}
      ${bar("קצב ירי", Math.round(fireRateScore * 100), 100)}
    </div>
    ${ship.ability !== "none" ? `
      <div class="hangar-detail__ability">
        <div class="hangar-detail__ability-label">⚡ יכולת מיוחדת</div>
        <div class="hangar-detail__ability-text">${ship.abilityDescription}</div>
      </div>
    ` : ""}
    ${unlocked ? `
      <div class="hangar-detail__upgrades">
        <div class="hangar-detail__ability-label">שדרוגי החללית הזו</div>
        <div class="hangar-upgrades-list">
          <div class="hangar-upgrade">⚡ מהירות: <strong>${upgrades.speedBoost}/5</strong></div>
          <div class="hangar-upgrade">💥 נזק: <strong>${upgrades.damageBoost}/5</strong></div>
          <div class="hangar-upgrade">🔥 קצב ירי: <strong>${upgrades.fireRateBoost}/4</strong></div>
          <div class="hangar-upgrade">❤️ חיים: <strong>${upgrades.maxLivesBoost}/5</strong></div>
        </div>
        <p class="hangar-upgrades-hint">השדרוגים נקנים בחנות ומוצמדים לחללית הזו בלבד.</p>
      </div>
    ` : ""}
    <div class="hangar-detail__actions">${actionHTML}</div>
  `;

  // Animate the large detail canvas if unlocked
  const detailCanvas = detail.querySelector("#hangar-detail-canvas");
  if (detailCanvas) startCanvasAnim(detailCanvas, ship);

  const setBtn = detail.querySelector("#hangar-set-active");
  if (setBtn) setBtn.onclick = () => {
    sfx.play("powerup.weapon");
    setActiveShip(ship.id);
    render();
  };
  const buyBtn = detail.querySelector("#hangar-buy");
  if (buyBtn) buyBtn.onclick = async () => {
    if (!canUnlock(profile, ship)) return;
    if (spendCoins(ship.unlock.cost)) {
      unlockShip(ship.id);
      sfx.play("midtest.fanfare");
      await showAlert({ title: `${ship.emoji} ${ship.name} פתוחה!`, message: ship.description, confirmLabel: "מצוין!" });
      render();
    }
  };
  const claimBtn = detail.querySelector("#hangar-claim");
  if (claimBtn) claimBtn.onclick = async () => {
    unlockShip(ship.id);
    sfx.play("midtest.fanfare");
    await showAlert({ title: `${ship.emoji} ${ship.name} נפתחה!`, message: `${ship.description}`, confirmLabel: "אדיר!" });
    render();
  };
}
