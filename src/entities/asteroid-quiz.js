// "Asteroid Quiz" — 4 asteroids each with a letter (א/ב/ג/ד) labeling answer choices.
// Player shoots the right one. Hitting wrong = penalty. Hitting right = correct answer.
// The actual question is rendered in the HUD area above the asteroids.
//
// Used for visual question types (shapes, sequences) where the answer choices fit nicely on rocks.
//
// State: array of 4 quiz-asteroids with the same questionId, with one correctIndex.

import { sfx } from "../audio/sfx-manager.js";

const HEB_LETTERS = ["א", "ב", "ג", "ד"];

export class QuizAsteroidGroup {
  constructor(question, correctIndex, world) {
    this.question = question;
    this.correctIndex = correctIndex;
    this.world = world;
    this.resolved = false;
    this.asteroids = [];
    this.elapsed = 0;
    const w = world.bounds.w;
    const spacing = w / 5;
    // HP distribution: shuffle [1, 1, 2, 3] across the 4 positions for variety.
    // Always at least one easy (1 HP) and one hard (3 HP) asteroid per quiz.
    const hpPool = [1, 1, 2, 3];
    for (let i = hpPool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [hpPool[i], hpPool[j]] = [hpPool[j], hpPool[i]];
    }
    for (let i = 0; i < 4; i++) {
      const hp = hpPool[i];
      this.asteroids.push({
        x: spacing * (i + 1),
        y: -40,
        targetY: 130,
        vy: 60 + Math.random() * 30,
        radius: 32 + hp * 4,           // bigger = tougher
        letter: HEB_LETTERS[i],
        choice: question.choices?.[i] || "",
        index: i,
        hp: hp,
        maxHp: hp,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 1.5,
        alive: true,
        flashHit: 0,
      });
    }
    sfx.play("asteroid.spawn");
  }

  update(dt, bullets, onResolve) {
    this.elapsed += dt;
    for (const a of this.asteroids) {
      if (!a.alive) continue;
      // Drift toward target line, then hover with sway
      if (a.y < a.targetY) a.y += a.vy * dt;
      else a.y = a.targetY + Math.sin(this.elapsed * 1.5 + a.index) * 6;
      a.rotation += a.rotSpeed * dt;
      if (a.flashHit > 0) a.flashHit -= dt;
    }
    // Collide with player bullets
    bullets.forEach((b) => {
      if (!b.fromPlayer) return;
      for (const a of this.asteroids) {
        if (!a.alive) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        if (dx * dx + dy * dy < (a.radius + b.radius) ** 2) {
          a.flashHit = 0.12;
          a.hp -= b.damage;
          b.alive = false;
          if (a.hp <= 0 && !this.resolved) {
            a.alive = false;
            this.resolved = true;
            const correct = a.index === this.correctIndex;
            sfx.play(correct ? "answer.correct" : "asteroid.shatter");
            onResolve(correct, a);
          }
          break;
        }
      }
    });
  }

  draw(ctx) {
    ctx.save();
    // Question banner
    ctx.fillStyle = "rgba(10, 14, 26, 0.85)";
    ctx.fillRect(20, 20, ctx.canvas.width - 40, 64);
    ctx.strokeStyle = "rgba(79, 163, 255, 0.6)";
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, ctx.canvas.width - 40, 64);
    ctx.fillStyle = "#e8ebf5";
    ctx.font = "bold 18px Rubik, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.direction = "rtl";
    ctx.fillText(this.question.body || this.question.text || "?", ctx.canvas.width / 2, 52);

    // Color by max HP: brown=easy, gray=medium, dark-red=hard
    const HP_COLORS = { 1: "#a08060", 2: "#7a6c8d", 3: "#8c4a4a" };

    for (const a of this.asteroids) {
      if (!a.alive) continue;
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(a.rotation);

      const baseColor = HP_COLORS[a.maxHp] || "#7a6c5d";
      const hue = a.flashHit > 0 ? "#ff5b5b" : baseColor;
      ctx.shadowBlur = 12;
      ctx.shadowColor = a.flashHit > 0 ? "#ff5b5b" : "#000";
      ctx.fillStyle = hue;
      ctx.beginPath();
      const segs = 9;
      for (let i = 0; i < segs; i++) {
        const ang = (i / segs) * Math.PI * 2;
        const r = a.radius * (0.85 + Math.sin(i * 7) * 0.18);
        const px = Math.cos(ang) * r;
        const py = Math.sin(ang) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();

      // Letter
      ctx.rotate(-a.rotation);
      ctx.fillStyle = "#ffe066";
      ctx.font = "bold 22px Rubik, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowBlur = 0;
      ctx.fillText(a.letter, 0, 0);

      ctx.restore();

      // HP bar above asteroid (only if maxHp > 1)
      if (a.maxHp > 1) {
        const barW = a.radius * 1.6;
        const barH = 5;
        const bx = a.x - barW / 2;
        const by = a.y - a.radius - 14;
        ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
        ctx.fillRect(bx, by, barW, barH);
        ctx.fillStyle = a.hp / a.maxHp > 0.5 ? "#4fff9c" : "#ffd24f";
        ctx.fillRect(bx, by, barW * (a.hp / a.maxHp), barH);
      }

      // Choice text below
      if (a.choice) {
        ctx.fillStyle = "rgba(232, 235, 245, 0.95)";
        ctx.font = "bold 14px Rubik, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(String(a.choice), a.x, a.y + a.radius + 6);
      }
    }
    ctx.restore();
  }

  // Asteroid hits player check
  collidesWithPlayer(player) {
    for (const a of this.asteroids) {
      if (!a.alive) continue;
      const dx = a.x - player.x;
      const dy = a.y - player.y;
      if (dx * dx + dy * dy < (a.radius + player.radius) ** 2) return a;
    }
    return null;
  }
}
