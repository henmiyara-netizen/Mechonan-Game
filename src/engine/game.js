// Game — central controller. Holds world state, loop, level orchestration.

import { Input } from "./input.js";
import { ObjectPool } from "./object-pool.js";
import { sfx } from "../audio/sfx-manager.js";
import { Player, WEAPONS } from "../entities/player.js";
import {
  enemyFactory, enemyReset, updateEnemy, drawEnemy, enemyOnDeath, ENEMY_TYPES,
} from "../entities/enemy.js";
import {
  bulletFactory, bulletReset, updateBullet, drawBullet,
} from "../entities/bullet.js";
import {
  particleFactory, particleReset, updateParticle, drawParticle, spawnExplosion,
} from "../entities/particle.js";
import { QuizAsteroidGroup } from "../entities/asteroid-quiz.js";
import {
  getActiveProfile, recordAnswer, addXP, addCoins, unlockWeapon, setCurrentWeapon, recordEnemySeen, getShipUpgrades,
} from "../store/profiles.js";

const VIRTUAL_W = 1280;    // virtual coordinate space (16:9 landscape — better for PC)
const VIRTUAL_H = 720;

export class Game {
  constructor({ canvas, hud, onLevelComplete, onGameOver, askQuestion, askMidtest }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.hud = hud;
    this.onLevelComplete = onLevelComplete || (() => {});
    this.onGameOver = onGameOver || (() => {});
    this.askQuestion = askQuestion || (async () => ({ correct: false, choiceIndex: -1 }));
    this.askMidtest = askMidtest || (async () => ({ score: 0, total: 25 }));

    this.bounds = { w: VIRTUAL_W, h: VIRTUAL_H };

    this.input = new Input();
    this.input.setCanvas(canvas);

    this.bullets = new ObjectPool(bulletFactory, bulletReset);
    this.enemies = new ObjectPool(enemyFactory, enemyReset);
    this.particles = new ObjectPool(particleFactory, particleReset);

    this.player = new Player(VIRTUAL_W / 2, VIRTUAL_H - 80);
    this.starfield = makeStarfield(120, VIRTUAL_W, VIRTUAL_H);
    this.quiz = null;            // active QuizAsteroidGroup
    this.level = null;           // current level def
    this.waveIdx = 0;
    this.waveTimer = 0;          // time until next spawn within wave
    this.waveSpawnQueue = [];    // upcoming spawns: { delay, type, x }
    this.waveActive = false;
    this.levelCompleteSent = false;
    this.paused = false;
    this.running = false;
    this.lastTs = 0;
    this.transitionMsg = null;   // { text, until }
    this._loopBound = (ts) => this._loop(ts);

    this._resize();
    window.addEventListener("resize", () => this._resize());
  }

  _resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    // Maintain 3:5 portrait virtual ratio inside whatever element size we got
    this.canvas.width = Math.floor(VIRTUAL_W * dpr);
    this.canvas.height = Math.floor(VIRTUAL_H * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Also set CSS aspect ratio via inline style
    const targetRatio = VIRTUAL_W / VIRTUAL_H;
    const containerRatio = rect.width / rect.height;
    if (containerRatio > targetRatio) {
      // letterbox left/right
      const h = rect.height;
      const w = h * targetRatio;
      this.canvas.style.width = w + "px";
      this.canvas.style.height = h + "px";
    } else {
      const w = rect.width;
      const h = w / targetRatio;
      this.canvas.style.width = w + "px";
      this.canvas.style.height = h + "px";
    }
  }

