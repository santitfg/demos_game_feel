// CH14-1 · Gancho y columpio con cámara de zona muerta. Sandbox de la mecánica analizada en el cap. 14.
// Modo 1: el columpio es una animación predeterminada (como en el original). Modo 2: péndulo simulado que conserva el momento.

import { createDemo, text } from '../core/demo.js';
import { audio } from '../core/audio.js';

const T = 32;
const COLS = 96;
const ROWS = 22;
const VW = 900;
const VH = 440;
const PW = 18;
const PH = 30;
const RUN = 170;
const G = 1600;
const TERM = 650;
const REACH = 270;
const PITS = [[12, 18], [30, 37], [50, 57], [70, 77]];

function makeLevel() {
  const g = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
  for (let x = 0; x < COLS; x++) for (let y = 18; y < ROWS; y++) g[y][x] = 1;
  for (const [a, b] of PITS) for (let x = a; x < b; x++) for (let y = 18; y < ROWS; y++) g[y][x] = 0;
  // Techos/salientes para engancharse sobre cada hueco.
  for (const [a, b] of PITS) for (let x = a - 2; x < b + 2; x++) { g[10][x] = 2; g[11][x] = 2; }
  // Plataformas altas y paredes para darle forma al recorrido.
  for (let x = 22; x < 27; x++) g[14][x] = 1;
  for (let y = 12; y < 18; y++) g[y][44] = 1;
  for (let x = 60; x < 66; x++) g[13][x] = 1;
  for (let x = 84; x < 90; x++) g[8][x] = 2;
  for (let y = 0; y < ROWS; y++) { g[y][0] = 1; g[y][COLS - 1] = 1; }
  return g;
}
const solid = (lv, x, y) => {
  const cx = Math.floor(x / T);
  const cy = Math.floor(y / T);
  return cy >= 0 && cy < ROWS && cx >= 0 && cx < COLS && lv[cy][cx] > 0;
};

