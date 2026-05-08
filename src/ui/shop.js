// Shop — appears after level complete. Lets player spend coins on persistent upgrades.

import { showOverlay, hideOverlay } from "./screens.js";
import { sfx } from "../audio/sfx-manager.js";
import { getActiveProfile, spendCoins, purchaseUpgrade, getShipUpgrades } from "../store/profiles.js";

let SHIPS_ROSTER = null;
async function getShipsRoster() {
  if (SHIPS_ROSTER) return SHIPS_ROSTER;
  const r = await fetch("./src/content/ships.json");
  const data = await r.json();
  SHIPS_ROSTER = data.ships;
  return SHIPS_ROSTER;
}

const UPGRADES = [
  {
    id: "speedBoost",
    name: "מהירות חללית",
    icon: "⚡",
    description: "תגדיל את מהירות התזוזה של החללית.",
    baseCost: 15,
    costGrowth: 1.5,
    maxLevel: 5,
    perLevel: "+60 מהירות",
  },
  {
    id: "damageBoost",
    name: "עוצמת ירי",
    icon: "💥",
    description: "כל יריה תגרום יותר נזק.",
    baseCost: 20,
    costGrowth: 1.7,
    maxLevel: 5,
    perLevel: "+1 נזק",
  },
  {
    id: "fireRateBoost",
    name: "קצב ירי",
    icon: "🔥",
    description: "תוכל לירות מהר יותר.",
    baseCost: 25,
    costGrowth: 1.6,
    maxLevel: 4,
    perLevel: "-15% זמן המתנה",
  },
  {
    id: "maxLivesBoost",
    name: "חיים נוספים",
    icon: "❤️",
    description: "תתחיל כל שלב עם חיים נוספים.",
    baseCost: 30,
    costGrowth: 1.8,
    maxLevel: 5,
    perLevel: "+1 חיים",
  },
];

function costFor(upgrade, currentLevel) {
  return Math.round(upgrade.baseCost * Math.pow(upgrade.costGrowth, currentLevel));
}

export function openShop({ onClose }) {
  const screen = document.getElementById("screen-shop") || createShopScreen();
  renderShop();
  showOverlay("shop");
  const close = () => {
    sfx.play("ui.back");
    hideOverlay("shop");
    onClose?.();
  };
  screen.querySelector("#btn-shop-close").onclick = close;
  screen.querySelector("#btn-shop-back").onclick = close;
}

function createShopScreen() {
  const section = document.createElement("section");
  section.id = "screen-shop";
  section.className = "screen screen--overlay";
  section.innerHTML = `
    <div class="container shop-container">
      <header class="shop-header">
        <button id="btn-shop-back" class="btn btn--ghost btn--small">← חזרה</button>
        <h1 class="title">חנות שדרוגים</h1>
        <div class="shop-coins">🪙 <strong id="shop-coins">0</strong></div>
      </header>
      <div id="shop-active-ship" class="shop-active-ship"></div>
      <ul id="shop-list" class="shop-list"></ul>
      <button id="btn-shop-close" class="btn btn--primary btn--big btn--full">סיום</button>
    </div>
  `;
  document.querySelector("#app").appendChild(section);
  return section;
}

async function renderShop() {
  const profile = getActiveProfile();
  if (!profile) return;
  const coins = profile.progress.coins || 0;
  const currentShipId = profile.progress.currentShip || "scout";
  const upgrades = getShipUpgrades(currentShipId);

  // Active ship banner
  const ships = await getShipsRoster();
  const ship = ships.find((s) => s.id === currentShipId);
  const banner = document.getElementById("shop-active-ship");
  if (banner && ship) {
    banner.innerHTML = `
      <span class="shop-active-ship__emoji">${ship.emoji}</span>
      <span class="shop-active-ship__label">משדרגים את:</span>
      <strong class="shop-active-ship__name">${ship.name}</strong>
    `;
  }

  document.getElementById("shop-coins").textContent = coins;
  const list = document.getElementById("shop-list");
  list.innerHTML = "";

  for (const u of UPGRADES) {
    const lvl = upgrades[u.id] || 0;
    const isMaxed = lvl >= u.maxLevel;
    const cost = isMaxed ? 0 : costFor(u, lvl);
    const canAfford = !isMaxed && coins >= cost;

    const li = document.createElement("li");
    li.className = "shop-item";
    li.innerHTML = `
      <div class="shop-item__icon">${u.icon}</div>
      <div class="shop-item__main">
        <div class="shop-item__name">${u.name} <span class="shop-item__level">[${lvl}/${u.maxLevel}]</span></div>
        <div class="shop-item__desc">${u.description}</div>
        <div class="shop-item__perlevel">${u.perLevel} לרמה</div>
      </div>
      <button class="btn ${canAfford ? "btn--secondary" : "btn--ghost"} shop-item__buy" ${isMaxed || !canAfford ? "disabled" : ""}>
        ${isMaxed ? "מקסימום ✓" : `קנה (🪙 ${cost})`}
      </button>
    `;
    const buyBtn = li.querySelector(".shop-item__buy");
    buyBtn.addEventListener("click", () => {
      if (isMaxed || !canAfford) return;
      if (spendCoins(cost)) {
        purchaseUpgrade(u.id, currentShipId);
        sfx.play("powerup.weapon");
        renderShop();
      }
    });
    list.appendChild(li);
  }
}
