// Per-ship sprite drawers — shared between gameplay (player.js) and UI (hangar.js).
// Each function takes (ctx, x, y, r, color, phase) where phase is a time-based animation seed (sec).

export function drawScout(ctx, x, y, r, color) {
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

export function drawLightning(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r * 1.2);
  ctx.lineTo(x + r * 0.7, y + r * 0.3);
  ctx.lineTo(x + 4, y + r * 0.6);
  ctx.lineTo(x - 4, y + r * 0.6);
  ctx.lineTo(x - r * 0.7, y + r * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(x, y - 4, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#ffe066";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 3, y + 2);
  ctx.lineTo(x + 1, y + 6);
  ctx.lineTo(x - 1, y + 6);
  ctx.lineTo(x + 3, y + 12);
  ctx.stroke();
}

export function drawGuardian(ctx, x, y, r, color, phase = 0) {
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
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(79, 163, 255, 0.7)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r + 6 + Math.sin(phase * 3) * 1.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#1a1305";
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fill();
}

export function drawSpreader(ctx, x, y, r, color) {
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

export function drawPlasma(ctx, x, y, r, color, phase = 0) {
  const pulse = 1 + Math.sin(phase * 6) * 0.08;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r * pulse);
  ctx.lineTo(x + r * pulse * 0.8, y);
  ctx.lineTo(x, y + r * pulse * 0.7);
  ctx.lineTo(x - r * pulse * 0.8, y);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  const grd = ctx.createRadialGradient(x, y, 0, x, y, r * 0.6);
  grd.addColorStop(0, "rgba(255, 255, 255, 0.9)");
  grd.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.6, 0, Math.PI * 2);
  ctx.fill();
}

export function drawPhantom(ctx, x, y, r, color, phase = 0) {
  const a = 0.55 + Math.abs(Math.sin(phase * 4)) * 0.4;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x + r * 1.1, y, x + r * 0.6, y + r * 0.7);
  ctx.lineTo(x - r * 0.6, y + r * 0.7);
  ctx.quadraticCurveTo(x - r * 1.1, y, x, y - r);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(x, y - 4, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1a1305";
  ctx.beginPath();
  ctx.arc(x, y - 4, 2, 0, Math.PI * 2);
  ctx.fill();
}

export function drawTitan(ctx, x, y, r, color) {
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
  ctx.fillStyle = "#1a1305";
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffe066";
  ctx.beginPath();
  ctx.arc(x, y, 3, 0, Math.PI * 2);
  ctx.fill();
}

export function drawSupernova(ctx, x, y, r, color, phase = 0) {
  const rot = phase * 1.2;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
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
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.85, 0, Math.PI * 2);
  ctx.fill();
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

export function drawShipById(ctx, id, x, y, r, color, phase = 0) {
  switch (id) {
    case "scout": return drawScout(ctx, x, y, r, color);
    case "lightning": return drawLightning(ctx, x, y, r, color);
    case "guardian": return drawGuardian(ctx, x, y, r, color, phase);
    case "spreader": return drawSpreader(ctx, x, y, r, color);
    case "plasma": return drawPlasma(ctx, x, y, r, color, phase);
    case "phantom": return drawPhantom(ctx, x, y, r, color, phase);
    case "titan": return drawTitan(ctx, x, y, r, color);
    case "supernova": return drawSupernova(ctx, x, y, r, color, phase);
    default: return drawScout(ctx, x, y, r, color);
  }
}
