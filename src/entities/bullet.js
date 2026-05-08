// Bullet — works for both player & enemy bullets.
// Pool-friendly: factory + reset.

export function bulletFactory() {
  return {
    x: 0, y: 0, vx: 0, vy: 0,
    radius: 4,
    damage: 1,
    pierce: 0,           // remaining pierce-through enemies
    color: "#ffe066",
    fromPlayer: true,
    alive: false,
    age: 0,
    maxAge: 5,           // seconds before auto-despawn
    style: "bullet",     // "bullet" | "laser" | "missile"
  };
}

export function bulletReset(b, opts) {
  b.x = opts.x;
  b.y = opts.y;
  b.vx = opts.vx ?? 0;
  b.vy = opts.vy;
  b.radius = opts.radius ?? 4;
  b.damage = opts.damage ?? 1;
  b.pierce = opts.pierce ?? 0;
  b.color = opts.color || "#ffe066";
  b.fromPlayer = opts.fromPlayer ?? true;
  b.style = opts.style || "bullet";
  b.age = 0;
  b.maxAge = opts.maxAge ?? 5;
}

export function updateBullet(b, dt, bounds) {
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.age += dt;
  if (b.age > b.maxAge) b.alive = false;
  if (b.x < -20 || b.x > bounds.w + 20 || b.y < -20 || b.y > bounds.h + 20) b.alive = false;
}

export function drawBullet(b, ctx) {
  ctx.save();
  if (b.style === "laser") {
    const grd = ctx.createLinearGradient(b.x, b.y - 14, b.x, b.y + 14);
    grd.addColorStop(0, "rgba(255,255,255,0)");
    grd.addColorStop(0.5, b.color);
    grd.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grd;
    ctx.fillRect(b.x - b.radius, b.y - 18, b.radius * 2, 36);
  } else {
    ctx.shadowBlur = 12;
    ctx.shadowColor = b.color;
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
