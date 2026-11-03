// Física mínima de cuerpos circulares: arrastre del suelo, rebote en paredes,
// choques elásticos con restitución y agarre con el mouse (rígido, resorte o fuerza limitada).

export function createBody({ x, y, r = 24, m = 1, rest = 0.5, drag = 1.5, ...extra }) {
  return { x, y, vx: 0, vy: 0, r, m, rest, drag, squash: 0, ...extra };
}

// Estimador de velocidad del cursor a partir de muestras recientes (ventana en segundos).
export class VelocityTracker {
  constructor(window = 0.06) { this.window = window; this.samples = []; }
  push(t, x, y) {
    this.samples.push({ t, x, y });
    while (this.samples.length > 2 && this.samples[0].t < t - this.window) this.samples.shift();
  }
  get() {
    const s = this.samples;
    if (s.length < 2) return { vx: 0, vy: 0 };
    const a = s[0];
    const b = s[s.length - 1];
    const dt = b.t - a.t;
    return dt > 0 ? { vx: (b.x - a.x) / dt, vy: (b.y - a.y) / dt } : { vx: 0, vy: 0 };
  }
}

// Agarre: aplica al cuerpo la acción del cursor según el modo.
//  rigid  → el cuerpo ES el cursor (la masa no se nota al arrastrar)
//  spring → resorte crítico-ish hacia el cursor: a = F/m, la masa retrasa
//  force  → como spring pero con fuerza máxima: "tu brazo" tiene un límite
export function grab(b, cx, cy, mode, { k = 400, zeta = 0.8, maxForce = 3000 }, dt, cursorVel) {
  if (mode === 'rigid') {
    b.x = cx;
    b.y = cy;
    b.vx = cursorVel.vx;
    b.vy = cursorVel.vy;
    return;
  }
  const c = zeta * 2 * Math.sqrt(k * b.m);
  let fx = k * (cx - b.x) - c * b.vx;
  let fy = k * (cy - b.y) - c * b.vy;
  if (mode === 'force') {
    const f = Math.hypot(fx, fy);
    if (f > maxForce) { fx *= maxForce / f; fy *= maxForce / f; }
  }
  b.vx += (fx / b.m) * dt;
  b.vy += (fy / b.m) * dt;
}

// Integra y resuelve colisiones. onImpact(a, b|null, speed, nx, ny) por cada choque.
export function stepWorld(bodies, bounds, dt, { friction = 1, held = null, onImpact = null } = {}) {
  for (const b of bodies) {
    if (b !== held) {
      // Rozamiento: los livianos pierden velocidad antes (arrastre / masa^0.5).
      const k = Math.exp(-(b.drag * friction) / Math.sqrt(b.m) * dt);
      b.vx *= k;
      b.vy *= k;
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.squash *= Math.exp(-14 * dt);

    // Paredes.
    const walls = [
      [b.x - b.r < bounds.x, 1, 0, () => { b.x = bounds.x + b.r; }],
      [b.x + b.r > bounds.x + bounds.w, -1, 0, () => { b.x = bounds.x + bounds.w - b.r; }],
      [b.y - b.r < bounds.y, 0, 1, () => { b.y = bounds.y + b.r; }],
      [b.y + b.r > bounds.y + bounds.h, 0, -1, () => { b.y = bounds.y + bounds.h - b.r; }],
    ];
    for (const [hit, nx, ny, fix] of walls) {
      if (!hit) continue;
      fix();
      const vn = b.vx * nx + b.vy * ny;
      if (vn < 0) {
        b.vx -= (1 + b.rest) * vn * nx;
        b.vy -= (1 + b.rest) * vn * ny;
        b.squash = Math.min(0.45, b.squash + (-vn / 2500) / Math.sqrt(b.m) * 2);
        b.squashAngle = Math.atan2(ny, nx);
        onImpact?.(b, null, -vn, nx, ny);
      }
    }
  }

  // Choques entre cuerpos (impulso con masas y restitución).
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i];
      const b = bodies[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const minD = a.r + b.r;
      if (d >= minD || d === 0) continue;
      const nx = dx / d;
      const ny = dy / d;
      // El cuerpo agarrado con modo rígido se comporta como de masa infinita.
      const ima = a === held && held.rigid ? 0 : 1 / a.m;
      const imb = b === held && held.rigid ? 0 : 1 / b.m;
      if (ima + imb === 0) continue;
      const overlap = minD - d;
      a.x -= nx * overlap * (ima / (ima + imb));
      a.y -= ny * overlap * (ima / (ima + imb));
      b.x += nx * overlap * (imb / (ima + imb));
      b.y += ny * overlap * (imb / (ima + imb));
      const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rv >= 0) continue;
      const e = Math.min(a.rest, b.rest);
      const jImp = (-(1 + e) * rv) / (ima + imb);
      a.vx -= jImp * ima * nx;
      a.vy -= jImp * ima * ny;
      b.vx += jImp * imb * nx;
      b.vy += jImp * imb * ny;
      const s = -rv;
      a.squash = Math.min(0.45, a.squash + (s / 2500) * Math.min(2, b.m / a.m));
      b.squash = Math.min(0.45, b.squash + (s / 2500) * Math.min(2, a.m / b.m));
      a.squashAngle = Math.atan2(ny, nx);
      b.squashAngle = a.squashAngle;
      onImpact?.(a, b, s, nx, ny);
    }
  }
}

// Partículas de polvo simples.
export function spawnDust(list, x, y, nx, ny, n, speed) {
  for (let i = 0; i < n; i++) {
    const a = Math.atan2(ny, nx) + (Math.random() - 0.5) * 2.2;
    const s = speed * (0.3 + Math.random() * 0.7);
    list.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.4 + Math.random() * 0.3, t: 0, r: 2 + Math.random() * 3 });
  }
}
export function stepDust(list, dt) {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.t += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.exp(-5 * dt);
    p.vy *= Math.exp(-5 * dt);
    if (p.t >= p.life) list.splice(i, 1);
  }
}
export function drawDust(g, list, color) {
  g.fillStyle = color;
  for (const p of list) {
    g.globalAlpha = (1 - p.t / p.life) * 0.6;
    g.beginPath();
    g.arc(p.x, p.y, p.r * (1 + p.t * 2), 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
}

// Temblor de cámara con decaimiento ("trauma" al cuadrado).
export class Shake {
  constructor() { this.trauma = 0; }
  add(v) { this.trauma = Math.min(1, this.trauma + v); }
  step(dt) { this.trauma = Math.max(0, this.trauma - dt * 1.8); }
  offset(maxPx = 14) {
    const s = this.trauma * this.trauma * maxPx;
    return { x: (Math.random() * 2 - 1) * s, y: (Math.random() * 2 - 1) * s };
  }
}

// Dibuja un círculo con squash & stretch orientado.
export function withSquash(g, b, enabled, fn) {
  g.save();
  g.translate(b.x, b.y);
  if (enabled && b.squash > 0.005) {
    g.rotate(b.squashAngle || 0);
    g.scale(1 - b.squash, 1 + b.squash * 0.8);
    g.rotate(-(b.squashAngle || 0));
  }
  fn();
  g.restore();
}
