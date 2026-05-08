// Player ship + weapon firing logic.

import { sfx } from "../audio/sfx-manager.js";
import { drawShipById } from "./ship-sprites.js";

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 18;
    this.speed = 380;
    this.lives = 5;
    this.invuln = 0;
    this.fireCooldown = 0;
    this.weapon = "single";
    this.color = "#4fa3ff";
    this.pilotName = "";
    this.alive = true;
    this.bobPhase = 0;
    // Ship-driven flags
    this.shipId = "scout";
    this.shipAbility = "none";
    this.invulnAfterHit = 1.5;
    this.dualWeapon = false;
    this.extraSpread = false;
    this.piercing = 0;
    this.nukeAvailable = false;
    this.fireRateMul = 1;
    this.damageBonus = 0;
  }

  setWeapon(id) { this.weapon = id; this.fireCooldown = 0; }

  applyShip(shipDef) {
    this.shipId = shipDef.id;
    this.color = shipDef.color || "#4fa3ff";
    this.radius = shipDef.baseStats?.radius ?? 18;
    this.shipAbility = shipDef.ability || "none";
    // Reset ability-driven flags
    this.dualWeapon = false;
    this.extraSpread = false;
    this.piercing = 0;
    this.invulnAfterHit = 1.5;
    this.nukeAvailable = false;
    if (this.shipAbility === "dualWeapon") this.dualWeapon = true;
    if (this.shipAbility === "extraSpread") this.extraSpread = true;
    if (this.shipAbility === "piercing") this.piercing = 2;
    if (this.shipAbility === "extendedInvuln") this.invulnAfterHit = 3.0;
    if (this.shipAbility === "autoNuke") this.nukeAvailable = true;
  }

  update(dt, input, bounds) {
    if (!this.alive) return;

    // Movement
    let mx = 0, my = 0;
    if (input.keys.ArrowLeft || input.keys.KeyA) mx -= 1;
    if (input.keys.ArrowRight || input.keys.KeyD) mx += 1;
    if (input.keys.ArrowUp || input.keys.KeyW) my -= 1;
    if (input.keys.ArrowDown || input.keys.KeyS) my += 1;

    if (input.pointer.active) {
      // Drag toward pointer
      const dx = input.pointer.x - this.x;
      const dy = input.pointer.y - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 4) { mx = dx / dist; my = dy / dist; }
      else { mx = 0; my = 0; }
    }

    if (mx || my) {
      const len = Math.hypot(mx, my) || 1;
      this.x += (mx / len) * this.speed * dt;
      this.y += (my / len) * this.speed * dt;
    }

    // Clamp to play area
    this.x = Math.max(this.radius + 4, Math.min(bounds.w - this.radius - 4, this.x));
    this.y = Math.max(this.radius + 4, Math.min(bounds.h - this.radius - 4, this.y));

    // Invulnerability tick
    if (this.invuln > 0) this.invuln -= dt;

    // Auto-fire
    this.fireCooldown -= dt;
    this.bobPhase += dt;
  }

  // Try fire — returns array of bullet specs to spawn, or null
  tryFire() {
    if (this.fireCooldown > 0) return null;
    const w = WEAPONS[this.weapon] || WEAPONS.single;
    this.fireCooldown = w.cooldown * (this.fireRateMul ?? 1);
    sfx.play(w.sfx || "shoot.single");
    let bullets = w.bullets(this.x, this.y);
    // Damage bonus (from upgrades AND ship base damage)
    if (this.damageBonus) {
      for (const b of bullets) b.damage = (b.damage || 1) + this.damageBonus;
    }
    // Ship ability: piercing
    if (this.piercing > 0) {
      for (const b of bullets) b.pierce = Math.max(b.pierce || 0, this.piercing);
    }
    // Ship ability: extra spread (each bullet gets 2 angled siblings)
    if (this.extraSpread) {
      const extras = [];
      for (const b of bullets) {
        extras.push({ ...b, vx: (b.vx || 0) - 180 });
        extras.push({ ...b, vx: (b.vx || 0) + 180 });
      }
      bullets = bullets.concat(extras);
    }
    // Ship ability: dual weapon (offset another full set of bullets)
    if (this.dualWeapon) {
      const extras = bullets.map((b) => ({ ...b, x: b.x + (b.x < this.x ? -16 : 16) }));
      bullets = bullets.concat(extras);
    }
    return bullets;
  }

  // Returns: "blocked" if invuln, "nuked" if autoNuke triggered, "hit" if normal, "dead" if killed
  takeDamage() {
    if (this.invuln > 0) return "blocked";
    this.lives -= 1;
    this.invuln = this.invulnAfterHit ?? 1.5;
    sfx.play("hit.player");
    // Auto-nuke ability: when about to die (lives = 0 after this), trigger nuke + restore 1 life
    if (this.lives <= 0) {
      if (this.nukeAvailable) {
        this.nukeAvailable = false;
        this.lives = 1;
        this.invuln = 2.5;
        return "nuked";
      }
      this.alive = false;
      return "dead";
    }
    return "hit";
  }

  draw(ctx) {
    if (!this.alive) return;
    ctx.save();
    if (this.invuln > 0 && Math.floor(this.invuln * 12) % 2 === 0) ctx.globalAlpha = 0.35;
    const x = this.x, y = this.y;
    const r = this.radius;
    const bob = Math.sin(this.bobPhase * 14) * 2;
    const shipId = this.shipId || "scout";

    // Universal engine glow
    ctx.shadowBlur = 18;
    ctx.shadowColor = this.color;

    // Per-ship body (delegated to shared module)
    drawShipById(ctx, shipId, x, y, r, this.color, this.bobPhase);

    // Universal engine flame at bottom
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ff8a4f";
    ctx.beginPath();
    ctx.moveTo(x - 5, y + r * 0.55);
    ctx.lineTo(x + 5, y + r * 0.55);
    ctx.lineTo(x, y + r + 6 + bob);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}

