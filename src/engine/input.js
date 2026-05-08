// Unified input: keyboard, mouse, touch.
// Public state:
//  - keys: { ArrowLeft, ArrowRight, ArrowUp, ArrowDown, KeyA, KeyD, KeyW, KeyS, Space }
//  - pointer: { active, x, y, fire }   (canvas-space coords, set via setCanvas)

export class Input {
  constructor() {
    this.keys = Object.create(null);
    this.pointer = { active: false, x: 0, y: 0, fire: false };
    this._canvas = null;

    window.addEventListener("keydown", (e) => {
      this.keys[e.code] = true;
      // Prevent page scroll on arrow/space when game is active
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
        e.preventDefault();
      }
    }, { passive: false });
    window.addEventListener("keyup", (e) => { this.keys[e.code] = false; });
    window.addEventListener("blur", () => { this.keys = Object.create(null); });
  }

  setCanvas(canvas) {
    this._canvas = canvas;
    canvas.addEventListener("pointerdown", this._onDown, { passive: false });
    canvas.addEventListener("pointermove", this._onMove, { passive: false });
    canvas.addEventListener("pointerup", this._onUp, { passive: false });
    canvas.addEventListener("pointercancel", this._onUp, { passive: false });
    canvas.addEventListener("pointerleave", this._onUp, { passive: false });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  _toCanvas(e) {
    const rect = this._canvas.getBoundingClientRect();
    const sx = this._canvas.width / rect.width;
    const sy = this._canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  }

  _onDown = (e) => {
    e.preventDefault();
    this._canvas.setPointerCapture?.(e.pointerId);
    const { x, y } = this._toCanvas(e);
    this.pointer.active = true; this.pointer.x = x; this.pointer.y = y; this.pointer.fire = true;
  };
  _onMove = (e) => {
    if (!this.pointer.active && e.pointerType === "mouse") {
      // Track mouse position even without click for hover-aim
      const { x, y } = this._toCanvas(e);
      this.pointer.x = x; this.pointer.y = y;
      return;
    }
    if (!this.pointer.active) return;
    const { x, y } = this._toCanvas(e);
    this.pointer.x = x; this.pointer.y = y;
  };
  _onUp = () => {
    this.pointer.active = false;
    this.pointer.fire = false;
  };

  reset() {
    this.keys = Object.create(null);
    this.pointer.active = false;
    this.pointer.fire = false;
  }
}