  // ===== Public API =====
  startLevel(levelDef) {
    const profile = getActiveProfile();
    const shipId = profile?.progress.currentShip || "scout";
    const upgrades = getShipUpgrades(shipId);
    const ship = this.shipsRoster?.find((s) => s.id === shipId) || null;
    const baseStats = ship?.baseStats || { speed: 380, lives: 5, damageBonus: 0, fireRateMul: 1, radius: 18 };
    this.player.pilotName = profile?.name || "";
    this.player.weapon = profile?.progress.currentWeapon || "single";
    if (ship) this.player.applyShip(ship);
    this.player.lives = baseStats.lives + (upgrades.maxLivesBoost || 0);
    this.player.speed = baseStats.speed + (upgrades.speedBoost || 0) * 60;
    this.player.fireRateMul = (baseStats.fireRateMul || 1) * Math.max(0.3, 1 - (upgrades.fireRateBoost || 0) * 0.15);
    this.player.damageBonus = (baseStats.damageBonus || 0) + (upgrades.damageBoost || 0);
    this.player.invuln = ship?.ability === "extraStartShield" ? 5.0 : 2.0;
    this._levelStartLives = this.player.lives;
    this._lostLifeThisLevel = false;
    // Track end-of-level question correctness for level gating
    this._endQuestionsAsked = 0;
    this._endQuestionsCorrect = 0;
    this.player.x = VIRTUAL_W / 2;
    this.player.y = VIRTUAL_H - 80;
    this.player.alive = true;
    this.bullets.clear();
    this.enemies.clear();
    this.particles.clear();
    this.quiz = null;
    this.level = levelDef;
    this.waveIdx = -1;
    this.waveActive = false;
    this.waveTimer = 0;
    this.levelCompleteSent = false;
    this.transitionMsg = { text: `שלב ${levelDef.id}`, until: performance.now() + 1500 };
    this._updateHud();
    this._beginNextWave();
    if (!this.running) {
      this.running = true;
      this.lastTs = performance.now();
      requestAnimationFrame(this._loopBound);
    }
  }

  pause() { this.paused = true; }
  resume() { this.paused = false; this.lastTs = performance.now(); }
  stop() { this.running = false; }

  // ===== World api accessible to entities =====
  spawnEnemyBullet(opts) {
    this.bullets.acquire(opts);
  }
  spawnEnemy(opts) {
    this.enemies.acquire(opts);
    recordEnemySeen(opts.type);
  }

  // ===== Loop =====
  _loop(ts) {
    if (!this.running) return;
    const dt = Math.min(0.04, (ts - this.lastTs) / 1000);
    this.lastTs = ts;
    if (!this.paused) this._update(dt);
    this._render();
    requestAnimationFrame(this._loopBound);
  }