// (Per-ship sprite drawers were moved to src/entities/ship-sprites.js for reuse)

function _legacy_drawScout(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r, y + r);
  ctx.lineTo(x + 5, y + r * 0.55);
  ctx.lineTo(x - 5, y + r * 0.55);
  ctx.lineTo(x - r, y + r);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ffe066";
  ctx.beginPath();
  ctx.arc(x, y - 2, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawLightning(ctx, x, y, r, color) {
  // Narrow dart with lightning accent
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r * 1.2);
  ctx.lineTo(x + r * 0.7, y + r * 0.3);
  ctx.lineTo(x + 4, y + r * 0.6);
  ctx.lineTo(x - 4, y + r * 0.6);
  ctx.lineTo(x - r * 0.7, y + r * 0.3);
  ctx.closePath();
  ctx.fill();
  // Cockpit
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(x, y - 4, 3, 0, Math.PI * 2);
  ctx.fill();
  // Lightning bolt accent
  ctx.strokeStyle = "#ffe066";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 3, y + 2);
  ctx.lineTo(x + 1, y + 6);
  ctx.lineTo(x - 1, y + 6);
  ctx.lineTo(x + 3, y + 12);
  ctx.stroke();
}

function drawGuardian(ctx, x, y, r, color, bob) {
  // Hexagonal body with shield ring
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 2;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r * 0.85;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  // Shield ring (animated)
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(79, 163, 255, 0.7)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r + 6 + Math.sin(bob * 3) * 1.5, 0, Math.PI * 2);
  ctx.stroke();
  // Inner cockpit
  ctx.fillStyle = "#1a1305";
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fill();
}

function drawSpreader(ctx, x, y, r, color) {
  // Star shape (5 points)
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const radius = i % 2 === 0 ? r * 1.1 : r * 0.5;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlasma(ctx, x, y, r, color, bob) {
  // Diamond with pulsing glow
  const pulse = 1 + Math.sin(bob * 6) * 0.08;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r * pulse);
  ctx.lineTo(x + r * pulse * 0.8, y);
  ctx.lineTo(x, y + r * pulse * 0.7);
  ctx.lineTo(x - r * pulse * 0.8, y);
  ctx.closePath();
  ctx.fill();
  // Inner glow
  ctx.shadowBlur = 0;
  const grd = ctx.createRadialGradient(x, y, 0, x, y, r * 0.6);
  grd.addColorStop(0, "rgba(255, 255, 255, 0.9)");
  grd.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.6, 0, Math.PI * 2);
  ctx.fill();
}

function drawPhantom(ctx, x, y, r, color, bob) {
  // Semi-transparent ship with trailing shimmer
  const a = 0.55 + Math.abs(Math.sin(bob * 4)) * 0.4;
  ctx.globalAlpha = a;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x + r * 1.1, y, x + r * 0.6, y + r * 0.7);
  ctx.lineTo(x - r * 0.6, y + r * 0.7);
  ctx.quadraticCurveTo(x - r * 1.1, y, x, y - r);
  ctx.closePath();
  ctx.fill();
  // Eye/cockpit
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(x, y - 4, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1a1305";
  ctx.beginPath();
  ctx.arc(x, y - 4, 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawTitan(ctx, x, y, r, color, bob) {
  // Large hex body + crown spikes on top
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - r, y);
  ctx.lineTo(x - r * 0.6, y - r * 0.85);
  ctx.lineTo(x + r * 0.6, y - r * 0.85);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x + r * 0.7, y + r * 0.85);
  ctx.lineTo(x - r * 0.7, y + r * 0.85);
  ctx.closePath();
  ctx.fill();
  // Crown spikes
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ffe066";
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(x + i * 7, y - r * 0.85);
    ctx.lineTo(x + i * 7 + 3, y - r * 1.3);
    ctx.lineTo(x + i * 7 + 6, y - r * 0.85);
    ctx.closePath();
    ctx.fill();
  }
  // Inner core
  ctx.fillStyle = "#1a1305";
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffe066";
  ctx.beginPath();
  ctx.arc(x, y, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawSupernova(ctx, x, y, r, color, bob) {
  // Glowing core with rotating rays
  const rot = bob * 1.2;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  // Rays
  ctx.fillStyle = "rgba(255, 224, 102, 0.6)";
  for (let i = 0; i < 8; i++) {
    ctx.rotate((Math.PI * 2) / 8);
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.4);
    ctx.lineTo(3, -r * 0.7);
    ctx.lineTo(-3, -r * 0.7);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // Inner core
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.85, 0, Math.PI * 2);
  ctx.fill();
  // White hot center
  ctx.shadowBlur = 0;
  const grd = ctx.createRadialGradient(x, y, 0, x, y, r * 0.7);
  grd.addColorStop(0, "#fff");
  grd.addColorStop(0.5, "#ffe066");
  grd.addColorStop(1, "rgba(255, 224, 102, 0)");
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.7, 0, Math.PI * 2);
  ctx.fill();
}

