// Enemy — driven by a per-type behavior fn. Definitions live in enemy types map below
// (mirroring src/content/enemies.json semantics for the MVP).

import { sfx } from "../audio/sfx-manager.js";

export function enemyFactory() {
  return {
    x: 0, y: 0, vx: 0, vy: 0,
    type: "drone",
    hp: 1, maxHp: 1,
    radius: 16,
    points: 5,
    age: 0,
    spawnY: 0,
    spawnX: 0,
    fireCooldown: 0,
    alive: false,
    color: "#ff5b8a",
    behaviorState: 0,
  };
}

export function enemyReset(e, opts) {
  const t = ENEMY_TYPES[opts.type] || ENEMY_TYPES.drone;
  e.type = opts.type;
  e.x = opts.x; e.y = opts.y;
  e.spawnX = opts.x; e.spawnY = opts.y;
  e.vx = opts.vx ?? 0; e.vy = opts.vy ?? t.baseVy;
  e.radius = t.radius;
  e.hp = t.hp; e.maxHp = t.hp;
  e.points = t.points;
  e.color = t.color;
  e.age = 0;
  e.fireCooldown = (Math.random() * 1.2) + 0.5;
  e.behaviorState = 0;
}

export function updateEnemy(e, dt, world) {
  const t = ENEMY_TYPES[e.type] || ENEMY_TYPES.drone;
  e.age += dt;
  t.update(e, dt, world);
  // Despawn off-screen
  if (e.y > world.bounds.h + 60 || e.x < -80 || e.x > world.bounds.w + 80) {
    e.alive = false;
  }
}

export function drawEnemy(e, ctx) {
  const t = ENEMY_TYPES[e.type] || ENEMY_TYPES.drone;
  ctx.save();
  if (t.draw) t.draw(e, ctx);
  else _defaultDraw(e, ctx);
  // HP bar (small) for armored types
  if (e.maxHp > 1 && e.hp < e.maxHp) {
    const w = e.radius * 2;
    ctx.fillStyle = "rgba(0,0,0,.5)";
    ctx.fillRect(e.x - w / 2, e.y - e.radius - 8, w, 4);
    ctx.fillStyle = "#4fff9c";
    ctx.fillRect(e.x - w / 2, e.y - e.radius - 8, w * (e.hp / e.maxHp), 4);
  }
  ctx.restore();
}

function _defaultDraw(e, ctx) {
  ctx.shadowBlur = 14; ctx.shadowColor = e.color;
  ctx.fillStyle = e.color;
  ctx.beginPath();
  ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(255, 255, 255, .7)";
  ctx.beginPath();
  ctx.arc(e.x, e.y - e.radius * 0.3, e.radius * 0.3, 0, Math.PI * 2);
  ctx.fill();
}