export function mountGrapple(mount, { id = 'CH14-1' } = {}) {
  const level = makeLevel();
  return createDemo({
    mount,
    id,
    title: 'Gancho, columpio y cámara con zona muerta',
    width: VW,
    height: VH,
    hint: 'Clic aquí · A/D correr · J o Espacio: lanzar el gancho y soltarse · W + J: gancho hacia arriba',
    params: [
      { key: 'dzX', label: 'Zona muerta horizontal', min: 0, max: 0.9, step: 0.01, value: 0.33, unit: '× ancho' },
      { key: 'dzY', label: 'Zona muerta vertical', min: 0, max: 0.9, step: 0.01, value: 0.4, unit: '× alto' },
      { key: 'showZone', type: 'check', label: 'Mostrar la zona muerta', value: true },
      { key: 'amp', label: 'Amplitud del columpio animado', min: 20, max: 80, step: 1, value: 50, unit: '°' },
      { key: 'period', label: 'Período del columpio animado', min: 0.6, max: 2.5, step: 0.05, value: 1.1, unit: 's' },
      { key: 'push', label: 'Empuje en el péndulo simulado', min: 0, max: 10, step: 0.1, value: 3, unit: 'rad/s²' },
      { presets: { 'Cámara pegada (0)': { dzX: 0, dzY: 0 }, 'Zona del original': { dzX: 0.33, dzY: 0.4 } } },
    ],
    modes: [
      { key: '1', label: 'Columpio animado' },
      { key: '2', label: 'Péndulo simulado' },
    ],
    metrics: [
      { key: 'state', label: 'Estado' },
      { key: 'cam', label: 'Cámara' },
      { key: 'swings', label: 'Enganches' },
      { key: 'falls', label: 'Caídas' },
    ],
    foot: `<p><strong>Prueba esto:</strong> corre hasta el primer hueco, lanza el gancho con <kbd>J</kbd> cuando el techo esté delante y vuelve a pulsar
      <kbd>J</kbd> en lo alto del vaivén para soltarte. En <kbd>1</kbd> el balanceo es una animación fija, como en el original: empujar con A o D casi no
      cambia nada, aunque parece que sí. En <kbd>2</kbd> es un péndulo de verdad que conserva el momento al soltarte. Después pon las zonas muertas en
      cero (hay un preset): la cámara persigue cada vaivén y marea. Con la zona muerta, la pantalla se queda quieta mientras te balanceas.</p>`,

    setup() {
      return { x: 3 * T, y: 18 * T - PH, vx: 0, vy: 0, ground: true, face: 1, state: 'suelo', hook: null, anchor: null, theta: 0, omega: 0, L: 0, t: 0, camX: 0, camY: 10 * T, swings: 0, falls: 0, check: 3 * T, camMoving: false };
    },
    update(s, dt, api) {
      const p = api.params;
      const inp = api.input;
      const dir = inp.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']) || (Math.abs(inp.pad.lx) > 0.3 ? Math.sign(inp.pad.lx) : 0);
      const fire = inp.wasPressed('KeyJ', 'Space', 'KeyK') || inp.padPressed.has(0) || inp.padPressed.has(2);
      if (dir) s.face = dir;

      if (s.state === 'columpio') {
        if (fire) {
          // Soltarse: velocidad tangencial del columpio.
          const v = s.L * s.omega;
          s.vx = Math.cos(s.theta) * v;
          s.vy = -Math.sin(s.theta) * v; // tangente a la cuerda: (cos θ, −sin θ)
          s.state = 'aire';
          s.anchor = null;
          audio.tone({ freq: 500, dur: 0.06, type: 'triangle', gain: 0.1, slide: 1.5 });
        } else {
          if (api.mode === '1') {
            // Animación: el ángulo sale de una tabla (seno), sin física. El input no cambia nada.
            s.t += dt;
            const A = (p.amp * Math.PI) / 180;
            const w = (Math.PI * 2) / p.period;
            s.theta = A * Math.sin(w * s.t + s.phase0);
            s.omega = A * w * Math.cos(w * s.t + s.phase0);
          } else {
            const alpha = -(G / s.L) * Math.sin(s.theta) - 0.15 * s.omega + dir * p.push;
            s.omega += alpha * dt;
            s.theta += s.omega * dt;
          }
          s.L += (s.Lt - s.L) * (1 - Math.exp(-dt / 0.08));
          s.x = s.anchor.x + Math.sin(s.theta) * s.L - PW / 2;
          s.y = s.anchor.y + Math.cos(s.theta) * s.L;
          if (solid(level, s.x + PW / 2, s.y + PH / 2) || solid(level, s.x + PW / 2, s.y)) {
            s.state = 'aire'; s.anchor = null; s.vx = 0; s.vy = 0;
          }
        }
      } else {
        if (s.hook) {
          // El gancho viaja en diagonal (o hacia arriba con W) hasta tocar un bloque o llegar a su largo.
          s.hook.len += 1400 * dt;
          const hx = s.hook.ox + s.hook.dx * s.hook.len;
          const hy = s.hook.oy + s.hook.dy * s.hook.len;
          if (solid(level, hx, hy)) {
            s.anchor = { x: hx, y: hy };
            const px = s.x + PW / 2;
            const py = s.y;
            s.L = Math.max(60, Math.hypot(px - hx, py - hy));
            // La cuerda se recoge hasta que el arco pase por encima del suelo (fila 18).
            s.Lt = Math.max(60, Math.min(s.L, 18 * T - hy - PH - 6));
            s.theta = Math.atan2(px - hx, py - hy);
            s.omega = (s.vx * Math.cos(s.theta) - s.vy * Math.sin(s.theta)) / s.L;
            const A = (p.amp * Math.PI) / 180;
            s.phase0 = Math.asin(Math.max(-1, Math.min(1, s.theta / A)));
            if (s.omega < 0 && api.mode === '1') s.phase0 = Math.PI - s.phase0;
            s.t = 0;
            s.state = 'columpio';
            s.swings++;
            s.hook = null;
            audio.tone({ freq: 1200, dur: 0.05, type: 'square', gain: 0.06 });
          } else if (s.hook.len > REACH) s.hook = null;
        } else if (fire) {
          const up = inp.isDown('KeyW', 'ArrowUp');
          const a = up ? -Math.PI / 2 : -Math.PI / 4 * (s.face > 0 ? 1 : 3);
          s.hook = { ox: s.x + PW / 2, oy: s.y + 6, dx: Math.cos(a), dy: Math.sin(a), len: 0 };
          audio.tone({ freq: 700, dur: 0.05, type: 'square', gain: 0.04, slide: 1.4 });
        }
      }
      if (s.state !== 'columpio') {
        // Correr: todo o nada, sin aceleración (como en el original). En el aire no hay control.
        if (s.ground) s.vx = dir * RUN;
        s.vy = Math.min(TERM, s.vy + G * dt);
        s.x += s.vx * dt;
        if (solid(level, s.x + (s.vx > 0 ? PW : 0), s.y + 2) || solid(level, s.x + (s.vx > 0 ? PW : 0), s.y + PH - 2)) {
          s.x = s.vx > 0 ? Math.floor((s.x + PW) / T) * T - PW - 0.01 : (Math.floor(s.x / T) + 1) * T + 0.01;
          s.vx = 0;
        }
        s.y += s.vy * dt;
        s.ground = false;
        if (s.vy >= 0 && (solid(level, s.x + 1, s.y + PH) || solid(level, s.x + PW - 1, s.y + PH))) {
          s.y = Math.floor((s.y + PH) / T) * T - PH;
          if (s.state === 'aire' && s.vy > 300) audio.thud(0.4, 0.5);
          s.vy = 0;
          s.ground = true;
          s.check = s.x;
        } else if (s.vy < 0 && (solid(level, s.x + 1, s.y) || solid(level, s.x + PW - 1, s.y))) {
          s.y = (Math.floor(s.y / T) + 1) * T;
          s.vy = 0;
        }
        s.state = s.ground ? 'suelo' : 'aire';
        if (s.y > ROWS * T) {
          s.falls++;
          Object.assign(s, { x: s.check, y: 18 * T - PH - 2, vx: 0, vy: 0, hook: null });
          audio.tone({ freq: 160, dur: 0.25, type: 'sawtooth', gain: 0.06, slide: 0.5 });
        }
      }

      // Cámara: solo se mueve si el personaje sale de la zona muerta central.
      const px = s.x + PW / 2 - s.camX;
      const py = s.y + PH / 2 - s.camY;
      const zx = (VW * p.dzX) / 2;
      const zy = (VH * p.dzY) / 2;
      const ox = s.camX;
      const oy = s.camY;
      if (px < VW / 2 - zx) s.camX += px - (VW / 2 - zx);
      if (px > VW / 2 + zx) s.camX += px - (VW / 2 + zx);
      if (py < VH / 2 - zy) s.camY += py - (VH / 2 - zy);
      if (py > VH / 2 + zy) s.camY += py - (VH / 2 + zy);
      s.camX = Math.max(0, Math.min(COLS * T - VW, s.camX));
      s.camY = Math.max(0, Math.min(ROWS * T - VH, s.camY));
      s.camMoving = Math.abs(s.camX - ox) + Math.abs(s.camY - oy) > 0.01;
    },
    render(g, s, api) {
      const c = api.colors;
      const p = api.params;
      g.fillStyle = c.stage;
      g.fillRect(0, 0, VW, VH);
      g.save();
      g.translate(-Math.round(s.camX), -Math.round(s.camY));
      const x0 = Math.max(0, Math.floor(s.camX / T));
      const x1 = Math.min(COLS, Math.ceil((s.camX + VW) / T) + 1);
      const y0 = Math.max(0, Math.floor(s.camY / T));
      const y1 = Math.min(ROWS, Math.ceil((s.camY + VH) / T) + 1);
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const t = level[y][x];
          if (!t) continue;
          g.fillStyle = t === 2 ? c.accent3 : c.surface2;
          g.fillRect(x * T, y * T, T - 1, T - 1);
        }
      }
      // Cable.
      const hand = { x: s.x + PW / 2, y: s.y + 6 };
      if (s.hook) {
        g.strokeStyle = c.text;
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(s.hook.ox, s.hook.oy);
        g.lineTo(s.hook.ox + s.hook.dx * s.hook.len, s.hook.oy + s.hook.dy * s.hook.len);
        g.stroke();
      }
      if (s.anchor) {
        g.strokeStyle = c.text;
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(s.anchor.x, s.anchor.y);
        g.lineTo(hand.x, hand.y);
        g.stroke();
        g.fillStyle = c.warn;
        g.fillRect(s.anchor.x - 4, s.anchor.y - 4, 8, 8);
      }
      g.save();
      g.translate(s.x + PW / 2, s.y + PH);
      if (s.state === 'columpio') g.rotate(-s.theta * 0.5);
      g.fillStyle = c.accent;
      g.fillRect(-PW / 2, -PH, PW, PH);
      g.fillStyle = c.bg;
      g.fillRect(s.face > 0 ? 2 : -6, -PH + 6, 4, 4);
      g.restore();
      g.restore();
      if (p.showZone) {
        const zx = (VW * p.dzX) / 2;
        const zy = (VH * p.dzY) / 2;
        g.strokeStyle = s.camMoving ? c.accent2 : c.muted;
        g.setLineDash([6, 6]);
        g.lineWidth = 1.5;
        g.strokeRect(VW / 2 - zx, VH / 2 - zy, zx * 2, zy * 2);
        g.setLineDash([]);
        text(g, 'zona muerta de la cámara', VW / 2 - zx + 6, VH / 2 - zy + 14, { size: 10 });
      }
      api.metric('state', s.state);
      api.metric('cam', s.camMoving ? 'siguiendo' : 'quieta');
      api.metric('swings', String(s.swings));
      api.metric('falls', String(s.falls));
    },
  });
}