// ===== Built-in weapon definitions (mirrored / supersedes weapons.json for runtime) =====
export const WEAPONS = {
  single: {
    name: "בודד",
    cooldown: 0.18,
    sfx: "shoot.single",
    bullets(x, y) { return [{ x, y: y - 18, vx: 0, vy: -560, color: "#ffe066", damage: 1, fromPlayer: true }]; },
  },
  double: {
    name: "כפול",
    cooldown: 0.20,
    sfx: "shoot.double",
    bullets(x, y) {
      return [
        { x: x - 10, y: y - 14, vx: 0, vy: -560, color: "#ffe066", damage: 1, fromPlayer: true },
        { x: x + 10, y: y - 14, vx: 0, vy: -560, color: "#ffe066", damage: 1, fromPlayer: true },
      ];
    },
  },
  triple: {
    name: "משולש",
    cooldown: 0.24,
    sfx: "shoot.triple",
    bullets(x, y) {
      return [
        { x, y: y - 18, vx: 0, vy: -580, color: "#ffe066", damage: 1, fromPlayer: true },
        { x: x - 8, y: y - 12, vx: -160, vy: -540, color: "#ffe066", damage: 1, fromPlayer: true },
        { x: x + 8, y: y - 12, vx: 160, vy: -540, color: "#ffe066", damage: 1, fromPlayer: true },
      ];
    },
  },
  laser: {
    name: "לייזר",
    cooldown: 0.10,
    sfx: "shoot.laser",
    bullets(x, y) {
      return [
        { x, y: y - 14, vx: 0, vy: -700, color: "#4fff9c", damage: 1, fromPlayer: true, style: "laser", radius: 3 },
      ];
    },
  },
  super: {
    name: "סופר",
    cooldown: 0.10,
    sfx: "shoot.super",
    bullets(x, y) {
      const out = [];
      for (let i = -2; i <= 2; i++) {
        out.push({
          x: x + i * 6, y: y - 14, vx: i * 110, vy: -620,
          color: "#ff5b8a", damage: 2, fromPlayer: true, radius: 5,
        });
      }
      return out;
    },
  },
  rapid: {
    name: "מהיר",
    cooldown: 0.07,
    sfx: "shoot.single",
    bullets(x, y) {
      return [{ x, y: y - 18, vx: 0, vy: -680, color: "#4fff9c", damage: 1, fromPlayer: true, radius: 3 }];
    },
  },
  spread5: {
    name: "מניפה",
    cooldown: 0.30,
    sfx: "shoot.triple",
    bullets(x, y) {
      const out = [];
      for (let i = -2; i <= 2; i++) {
        out.push({
          x, y: y - 14, vx: i * 200, vy: -540,
          color: "#ffd24f", damage: 1, fromPlayer: true,
        });
      }
      return out;
    },
  },
  pierce: {
    name: "חודר",
    cooldown: 0.25,
    sfx: "shoot.laser",
    bullets(x, y) {
      return [{
        x, y: y - 14, vx: 0, vy: -700, color: "#b35bff",
        damage: 2, fromPlayer: true, radius: 6, pierce: 3,
      }];
    },
  },
  flank: {
    name: "אגף",
    cooldown: 0.18,
    sfx: "shoot.double",
    bullets(x, y) {
      return [
        { x: x - 18, y, vx: 0, vy: -620, color: "#4fa3ff", damage: 1, fromPlayer: true },
        { x: x + 18, y, vx: 0, vy: -620, color: "#4fa3ff", damage: 1, fromPlayer: true },
        { x, y: y - 18, vx: 0, vy: -620, color: "#ffe066", damage: 1, fromPlayer: true },
      ];
    },
  },
  storm: {
    name: "סופה",
    cooldown: 0.12,
    sfx: "shoot.super",
    bullets(x, y) {
      const out = [];
      for (let i = -3; i <= 3; i++) {
        out.push({
          x: x + i * 4, y: y - 14, vx: i * 90, vy: -640,
          color: "#ff5b5b", damage: 2, fromPlayer: true, radius: 4,
        });
      }
      return out;
    },
  },
};