  _update(dt) {
    // Player
    this.player.update(dt, this.input, this.bounds);
    if (this.player.alive && !this.quiz) {
      // Auto-fire when input.pointer.fire OR Space pressed
      if (this.input.keys.Space || this.input.pointer.fire) {
        const shots = this.player.tryFire();
        if (shots) for (const s of shots) this.bullets.acquire(s);
      } else {
        // Always-on auto-fire on touch when finger is down (handled above) — for keyboard we require Space.
      }
    }

    // Bullets
    this.bullets.forEach((b) => updateBullet(b, dt, this.bounds));

    // Enemies
    const world = {
      bounds: this.bounds,
      player: this.player.alive ? this.player : null,
      spawnEnemyBullet: (o) => this.spawnEnemyBullet(o),
      spawnEnemy: (o) => this.spawnEnemy(o),
    };
    this.enemies.forEach((e) => updateEnemy(e, dt, world));

    // Particles
    this.particles.forEach((p) => updateParticle(p, dt));

    // Collisions: player bullets vs enemies
    this.bullets.forEach((b) => {
      if (!b.fromPlayer) return;
      this.enemies.forEach((e) => {
        if (!e.alive || !b.alive) return;
        const dx = b.x - e.x;
        const dy = b.y - e.y;
        const r = b.radius + e.radius;
        if (dx * dx + dy * dy < r * r) {
          e.hp -= b.damage;
          sfx.play("hit.enemy");
          spawnExplosion(this.particles, b.x, b.y, { count: 4, speed: 120, color: "#ffe066", life: 0.25, size: 2.5 });
          if (b.pierce > 0) b.pierce -= 1;
          else b.alive = false;
          if (e.hp <= 0) {
            this._killEnemy(e);
          }
        }
      });
    });

    // Collisions: enemies vs player & enemy-bullets vs player
    if (this.player.alive && this.player.invuln <= 0) {
      this.enemies.forEach((e) => {
        if (!e.alive) return;
        const dx = e.x - this.player.x;
        const dy = e.y - this.player.y;
        const r = e.radius + this.player.radius;
        if (dx * dx + dy * dy < r * r) {
          const result = this.player.takeDamage();
          if (result === "hit" || result === "dead" || result === "nuked") this._lostLifeThisLevel = true;
          if (result === "nuked") this._triggerAutoNuke();
          spawnExplosion(this.particles, e.x, e.y, { count: 14, color: e.color });
          this._killEnemy(e, /*noScore*/ true);
        }
      });
      this.bullets.forEach((b) => {
        if (b.fromPlayer || !b.alive) return;
        const dx = b.x - this.player.x;
        const dy = b.y - this.player.y;
        const r = b.radius + this.player.radius;
        if (dx * dx + dy * dy < r * r) {
          const result = this.player.takeDamage();
          if (result === "hit" || result === "dead" || result === "nuked") this._lostLifeThisLevel = true;
          if (result === "nuked") this._triggerAutoNuke();
          b.alive = false;
        }
      });
    }

    // Quiz asteroids
    if (this.quiz) {
      this.quiz.update(dt, this.bullets, (correct, asteroid) => {
        // Resolve current quiz
        const q = this.quiz.question;
        recordAnswer({ topic: q.topic, questionId: q.id, correct });
        if (correct) {
          addXP(20);
          addCoins(2);
          spawnExplosion(this.particles, asteroid.x, asteroid.y, { count: 28, color: "#4fff9c", speed: 280 });
        } else {
          addXP(-10);
          spawnExplosion(this.particles, asteroid.x, asteroid.y, { count: 16, color: "#ff5b5b", speed: 220 });
        }
        // Drop other asteroids quickly
        for (const a of this.quiz.asteroids) {
          if (a.alive) {
            spawnExplosion(this.particles, a.x, a.y, { count: 6, color: "#7a6c5d", speed: 140, life: 0.4 });
            a.alive = false;
          }
        }
        setTimeout(() => { this.quiz = null; this._updateHud(); }, 350);
      });
      // If quiz hits player
      const hit = this.quiz.collidesWithPlayer(this.player);
      if (hit && this.player.invuln <= 0) {
        this.player.takeDamage();
      }
    }

    // Sweep dead
    this.bullets.sweep();
    this.enemies.sweep();
    this.particles.sweep();

    // Wave / level progression
    if (this.player.alive && !this.quiz) {
      this._updateWaves(dt);
    }

    // Game over
    if (!this.player.alive && !this.levelCompleteSent) {
      this.levelCompleteSent = true; // reuse flag to avoid double
      sfx.play("game.over");
      setTimeout(() => this.onGameOver(), 800);
    }

    this._updateHud();
  }

  _triggerAutoNuke() {
    // Wipe all on-screen enemies + enemy bullets
    sfx.play("explosion.big");
    this.transitionMsg = { text: "💥 פצצת על!", until: performance.now() + 1500 };
    this.enemies.forEach((e) => {
      spawnExplosion(this.particles, e.x, e.y, { count: 12, color: e.color });
      e.alive = false;
    });
    this.bullets.forEach((b) => { if (!b.fromPlayer) b.alive = false; });
  }

  _killEnemy(e, noScore = false) {
    spawnExplosion(this.particles, e.x, e.y, { count: 18, color: e.color, speed: 240 });
    sfx.play(e.maxHp > 3 ? "explosion.medium" : "explosion.small");
    e.alive = false;
    enemyOnDeath(e, {
      bounds: this.bounds,
      player: this.player,
      spawnEnemy: (o) => this.spawnEnemy(o),
      spawnEnemyBullet: (o) => this.spawnEnemyBullet(o),
    });
    if (!noScore) addXP(e.points);
  }

