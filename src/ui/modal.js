// Custom modal — replacement for window.alert / confirm / prompt.
// Promise-based API: showAlert/showConfirm/showPrompt.

const root = document.getElementById("modal");
const titleEl = document.getElementById("modal-title");
const bodyEl = document.getElementById("modal-body");
const actionsEl = document.getElementById("modal-actions");

let activeResolver = null;

function close(value) {
  root.hidden = true;
  bodyEl.innerHTML = "";
  actionsEl.innerHTML = "";
  const r = activeResolver;
  activeResolver = null;
  if (r) r(value);
}

function open(opts) {
  return new Promise((resolve) => {
    if (activeResolver) close(null);
    activeResolver = resolve;
    titleEl.textContent = opts.title || "";
    bodyEl.innerHTML = "";
    if (typeof opts.body === "string") bodyEl.textContent = opts.body;
    else if (opts.body instanceof Node) bodyEl.appendChild(opts.body);
    actionsEl.innerHTML = "";
    for (const a of opts.actions || []) {
      const btn = document.createElement("button");
      btn.className = `btn ${a.variant || "btn--primary"}`;
      btn.textContent = a.label;
      btn.addEventListener("click", () => {
        if (a.onClick) {
          const result = a.onClick();
          if (result !== undefined) close(result);
        } else {
          close(a.value);
        }
      });
      actionsEl.appendChild(btn);
    }
    root.hidden = false;
    const focusable = actionsEl.querySelector("button") || bodyEl.querySelector("input, button");
    if (focusable) focusable.focus();
  });
}

export function showAlert({ title = "", message = "", confirmLabel = "סגור" }) {
  return open({
    title,
    body: message,
    actions: [{ label: confirmLabel, variant: "btn--primary", value: true }],
  });
}

export function showConfirm({ title = "", message = "", confirmLabel = "אישור", cancelLabel = "ביטול", danger = false }) {
  return open({
    title,
    body: message,
    actions: [
      { label: cancelLabel, variant: "btn--ghost", value: false },
      { label: confirmLabel, variant: danger ? "btn--danger" : "btn--primary", value: true },
    ],
  });
}

export function showPrompt({ title = "", message = "", placeholder = "", initialValue = "", confirmLabel = "אישור", cancelLabel = "ביטול", validate = null }) {
  return new Promise((resolve) => {
    const wrap = document.createElement("div");
    if (message) {
      const p = document.createElement("p");
      p.textContent = message;
      p.style.marginBottom = "12px";
      wrap.appendChild(p);
    }
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = placeholder;
    input.value = initialValue;
    input.dir = "auto";
    wrap.appendChild(input);
    const err = document.createElement("p");
    err.style.cssText = "color: var(--bad); font-size: 13px; margin-top: 8px; min-height: 18px;";
    wrap.appendChild(err);

    const submit = () => {
      const v = input.value.trim();
      if (validate) {
        const e = validate(v);
        if (e) { err.textContent = e; return; }
      }
      close(v);
      resolve(v);
    };

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
      if (e.key === "Escape") { close(null); resolve(null); }
    });

    open({
      title,
      body: wrap,
      actions: [
        { label: cancelLabel, variant: "btn--ghost", onClick: () => { resolve(null); return null; } },
        { label: confirmLabel, variant: "btn--primary", onClick: () => { submit(); return undefined; } },
      ],
    });
  });
}

// Backdrop click closes (alert variant only)
root.addEventListener("click", (e) => {
  if (e.target.classList.contains("modal__backdrop")) {
    if (actionsEl.children.length === 1) close(null);
  }
});
