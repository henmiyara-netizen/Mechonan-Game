// Particle — for explosions, sparks, XP pickups.

export function particleFactory() {
  return { x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 0.5, size: 2, color: "#fff", drag: 0.92, alive: false };
}
export function particleReset(p, opts) {
  p.x = opts.x; p.y = opts.y;
  p.vx = opts.vx; p.vy = opts.vy;
  p.age = 0;
  p.life = opts.life ?? 0.5;
  p.size = opts.size ?? 3;
  p.color = opts.color || "#ffe066";
  p.drag = opts.drag ?? 0.92;
}
export function updateParticle(p, dt) {
  p.x += p.vx * dt; p.y += p.vy * dt;
  p.vx *= p.drag; p.vy *= p.drag;
  p.age += dt;
  if (p.age >= p.life) p.alive = false;
}
export function drawParticle(p, ctx) {
  const a = Math.max(0, 1 - p.age / p.life);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function spawnExplosion(particles, x, y, opts = {}) {
  const count = opts.count ?? 18;
  const speed = opts.speed ?? 220;
  const color = opts.color || "#ffb04f";
  const size = opts.size ?? 3.5;
  const life = opts.life ?? 0.6;
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.4 + Math.random() * 0.8);
    particles.acquire({
      x, y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life: life * (0.6 + Math.random() * 0.8),
      size: size * (0.7 + Math.random() * 0.7),
      color,
      drag: 0.92,
    });
  }
}
