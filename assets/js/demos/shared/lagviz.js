// Dibujos compartidos del laboratorio de lag: escala de bandas, gráfico de resultados
// e indicadores "tu dedo / el juego".

import { LAG_BANDS } from '../../core/lag.js';
import { text, roundRect } from '../../core/demo.js';

export const LAG_MAX = 500;
const THRESHOLDS = [50, 100, 200, 240];

// Franjas de color de las bandas del cap. 2 a lo largo de un eje horizontal de latencia.
function shadeBands(g, c, x, y, w, h, max, alpha) {
  let prev = 0;
  LAG_BANDS.forEach((b, i) => {
    const hi = Math.min(b.max, max);
    if (hi <= prev) return;
    g.fillStyle = c[b.color];
    g.globalAlpha = alpha * (i === 0 ? 1.4 : 1);
    g.fillRect(x + (prev / max) * w, y, ((hi - prev) / max) * w, h);
    prev = hi;
  });
  g.globalAlpha = 1;
}

// Escala horizontal 0…max ms con las bandas y un marcador en `ms` (y otro hueco en `nominal`).
export function drawLagScale(g, box, c, { ms = null, nominal = null, max = LAG_MAX } = {}) {
  const { x, y, w, h } = box;
  shadeBands(g, c, x, y, w, h, max, 0.28);
  g.strokeStyle = c.line;
  g.lineWidth = 1;
  g.strokeRect(x + 0.5, y + 0.5, w, h);
  g.setLineDash([3, 3]);
  g.beginPath();
  for (const t of THRESHOLDS) {
    const tx = Math.round(x + (t / max) * w) + 0.5;
    g.moveTo(tx, y);
    g.lineTo(tx, y + h);
  }
  g.stroke();
  g.setLineDash([]);
  for (let t = 0; t <= max; t += 100) {
    text(g, `${t}`, x + (t / max) * w, y + h + 13, { size: 10, align: t === 0 ? 'left' : t === max ? 'right' : 'center', mono: true });
  }
  text(g, '240', x + (240 / max) * w, y - 4, { size: 10, align: 'center', mono: true, color: c.bad });
  const mark = (v, filled) => {
    const mx = x + (Math.min(max, Math.max(0, v)) / max) * w;
    g.fillStyle = c.text;
    g.strokeStyle = c.text;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(mx, y + h * 0.15);
    g.lineTo(mx - 6, y - 6);
    g.lineTo(mx + 6, y - 6);
    g.closePath();
    filled ? g.fill() : g.stroke();
    if (filled) g.fillRect(mx - 1, y, 2, h);
  };
  if (nominal != null) mark(nominal, false);
  if (ms != null) mark(ms, true);
}

// Gráfico de resultados: puntos (latencia, puntaje) y promedio por tramos de 50 ms.
export function drawResults(g, box, c, { points = [], xMax = LAG_MAX, yMax = 1, yLabel = '', title = '', fmtY = (v) => v.toFixed(0), now = null, better = 'low' } = {}) {
  const { x, y, w, h } = box;
  const X = (v) => x + (Math.min(xMax, v) / xMax) * w;
  const Y = (v) => y + h - (Math.min(yMax, Math.max(0, v)) / yMax) * h;
  g.fillStyle = c.surface;
  g.fillRect(x, y, w, h);
  shadeBands(g, c, x, y, w, h, xMax, 0.12);
  g.strokeStyle = c.grid;
  g.lineWidth = 1;
  g.beginPath();
  for (let i = 1; i < 4; i++) {
    g.moveTo(x, Math.round(y + (h * i) / 4) + 0.5);
    g.lineTo(x + w, Math.round(y + (h * i) / 4) + 0.5);
  }
  g.stroke();
  g.strokeStyle = c.line;
  g.strokeRect(x + 0.5, y + 0.5, w, h);
  if (title) text(g, title, x, y - 22, { size: 12, weight: 600, color: c.text });
  text(g, `${yLabel} (${better === 'low' ? 'menos es mejor' : 'más es mejor'})`, x, y - 7, { size: 10 });
  for (let i = 0; i <= 4; i++) text(g, fmtY((yMax * i) / 4), x - 5, Y((yMax * i) / 4) + 3, { size: 10, align: 'right', mono: true });
  for (let t = 0; t <= xMax; t += 100) text(g, `${t}`, X(t), y + h + 13, { size: 10, align: 'center', mono: true });
  text(g, 'latencia (ms)', x + w, y + h + 27, { size: 10, align: 'right' });

  if (now != null) {
    g.strokeStyle = c.muted;
    g.setLineDash([2, 4]);
    g.beginPath();
    g.moveTo(Math.round(X(now)) + 0.5, y);
    g.lineTo(Math.round(X(now)) + 0.5, y + h);
    g.stroke();
    g.setLineDash([]);
  }

  // Promedios por tramo: la tendencia que importa.
  const buckets = new Map();
  for (const p of points) {
    const k = Math.round(Math.min(xMax, p.x) / 50) * 50;
    const b = buckets.get(k) || { s: 0, n: 0 };
    b.s += p.y;
    b.n++;
    buckets.set(k, b);
  }
  const avg = [...buckets.entries()].sort((a, b) => a[0] - b[0]);
  if (avg.length > 1) {
    g.strokeStyle = c.accent2;
    g.lineWidth = 2;
    g.beginPath();
    avg.forEach(([k, b], i) => (i ? g.lineTo(X(k), Y(b.s / b.n)) : g.moveTo(X(k), Y(b.s / b.n))));
    g.stroke();
  }
  points.forEach((p, i) => {
    g.fillStyle = i === points.length - 1 ? c.accent : c.text;
    g.globalAlpha = i === points.length - 1 ? 1 : 0.55;
    g.beginPath();
    g.arc(X(p.x), Y(p.y), i === points.length - 1 ? 5 : 3.5, 0, Math.PI * 2);
    g.fill();
  });
  g.globalAlpha = 1;
  if (!points.length) text(g, 'Aún no hay rondas', x + w / 2, y + h / 2, { align: 'center', size: 12 });
}

// Dos teclas lado a lado: cuándo pulsaste (sin lag) y cuándo se enteró el juego.
export function drawPressPair(g, c, x, y, { raw = 0, game = 0, label = 'Espacio' } = {}) {
  const box = (bx, v, caption) => {
    roundRect(g, bx, y, 74, 30, 6);
    g.fillStyle = v > 0 ? c.accent : c.surface;
    g.globalAlpha = v > 0 ? 0.35 + 0.65 * v : 1;
    g.fill();
    g.globalAlpha = 1;
    g.strokeStyle = c.line;
    g.lineWidth = 1;
    g.stroke();
    text(g, label, bx + 37, y + 19, { size: 11, align: 'center', mono: true, color: c.text });
    text(g, caption, bx + 37, y + 44, { size: 10, align: 'center' });
  };
  box(x, raw, 'tu dedo');
  box(x + 86, game, 'el juego');
}