  _beginNextWave() {
    this.waveIdx += 1;
    if (!this.level || this.waveIdx >= this.level.waves.length) {
      this._completeLevel();
      return;
    }
    const wave = this.level.waves[this.waveIdx];
    this.waveActive = true;
    this.waveSpawnQueue = [];
    this.waveTimer = 0;
    sfx.play("wave.start");

    // Build spawn queue based on wave kind
    if (wave.kind === "asteroid-quiz") {
      // Triggered later from question system — main caller will set this.quiz directly
      // We pause spawning until quiz resolves
      this.waveActive = false;
      this._requestQuizWave(wave);
    } else {
      let t = 0.4;
      const cols = wave.formation === "v" ? wave.count : wave.cols || wave.count;
      for (let i = 0; i < wave.count; i++) {
        const col = i % cols;
        const x = wave.spawnX || (this.bounds.w * (col + 1) / (cols + 1));
        let xJitter = 0;
        if (wave.formation === "spread") xJitter = (Math.random() - 0.5) * (this.bounds.w - 80);
        this.waveSpawnQueue.push({
          delay: t + (Math.floor(i / cols) * (wave.rowDelay || 0.4)),
          type: wave.type,
          x: x + xJitter,
        });
        t += wave.spacing || 0.18;
      }
    }
    this._updateHud();
  }

  _requestQuizWave(wave) {
    // Caller gives us a question via async — implemented externally via askQuestion override
    this.askQuestion({ topic: wave.topic, kind: "asteroid", forceVisual: wave.visual ?? false }).then((q) => {
      if (!q || q.question?.bodyImage) {
        // No question available, or it's an image-based question (can't render in asteroid mode) — skip
        this.waveActive = false;
        this._beginNextWave();
        return;
      }
      this.quiz = new QuizAsteroidGroup(q.question, q.correctIndex, this);
      this.waveActive = false;
      const startTs = performance.now();
      const watch = setInterval(() => {
        if (this.quiz === null) {
          clearInterval(watch);
          this._beginNextWave();
        } else if (performance.now() - startTs > 30000) {
          // Failsafe: auto-resolve after 30s
          clearInterval(watch);
          this.quiz = null;
          this._beginNextWave();
        }
      }, 200);
    });
  }

  _updateWaves(dt) {
    if (this.waveActive) {
      this.waveTimer += dt;
      while (this.waveSpawnQueue.length && this.waveSpawnQueue[0].delay <= this.waveTimer) {
        const s = this.waveSpawnQueue.shift();
        this.spawnEnemy({ type: s.type, x: s.x, y: -30 });
      }
      // Wave ends when queue empty AND no enemies left
      if (this.waveSpawnQueue.length === 0 && this.enemies.count === 0) {
        this.waveActive = false;
        // Delay before next wave
        this._waveCooldown = 0.7;
      }
      // Failsafe: if wave is taking too long (> 90s), kill remaining enemies
      else if (this.waveTimer > 90 && this.waveSpawnQueue.length === 0) {
        this.enemies.forEach((e) => {
          spawnExplosion(this.particles, e.x, e.y, { count: 12, color: e.color });
          e.alive = false;
        });
        this.waveActive = false;
        this._waveCooldown = 0.7;
        this.transitionMsg = { text: "🆘 שלב מתקדם...", until: performance.now() + 1500 };
      }
    } else if (!this.quiz) {
      // Wait between waves
      if (this._waveCooldown > 0) {
        this._waveCooldown -= dt;
        if (this._waveCooldown <= 0) {
          // Maybe show inter-wave question popup
          const wave = this.level.waves[this.waveIdx];
          const showQuestion = wave && wave.endQuestion;
          if (showQuestion) {
            this.paused = true;
            this._askEndQuestionsSequentially(wave.endQuestion.topic, 2).then((correctCount) => {
              this.paused = false;
              // Reward unlock weapon if at least one was correct (favors trying)
              if (correctCount >= 1) this._maybeUnlockNextWeapon();
              this._beginNextWave();
            });
          } else {
            this._beginNextWave();
          }
        }
      }
    }
  }

  async _askEndQuestionsSequentially(topic, count) {
    let correctCount = 0;
    for (let i = 0; i < count; i++) {
      const result = await this.askQuestion({ topic });
      this._endQuestionsAsked = (this._endQuestionsAsked || 0) + 1;
      if (result && result.correct) {
        correctCount += 1;
        this._endQuestionsCorrect = (this._endQuestionsCorrect || 0) + 1;
      }
    }
    return correctCount;
  }