// ===== Built-in enemy types (10 for MVP) =====
export const ENEMY_TYPES = {
  drone: {
    hp: 1, radius: 14, baseVy: 130, points: 5, color: "#ff7b9a",
    update(e, dt) { e.y += e.vy * dt; },
  },
  zigzag: {
    hp: 1, radius: 13, baseVy: 110, points: 8, color: "#ffd24f",
    update(e, dt) { e.y += e.vy * dt; e.x = e.spawnX + Math.sin(e.age * 4) * 60; },
  },
  fast: {
    hp: 1, radius: 11, baseVy: 230, points: 7, color: "#4fff9c",
    update(e, dt) { e.y += e.vy * dt; },
    draw(e, ctx) {
      ctx.shadowBlur = 14; ctx.shadowColor = e.color;
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y + e.radius);
      ctx.lineTo(e.x + e.radius, e.y);
      ctx.lineTo(e.x, e.y - e.radius);
      ctx.lineTo(e.x - e.radius, e.y);
      ctx.closePath();
      ctx.fill();
    },
  },
  armored: {
    hp: 4, radius: 20, baseVy: 80, points: 25, color: "#9aa3c4",
    update(e, dt) { e.y += e.vy * dt; },
    draw(e, ctx) {
      ctx.shadowBlur = 8; ctx.shadowColor = e.color;
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.rect(e.x - e.radius, e.y - e.radius, e.radius * 2, e.radius * 2);
      ctx.fill();
      ctx.fillStyle = "#243056";
      ctx.beginPath();
      ctx.rect(e.x - e.radius * 0.5, e.y - e.radius * 0.5, e.radius, e.radius);
      ctx.fill();
    },
  },
  tank: {
    hp: 6, radius: 24, baseVy: 60, points: 40, color: "#6a7099",
    update(e, dt) {
      e.y += e.vy * dt;
      e.fireCooldown -= dt;
      if (e.fireCooldown <= 0) {
        e.fireCooldown = 1.6;
        // Trigger event
      }
    },
    draw(e, ctx) {
      ctx.shadowBlur = 8; ctx.shadowColor = e.color;
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.rect(e.x - e.radius, e.y - e.radius * 0.6, e.radius * 2, e.radius * 1.2);
      ctx.fill();
      ctx.fillStyle = "#ff5b5b";
      ctx.beginPath();
      ctx.rect(e.x - 4, e.y - e.radius - 4, 8, 12);
      ctx.fill();
    },
  },
  shooter: {
    hp: 2, radius: 16, baseVy: 90, points: 15, color: "#ff5b5b",
    update(e, dt, world) {
      e.y += e.vy * dt;
      e.fireCooldown -= dt;
      if (e.fireCooldown <= 0 && e.y > 30 && e.y < world.bounds.h - 100) {
        e.fireCooldown = 1.4 + Math.random() * 0.6;
        world.spawnEnemyBullet({
          x: e.x, y: e.y + e.radius, vx: 0, vy: 280,
          color: "#ff5b5b", damage: 1, fromPlayer: false, radius: 5,
        });
        sfx.play("enemy.shoot");
      }
    },
  },
  zigShooter: {
    hp: 2, radius: 15, baseVy: 100, points: 18, color: "#ff8a4f",
    update(e, dt, world) {
      e.y += e.vy * dt;
      e.x = e.spawnX + Math.sin(e.age * 3) * 80;
      e.fireCooldown -= dt;
      if (e.fireCooldown <= 0 && e.y > 30 && e.y < world.bounds.h - 100) {
        e.fireCooldown = 1.8 + Math.random() * 0.6;
        world.spawnEnemyBullet({
          x: e.x, y: e.y + e.radius, vx: 0, vy: 260,
          color: "#ff8a4f", damage: 1, fromPlayer: false, radius: 5,
        });
        sfx.play("enemy.shoot");
      }
    },
  },
  diver: {
    hp: 1, radius: 14, baseVy: 90, points: 10, color: "#ff5b8a",
    update(e, dt, world) {
      // Slow down to a hover, then dive at player
      const phaseHover = 1.2;
      if (e.age < phaseHover) {
        e.y += 80 * dt;
      } else {
        if (e.behaviorState === 0) {
          e.behaviorState = 1;
          const target = world.player;
          if (target) {
            const dx = target.x - e.x;
            const dy = target.y - e.y;
            const len = Math.hypot(dx, dy) || 1;
            const speed = 320;
            e.vx = (dx / len) * speed;
            e.vy = (dy / len) * speed;
          } else {
            e.vy = 320;
          }
        }
        e.x += e.vx * dt;
        e.y += e.vy * dt;
      }
    },
  },
  splitter: {
    hp: 3, radius: 22, baseVy: 70, points: 20, color: "#b35bff",
    update(e, dt) { e.y += e.vy * dt; },
    onDeath(e, world) {
      // Spawn 2 small drones
      for (const dx of [-22, 22]) {
        world.spawnEnemy({ type: "drone", x: e.x + dx, y: e.y });
      }
    },
    draw(e, ctx) {
      ctx.shadowBlur = 16; ctx.shadowColor = e.color;
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0a0e1a";
      ctx.beginPath();
      ctx.arc(e.x - 6, e.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(e.x + 6, e.y, 4, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  kamikaze: {
    hp: 1, radius: 13, baseVy: 200, points: 12, color: "#ff3030",
    update(e, dt, world) {
      const target = world.player;
      if (target) {
        const dx = target.x - e.x;
        const dy = target.y - e.y;
        const len = Math.hypot(dx, dy) || 1;
        const speed = 260;
        e.vx = (dx / len) * speed;
        e.vy = Math.max((dy / len) * speed, 60); // never go up
      }
      e.x += e.vx * dt;
      e.y += e.vy * dt;
    },
    draw(e, ctx) {
      const pulse = 1 + Math.sin(e.age * 14) * 0.12;
      ctx.shadowBlur = 16; ctx.shadowColor = e.color;
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 14px Rubik, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("!", e.x, e.y);
    },
  },

  // ===== Phase 2 enemies =====
  swarmer: {
    hp: 1, radius: 10, baseVy: 180, points: 6, color: "#9aa3c4",
    update(e, dt) { e.y += e.vy * dt; e.x = e.spawnX + Math.sin(e.age * 6) * 30; },
  },
  bomber: {
    hp: 3, radius: 18, baseVy: 80, points: 22, color: "#7a4fbb",
    update(e, dt, world) {
      e.y += e.vy * dt;
      e.fireCooldown -= dt;
      if (e.fireCooldown <= 0 && e.y > 30 && e.y < world.bounds.h - 100) {
        e.fireCooldown = 2.0;
        for (let i = -1; i <= 1; i++) {
          world.spawnEnemyBullet({
            x: e.x + i * 8, y: e.y + e.radius, vx: i * 80, vy: 220,
            color: "#9b5bff", damage: 1, fromPlayer: false, radius: 5,
          });
        }
        sfx.play("enemy.shoot");
      }
    },
    draw(e, ctx) {
      ctx.shadowBlur = 12; ctx.shadowColor = e.color;
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.ellipse(e.x, e.y, e.radius * 1.2, e.radius * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(e.x, e.y, 4, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  sniper: {
    hp: 2, radius: 14, baseVy: 60, points: 18, color: "#ff8a4f",
    update(e, dt, world) {
      e.y += e.vy * dt;
      e.fireCooldown -= dt;
      if (e.fireCooldown <= 0 && world.player) {
        e.fireCooldown = 2.5;
        const dx = world.player.x - e.x;
        const dy = world.player.y - e.y;
        const len = Math.hypot(dx, dy) || 1;
        const speed = 320;
        world.spawnEnemyBullet({
          x: e.x, y: e.y + e.radius, vx: (dx / len) * speed, vy: (dy / len) * speed,
          color: "#ff8a4f", damage: 1, fromPlayer: false, radius: 4,
        });
        sfx.play("enemy.shoot");
      }
    },
    draw(e, ctx) {
      ctx.shadowBlur = 12; ctx.shadowColor = e.color;
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y - e.radius);
      ctx.lineTo(e.x + e.radius, e.y);
      ctx.lineTo(e.x, e.y + e.radius);
      ctx.lineTo(e.x - e.radius, e.y);
      ctx.closePath();
      ctx.fill();
    },
  },
  speedy: {
    hp: 1, radius: 9, baseVy: 320, points: 10, color: "#5cf5ff",
    update(e, dt) { e.y += e.vy * dt; },
    draw(e, ctx) {
      ctx.shadowBlur = 16; ctx.shadowColor = e.color;
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y + e.radius);
      ctx.lineTo(e.x + e.radius, e.y - e.radius);
      ctx.lineTo(e.x - e.radius, e.y - e.radius);
      ctx.closePath();
      ctx.fill();
    },
  },
  shielded: {
    hp: 5, radius: 18, baseVy: 70, points: 35, color: "#4fb8ff",
    update(e, dt) { e.y += e.vy * dt; },
    draw(e, ctx) {
      ctx.shadowBlur = 14; ctx.shadowColor = e.color;
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
      ctx.fill();
      // Shield ring
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius + 6 + Math.sin(e.age * 6) * 1.5, 0, Math.PI * 2);
      ctx.stroke();
    },
  },
  hovering: {
    hp: 2, radius: 14, baseVy: 90, points: 14, color: "#ffd24f",
    update(e, dt, world) {
      // Drop to a hover line, sway briefly, then dive
      const hoverY = e.spawnY + 280;
      const hoverStart = (hoverY - e.spawnY) / 90; // time to reach hover
      const hoverDuration = 6;                       // seconds of hovering
      if (e.y < hoverY && e.behaviorState === 0) {
        e.y += e.vy * dt;
      } else if (e.behaviorState === 0) {
        // Hover phase
        e.x = e.spawnX + Math.sin(e.age * 2.5) * 90;
        if (e.age > hoverStart + hoverDuration) {
          e.behaviorState = 1;
          // Aim at player for dive
          const target = world.player;
          if (target) {
            const dx = target.x - e.x;
            const dy = target.y - e.y;
            const len = Math.hypot(dx, dy) || 1;
            e.vx = (dx / len) * 280;
            e.vy = Math.max((dy / len) * 280, 80);
          } else {
            e.vy = 280; e.vx = 0;
          }
        }
      } else {
        // Diving phase
        e.x += e.vx * dt;
        e.y += e.vy * dt;
      }
    },
  },
  pulser: {
    hp: 4, radius: 17, baseVy: 50, points: 28, color: "#ff5bd9",
    update(e, dt, world) {
      e.y += e.vy * dt;
      e.fireCooldown -= dt;
      if (e.fireCooldown <= 0 && e.y > 30) {
        e.fireCooldown = 1.8;
        // Radial burst of 8 bullets
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          world.spawnEnemyBullet({
            x: e.x, y: e.y, vx: Math.cos(angle) * 200, vy: Math.sin(angle) * 200,
            color: "#ff5bd9", damage: 1, fromPlayer: false, radius: 4,
          });
        }
        sfx.play("enemy.shoot");
      }
    },
    draw(e, ctx) {
      const pulse = 1 + Math.sin(e.age * 5) * 0.1;
      ctx.shadowBlur = 18; ctx.shadowColor = e.color;
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(e.x, e.y, 5, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  ghost: {
    hp: 2, radius: 14, baseVy: 100, points: 16, color: "#9ab5d8",
    update(e, dt) {
      e.y += e.vy * dt;
      e.x = e.spawnX + Math.sin(e.age * 1.5) * 110;
    },
    draw(e, ctx) {
      // Pulsing alpha for ghostly look
      const a = 0.4 + Math.abs(Math.sin(e.age * 3)) * 0.6;
      ctx.globalAlpha = a;
      ctx.shadowBlur = 10; ctx.shadowColor = e.color;
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    },
  },
  juggernaut: {
    hp: 10, radius: 30, baseVy: 35, points: 80, color: "#5d4a8c",
    update(e, dt, world) {
      e.y += e.vy * dt;
      e.fireCooldown -= dt;
      if (e.fireCooldown <= 0 && e.y > 30) {
        e.fireCooldown = 1.2;
        // Triple downward shot
        for (let i = -1; i <= 1; i++) {
          world.spawnEnemyBullet({
            x: e.x + i * 12, y: e.y + e.radius, vx: 0, vy: 240,
            color: "#9b8bcf", damage: 1, fromPlayer: false, radius: 5,
          });
        }
        sfx.play("enemy.shoot");
      }
    },
    draw(e, ctx) {
      ctx.shadowBlur = 8; ctx.shadowColor = e.color;
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.rect(e.x - e.radius, e.y - e.radius, e.radius * 2, e.radius * 2);
      ctx.fill();
      // Inner shield X
      ctx.strokeStyle = "#ffd24f";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(e.x - e.radius * 0.6, e.y - e.radius * 0.6);
      ctx.lineTo(e.x + e.radius * 0.6, e.y + e.radius * 0.6);
      ctx.moveTo(e.x + e.radius * 0.6, e.y - e.radius * 0.6);
      ctx.lineTo(e.x - e.radius * 0.6, e.y + e.radius * 0.6);
      ctx.stroke();
    },
  },
  miniBoss: {
    hp: 20, radius: 36, baseVy: 25, points: 200, color: "#ff3030",
    update(e, dt, world) {
      e.y += e.vy * dt;
      // Hover at top once reaches certain height
      const hoverY = 130;
      const enrageAt = 60; // after 60s of hovering, charge down
      if (e.y > hoverY && e.behaviorState === 0) { e.y = hoverY; e.x = e.spawnX + Math.sin(e.age * 1.2) * 150; }
      // Enrage and dive if too long
      if (e.behaviorState === 0 && e.age > enrageAt) {
        e.behaviorState = 1;
        e.vy = 200;
      } else if (e.behaviorState === 1) {
        e.y += 200 * dt;
        // Slight tracking
        const target = world.player;
        if (target) e.x += Math.sign(target.x - e.x) * 60 * dt;
      }
      e.fireCooldown -= dt;
      if (e.fireCooldown <= 0) {
        e.fireCooldown = 0.9;
        // Fan of 5 bullets
        for (let i = -2; i <= 2; i++) {
          world.spawnEnemyBullet({
            x: e.x, y: e.y + e.radius, vx: i * 80, vy: 260,
            color: "#ff5b5b", damage: 1, fromPlayer: false, radius: 5,
          });
        }
        sfx.play("enemy.shoot");
      }
    },
    draw(e, ctx) {
      ctx.shadowBlur = 22; ctx.shadowColor = e.color;
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1a0d0d";
      // Crown points
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(e.x + i * 9, e.y - e.radius);
        ctx.lineTo(e.x + i * 9 + 4, e.y - e.radius - 12);
        ctx.lineTo(e.x + i * 9 + 8, e.y - e.radius);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = "#ffe066";
      ctx.beginPath();
      ctx.arc(e.x, e.y - 4, 6, 0, Math.PI * 2);
      ctx.fill();
    },
  },
};

export function enemyOnDeath(e, world) {
  const t = ENEMY_TYPES[e.type];
  if (t && t.onDeath) t.onDeath(e, world);
}
