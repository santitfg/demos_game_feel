// Dibujo de curvas en un recuadro (para editores de curva dentro de un canvas de demo).

import { colors } from './theme.js';
import { text } from './demo.js';

// Dibuja ejes, rejilla, una curva fn(0..1) y opcionalmente:
// ghost (curva de referencia), point {x,y} (input actual), handles [{x,y}] (bezier).
export function drawCurvePlot(g, box, { fn, ghost = null, point = null, handles = null, xLabel = 'input', yLabel = 'output', title = '', xMax = 1, yMax = 1, trail = null, samples = 160 } = {}) {
  const c = colors();
  const { x, y, w, h } = box;
  const X = (v) => x + (v / xMax) * w;
  const Y = (v) => y + h - (v / yMax) * h;

  g.fillStyle = c.surface;
  g.fillRect(x, y, w, h);
  g.strokeStyle = c.grid;
  g.lineWidth = 1;
  g.beginPath();
  for (let i = 1; i < 4; i++) {
    g.moveTo(x + (w * i) / 4 + 0.5, y);
    g.lineTo(x + (w * i) / 4 + 0.5, y + h);
    g.moveTo(x, y + (h * i) / 4 + 0.5);
    g.lineTo(x + w, y + (h * i) / 4 + 0.5);
  }
  g.stroke();
  g.strokeStyle = c.line;
  g.strokeRect(x + 0.5, y + 0.5, w, h);

  const curve = (f, color, width, dash) => {
    g.strokeStyle = color;
    g.lineWidth = width;
    g.setLineDash(dash || []);
    g.beginPath();
    for (let i = 0; i <= samples; i++) {
      const vx = (i / samples) * xMax;
      const vy = Math.max(0, Math.min(yMax * 1.2, f(vx)));
      i ? g.lineTo(X(vx), Y(vy)) : g.moveTo(X(vx), Y(vy));
    }
    g.stroke();
    g.setLineDash([]);
  };
  if (ghost) curve(ghost, c.muted, 1.5, [4, 4]);

  if (handles) {
    g.strokeStyle = c.accent3;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(X(0), Y(0));
    g.lineTo(X(handles[0].x), Y(handles[0].y));
    g.moveTo(X(xMax), Y(yMax));
    g.lineTo(X(handles[1].x), Y(handles[1].y));
    g.stroke();
  }
  curve(fn, c.accent, 2.5);

  if (trail && trail.length) {
    g.fillStyle = c.accent2;
    for (let i = 0; i < trail.length; i++) {
      g.globalAlpha = (i / trail.length) * 0.5;
      g.fillRect(X(trail[i][0]) - 1.5, Y(trail[i][1]) - 1.5, 3, 3);
    }
    g.globalAlpha = 1;
  }

  if (handles) {
    for (const hd of handles) {
      g.fillStyle = c.surface;
      g.strokeStyle = c.accent3;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(X(hd.x), Y(hd.y), 7, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
  }

  if (point) {
    g.strokeStyle = c.accent2;
    g.setLineDash([3, 3]);
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(X(point.x), Y(0));
    g.lineTo(X(point.x), Y(point.y));
    g.lineTo(X(0), Y(point.y));
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = c.accent2;
    g.beginPath();
    g.arc(X(point.x), Y(point.y), 6, 0, Math.PI * 2);
    g.fill();
  }

  // Marcas de eje: 0, mitad y máximo.
  const fmtTick = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
  for (const f of [0, 0.5, 1]) {
    text(g, fmtTick(xMax * f), X(xMax * f), y + h + 13, { align: f === 0 ? 'left' : f === 1 ? 'right' : 'center', size: 10, mono: true });
    if (f > 0) text(g, fmtTick(yMax * f), x - 4, Y(yMax * f) + 4, { align: 'right', size: 10, mono: true });
  }
  text(g, xLabel, x + w / 2, y + h + 27, { align: 'center', size: 11, mono: true });
  g.save();
  g.translate(x - 28, y);
  g.rotate(-Math.PI / 2);
  text(g, yLabel, 0, 0, { align: 'right', size: 11, mono: true });
  g.restore();
  if (title) text(g, title, x, y - 10, { size: 13, weight: 600, color: c.text });

  return { X, Y, toValue: (px, py) => ({ x: ((px - x) / w) * xMax, y: ((y + h - py) / h) * yMax }) };
}

export const inBox = (p, b) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
