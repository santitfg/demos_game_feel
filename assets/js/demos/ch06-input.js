// EX06-1 · Visualizador de señales de input: botón (booleano), gatillo (float 0–1), stick (dos floats con límite)
// y mouse (deltas sin límite). Sin gamepad, el gatillo se simula con una tecla y el stick con un arrastre.

import { createDemo, text, roundRect } from '../core/demo.js';

const PANELS = [
  { k: 'btn', x: 10, title: 'Botón', sub: 'booleano · 2 estados' },
  { k: 'trig', x: 232, title: 'Gatillo', sub: 'float 0…1 · un eje' },
  { k: 'stick', x: 454, title: 'Stick', sub: 'dos floats −1…1' },
  { k: 'mouse', x: 676, title: 'Mouse', sub: 'deltas · casi sin límites' },
];
const PW = 214;
const PH = 250;

export function mountSignals(mount, { id = 'EX06-1' } = {}) {
  return createDemo({
    mount,
    id,
    title: 'Las señales del input',
    width: 900,
    height: 270,
    hint: 'Clic aquí · Espacio, J, arrastrar en el panel del stick, mover el mouse',
    params: [
      { key: 'gate', type: 'select', label: 'Límite del stick (virtual)', options: [['circle', 'Circular'], ['square', 'Cuadrado'], ['octagon', 'Octogonal (N64)']], value: 'circle' },
      { key: 'dead', label: 'Zona muerta', min: 0, max: 0.5, step: 0.01, value: 0.15 },
      { key: 'noise', type: 'check', label: 'Ruido y deriva (stick virtual)', value: true, help: 'Los sticks reales nunca vuelven exactamente a 0.' },
      { key: 'trigMs', label: 'Recorrido del gatillo simulado', min: 0, max: 400, step: 10, value: 140, unit: 'ms' },
    ],
    graph: {
      window: 4,
      series: [
        { label: 'botón', color: 'accent', min: -1.1, max: 1.1, step: true },
        { label: 'gatillo', color: 'accent2' },
        { label: 'stick x', color: 'accent3' },
        { label: 'stick y', color: 'warn', width: 1.5 },
        { label: 'mouse dx (÷40)', color: 'muted', width: 1 },
      ],
    },
    foot: `<p><strong>Prueba esto:</strong> pulsa <kbd>Espacio</kbd> (botón) y mantén <kbd>J</kbd> (gatillo simulado). Arrastra dentro del panel del
      stick y prueba los tres límites, y mueve el mouse rápido y lento. En el osciloscopio se ve la diferencia entre las señales: el botón salta entre
      0 y 1; el gatillo pasa por valores intermedios mientras se aprieta; el stick tiene un borde y ruido cerca del centro; el mouse no tiene centro
      ni borde, solo cambios. Si conectas un gamepad, sus señales reales reemplazan a las simuladas.</p>`,

    setup() {
      return { trig: 0, sx: 0, sy: 0, rawx: 0, rawy: 0, mdx: 0, mdy: 0, mpath: [], btn: false, drift: { x: 0.04, y: -0.03 }, dragging: false };
    },
    update(s, dt, api) {
      const inp = api.input;
      const p = api.params;
      const pad = inp.pad.connected ? inp.pad : null;
      s.btn = inp.isDown('Space') || !!(pad && pad.buttons[0]);
      if (pad) s.trig = pad.rt;
      else {
        const target = inp.isDown('KeyJ') ? 1 : 0;
        const rate = p.trigMs > 0 ? dt / (p.trigMs / 1000) : 1;
        s.trig = target > s.trig ? Math.min(1, s.trig + rate) : Math.max(0, s.trig - rate);
      }
      // Stick: real o virtual (arrastre dentro del panel).
      const P = PANELS[2];
      const cx = P.x + PW / 2;
      const cy = 140;
      const R = 70;
      if (pad) { s.rawx = pad.lx; s.rawy = pad.ly; } else {
        const m = inp.mouse;
        if (m.down && m.x > P.x && m.x < P.x + PW) s.dragging = true;
        if (!m.down) s.dragging = false;
        if (s.dragging) {
          let x = (m.x - cx) / R;
          let y = (m.y - cy) / R;
          [x, y] = gate(x, y, p.gate);
          s.rawx = x; s.rawy = y;
        } else {
          s.rawx = 0; s.rawy = 0;
        }
        if (p.noise) {
          s.rawx += s.drift.x + (Math.random() - 0.5) * 0.03;
          s.rawy += s.drift.y + (Math.random() - 0.5) * 0.03;
        }
      }
      // Zona muerta radial escalada.
      const mag = Math.hypot(s.rawx, s.rawy);
      const k = mag <= p.dead ? 0 : Math.min(1, (mag - p.dead) / (1 - p.dead)) / mag;
      s.sx = s.rawx * k;
      s.sy = s.rawy * k;
      // Mouse: solo deltas.
      s.mdx = inp.mouse.dx;
      s.mdy = inp.mouse.dy;
      s.mpath.push({ dx: s.mdx, dy: s.mdy });
      if (s.mpath.length > 120) s.mpath.shift();
      api.graph.push(api.time, [s.btn ? 1 : 0, s.trig, s.sx, s.sy, Math.max(-1, Math.min(1, s.mdx / 40))]);
    },
    render(g, s, api) {
      const c = api.colors;
      const p = api.params;
      g.fillStyle = c.stage;
      g.fillRect(0, 0, api.w, api.h);
      for (const P of PANELS) {
        roundRect(g, P.x, 10, PW, PH, 8);
        g.fillStyle = c.surface;
        g.fill();
        g.strokeStyle = c.line;
        g.lineWidth = 1;
        g.stroke();
        text(g, P.title, P.x + 12, 32, { size: 13, weight: 700, color: c.text });
        text(g, P.sub, P.x + 12, 48, { size: 10 });
      }
      const real = api.input.pad.connected;
      // Botón.
      let P = PANELS[0];
      roundRect(g, P.x + PW / 2 - 40, 100, 80, 80, 40);
      g.fillStyle = s.btn ? c.accent : c.surface2;
      g.fill();
      text(g, s.btn ? 'true' : 'false', P.x + PW / 2, 210, { size: 16, align: 'center', mono: true, color: c.text });
      text(g, real ? 'gamepad: botón A' : 'Espacio', P.x + PW / 2, 236, { size: 11, align: 'center' });
      // Gatillo.
      P = PANELS[1];
      g.fillStyle = c.surface2;
      g.fillRect(P.x + PW / 2 - 18, 70, 36, 130);
      g.fillStyle = c.accent2;
      g.fillRect(P.x + PW / 2 - 18, 200 - 130 * s.trig, 36, 130 * s.trig);
      text(g, s.trig.toFixed(2), P.x + PW / 2, 222, { size: 16, align: 'center', mono: true, color: c.text });
      text(g, real ? 'gamepad: gatillo derecho' : 'J (simulado)', P.x + PW / 2, 242, { size: 11, align: 'center' });
      // Stick.
      P = PANELS[2];
      const cx = P.x + PW / 2;
      const cy = 140;
      const R = 70;
      g.strokeStyle = c.line;
      g.lineWidth = 1.5;
      drawGate(g, cx, cy, R, real ? 'circle' : p.gate);
      g.fillStyle = c.warn;
      g.globalAlpha = 0.18;
      g.beginPath();
      g.arc(cx, cy, R * p.dead, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
      g.fillStyle = c.muted;
      g.beginPath();
      g.arc(cx + s.rawx * R, cy + s.rawy * R, 4, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = c.accent3;
      g.beginPath();
      g.arc(cx + s.sx * R, cy + s.sy * R, 9, 0, Math.PI * 2);
      g.fill();
      text(g, `x ${s.sx.toFixed(2)}  y ${s.sy.toFixed(2)}`, cx, 232, { size: 12, align: 'center', mono: true, color: c.text });
      text(g, '● crudo   ● filtrado (zona muerta)', cx, 248, { size: 10, align: 'center' });
      // Mouse.
      P = PANELS[3];
      const mx = P.x + PW / 2;
      const my = 140;
      g.strokeStyle = c.grid;
      g.beginPath();
      g.moveTo(mx - 90, my); g.lineTo(mx + 90, my);
      g.moveTo(mx, my - 80); g.lineTo(mx, my + 80);
      g.stroke();
      s.mpath.forEach((q, i) => {
        g.fillStyle = c.muted;
        g.globalAlpha = i / s.mpath.length;
        g.fillRect(mx + Math.max(-90, Math.min(90, q.dx * 3)) - 1.5, my + Math.max(-80, Math.min(80, q.dy * 3)) - 1.5, 3, 3);
      });
      g.globalAlpha = 1;
      text(g, `dx ${s.mdx.toFixed(1)}  dy ${s.mdy.toFixed(1)}`, mx, 232, { size: 12, align: 'center', mono: true, color: c.text });
      text(g, 'por paso de simulación (px)', mx, 248, { size: 10, align: 'center' });
    },
  });
}

// Recorta un punto al límite físico del stick.
function gate(x, y, kind) {
  if (kind === 'square') return [Math.max(-1, Math.min(1, x)), Math.max(-1, Math.min(1, y))];
  if (kind === 'octagon') {
    // Octágono inscrito: el borde está más cerca en las diagonales.
    const a = Math.atan2(y, x);
    const seg = Math.PI / 4;
    const lim = Math.cos(seg / 2) / Math.cos(((a % seg) + seg) % seg - seg / 2);
    const m = Math.hypot(x, y);
    return m > lim ? [(x / m) * lim, (y / m) * lim] : [x, y];
  }
  const m = Math.hypot(x, y);
  return m > 1 ? [x / m, y / m] : [x, y];
}
function drawGate(g, cx, cy, R, kind) {
  g.beginPath();
  if (kind === 'square') g.rect(cx - R, cy - R, 2 * R, 2 * R);
  else if (kind === 'octagon') {
    for (let i = 0; i <= 8; i++) {
      // Vértices en las 8 direcciones (las muescas del N64), como en gate().
      const a = (i * Math.PI) / 4;
      i ? g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R) : g.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    }
  } else g.arc(cx, cy, R, 0, Math.PI * 2);
  g.stroke();
}
