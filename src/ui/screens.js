// Simple screen state machine: only one screen is "active" at a time.
const screens = {};
let current = null;

export function registerScreen(id) {
  const el = document.getElementById(`screen-${id}`);
  if (!el) throw new Error(`screen "${id}" not found`);
  screens[id] = el;
}

export function showScreen(id) {
  if (!screens[id]) registerScreen(id);
  for (const k in screens) screens[k].classList.toggle("screen--active", k === id);
  current = id;
  document.dispatchEvent(new CustomEvent("screen:change", { detail: { id } }));
}

export function getCurrentScreen() {
  return current;
}

export function showOverlay(id) {
  // Overlay variant — keeps the previous screen visible behind it
  if (!screens[id]) registerScreen(id);
  screens[id].classList.add("screen--active");
}

export function hideOverlay(id) {
  if (!screens[id]) return;
  screens[id].classList.remove("screen--active");
}
