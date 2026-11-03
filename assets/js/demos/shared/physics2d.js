// Física 2D mínima para las demos: círculos contra rectángulos (paredes) y círculos entre sí.
// Cuerpos: { x, y, vx, vy, r, m }. Rectángulos: { x, y, w, h }.

// Saca el círculo del rectángulo y anula/rebota la velocidad normal. Devuelve la rapidez del impacto (0 si no hubo).
export function circleRect(b, rc, bounce = 0) {
  const cx = Math.max(rc.x, Math.min(rc.x + rc.w, b.x));
  const cy = Math.max(rc.y, Math.min(rc.y + rc.h, b.y));
  let dx = b.x - cx;
  let dy = b.y - cy;
  let d = Math.hypot(dx, dy);
  if (d >= b.r) return 0;
  if (d < 1e-6) {
    // Centro dentro del rectángulo: salir por el lado más cercano.
    const opts = [[b.x - rc.x, -1, 0], [rc.x + rc.w - b.x, 1, 0], [b.y - rc.y, 0, -1], [rc.y + rc.h - b.y, 0, 1]].sort((p, q) => p[0] - q[0]);
    dx = opts[0][1];
    dy = opts[0][2];
    b.x += dx * (opts[0][0] + b.r);
    b.y += dy * (opts[0][0] + b.r);
    d = 1;
  } else {
    dx /= d;
    dy /= d;
    b.x = cx + dx * b.r;
    b.y = cy + dy * b.r;
  }
  const vn = b.vx * dx + b.vy * dy;
  if (vn >= 0) return 0;
  b.vx -= (1 + bounce) * vn * dx;
  b.vy -= (1 + bounce) * vn * dy;
  return -vn;
}

// Choque elástico parcial entre dos círculos. Devuelve la rapidez relativa del impacto (0 si no hubo).
export function circleCircle(a, b, bounce = 0.5) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  const min = a.r + b.r;
  if (d >= min || d < 1e-6) return 0;
  const nx = dx / d;
  const ny = dy / d;
  const ia = a.fixed ? 0 : 1 / (a.m || 1);
  const ib = b.fixed ? 0 : 1 / (b.m || 1);
  const sum = ia + ib || 1;
  const pen = min - d;
  a.x -= nx * pen * (ia / sum);
  a.y -= ny * pen * (ia / sum);
  b.x += nx * pen * (ib / sum);
  b.y += ny * pen * (ib / sum);
  const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (rv >= 0) return 0;
  const j = (-(1 + bounce) * rv) / sum;
  a.vx -= j * ia * nx;
  a.vy -= j * ia * ny;
  b.vx += j * ib * nx;
  b.vy += j * ib * ny;
  return -rv;
}

// ¿Se superponen? (para "pulido sin simulación": los objetos se atraviesan pero se detecta el contacto).
export const overlapsCircle = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r;
export function overlapsRect(b, rc) {
  const cx = Math.max(rc.x, Math.min(rc.x + rc.w, b.x));
  const cy = Math.max(rc.y, Math.min(rc.y + rc.h, b.y));
  return Math.hypot(b.x - cx, b.y - cy) < b.r;
}

// Partículas simples con gravedad opcional.
export function burst(list, x, y, { n = 10, speed = 220, life = 0.5, color = 'accent', size = 4, gravity = 0, spread = Math.PI * 2, dir = 0 } = {}) {
  for (let i = 0; i < n; i++) {
    const a = dir + (Math.random() - 0.5) * spread;
    const v = speed * (0.4 + Math.random() * 0.6);
    list.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, color, size, gravity });
  }
}
export function stepParticles(list, dt) {
  for (const p of list) {
    p.vy += p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 1 - 2 * dt;
    p.vy *= 1 - (p.gravity ? 0 : 2 * dt);
    p.life -= dt;
  }
  for (let i = list.length - 1; i >= 0; i--) if (list[i].life <= 0) list.splice(i, 1);
}
export function drawParticles(g, list, c) {
  for (const p of list) {
    g.globalAlpha = Math.max(0, p.life / p.max);
    g.fillStyle = c[p.color] || p.color;
    g.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  g.globalAlpha = 1;
}