  _maybeUnlockNextWeapon() {
    const profile = getActiveProfile();
    if (!profile) return;
    const order = ["single", "double", "triple", "laser", "super", "rapid", "spread5", "pierce", "flank", "storm"];
    for (const w of order) {
      if (!profile.progress.unlockedWeapons.includes(w)) {
        unlockWeapon(w);
        setCurrentWeapon(w);
        this.player.setWeapon(w);
        sfx.play("powerup.weapon");
        this.transitionMsg = { text: `נשק חדש: ${WEAPONS[w].name}!`, until: performance.now() + 1800 };
        return;
      }
    }
    // All unlocked — give XP boost instead
    addXP(30);
  }

  _completeLevel() {
    if (this.levelCompleteSent) return;
    this.levelCompleteSent = true;
    sfx.play("level.complete");
    this.transitionMsg = { text: "שלב הושלם!", until: performance.now() + 2000 };
    const allEndQuestionsCorrect = this._endQuestionsAsked === 0 || this._endQuestionsCorrect === this._endQuestionsAsked;
    setTimeout(() => this.onLevelComplete(this.level, {
      lostLifeThisLevel: this._lostLifeThisLevel,
      allEndQuestionsCorrect,
      endQuestionsAsked: this._endQuestionsAsked,
      endQuestionsCorrect: this._endQuestionsCorrect,
    }), 1600);
  }

  // ===== Render =====
  _render() {
    const ctx = this.ctx;
    // Background
    ctx.fillStyle = "#06091a";
    ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);
    drawStarfield(ctx, this.starfield, VIRTUAL_W, VIRTUAL_H);

    // Particles (under)
    this.particles.forEach((p) => drawParticle(p, ctx));

    // Player
    this.player.draw(ctx);

    // Bullets
    this.bullets.forEach((b) => drawBullet(b, ctx));

    // Enemies
    this.enemies.forEach((e) => drawEnemy(e, ctx));

    // Quiz asteroids
    if (this.quiz) this.quiz.draw(ctx);

    // Transition message
    if (this.transitionMsg && performance.now() < this.transitionMsg.until) {
      const a = 1;
      ctx.save();
      ctx.fillStyle = `rgba(10, 14, 26, ${0.7 * a})`;
      ctx.fillRect(0, VIRTUAL_H * 0.4, VIRTUAL_W, 80);
      ctx.fillStyle = `rgba(255, 224, 102, ${a})`;
      ctx.font = "bold 32px Rubik, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(this.transitionMsg.text, VIRTUAL_W / 2, VIRTUAL_H * 0.4 + 40);
      ctx.restore();
    }
  }

  _updateHud() {
    if (!this.hud) return;
    const profile = getActiveProfile();
    const xp = profile?.progress.xp ?? 0;
    const coins = profile?.progress.coins ?? 0;
    this.hud.setLevel(this.level?.id ?? 1);
    this.hud.setWave(this.waveIdx + 1, this.level?.waves.length ?? 1);
    this.hud.setLives(this.player.lives);
    this.hud.setXP(xp);
    this.hud.setCoins(coins);
    this.hud.setWeapon(WEAPONS[this.player.weapon]?.name || "—");
  }
}

// ===== Starfield =====
function makeStarfield(count, w, h) {
  const stars = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * w,
      y: Math.random() * h,
      vy: 20 + Math.random() * 80,
      size: Math.random() * 1.6 + 0.4,
      alpha: 0.4 + Math.random() * 0.6,
    });
  }
  return stars;
}
function drawStarfield(ctx, stars, w, h) {
  // We update + draw at once for simplicity
  for (const s of stars) {
    s.y += s.vy / 60; // approximate per-frame
    if (s.y > h) { s.y = -2; s.x = Math.random() * w; }
    ctx.fillStyle = `rgba(220, 230, 255, ${s.alpha})`;
    ctx.fillRect(s.x, s.y, s.size, s.size);
  }
}
