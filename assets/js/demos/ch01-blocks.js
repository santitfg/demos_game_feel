// CH01-2 · Colisiones sí o no: el espacio simulado le da sentido al movimiento.
// CH01-3 · Los tres bloques (control en tiempo real, espacio simulado, pulido) en sus siete combinaciones.

import { createDemo, text, drawGrid } from '../core/demo.js';
import { audio } from '../core/audio.js';
import { reducedMotion } from '../core/theme.js';
import { circleRect, circleCircle, overlapsCircle, overlapsRect, burst, stepParticles, drawParticles } from './shared/physics2d.js';

const W = 900;
const H = 460;
const ACC = 2200;
const MAX = 360;
const DRAG = 5;

// Movimiento del avatar: aceleración hacia la dirección pedida, con freno por arrastre.
function steer(b, ax, ay, dt) {
  const len = Math.hypot(ax, ay);
  if (len > 1) { ax /= len; ay /= len; }
  b.vx += ax * ACC * dt;
  b.vy += ay * ACC * dt;
  const k = Math.exp(-DRAG * dt * (len > 0.1 ? 0.35 : 1));
  b.vx *= k;
  b.vy *= k;
  const sp = Math.hypot(b.vx, b.vy);
  if (sp > MAX) { b.vx *= MAX / sp; b.vy *= MAX / sp; }
}

function readAxes(inp) {
  let ax = inp.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']);
  let ay = inp.axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']);
  if (inp.pad.connected && Math.hypot(inp.pad.lx, inp.pad.ly) > 0.2) { ax = inp.pad.lx; ay = inp.pad.ly; }
  return [ax, ay];
}

const WALLS = [
  { x: 0, y: 0, w: W, h: 14 }, { x: 0, y: H - 14, w: W, h: 14 }, { x: 0, y: 0, w: 14, h: H }, { x: W - 14, y: 0, w: 14, h: H },
  { x: 200, y: 90, w: 30, h: 200 }, { x: 420, y: 230, w: 220, h: 30 }, { x: 680, y: 60, w: 30, h: 170 }, { x: 330, y: 360, w: 30, h: 86 },
];

// ---------------- CH01-2 ----------------
export function mountCollisions(mount, { id = 'CH01-2' } = {}) {
  return createDemo({
    mount,
    id,
    title: 'Colisiones: el espacio responde',
    width: W,
    height: H,
    hint: 'Clic aquí · W A S D, flechas o stick para moverte',
    modes: [
      { key: '1', label: 'Sin colisiones' },
      { key: '2', label: 'Con colisiones' },
    ],
    metrics: [
      { key: 'speed', label: 'Velocidad' },
      { key: 'hits', label: 'Choques' },
    ],
    foot: `<p><strong>Prueba esto:</strong> muévete un rato en <kbd>1</kbd>, atravesando muros y barriles. El control es idéntico en
      <kbd>2</kbd>, pero ahora los muros te detienen y los barriles se dejan empujar. Las paredes dejan de ser dibujos: se pueden
      bordear, usar de tope y apretar en las esquinas. Fíjate en cuánto más "presente" se siente el círculo.</p>`,

    setup() {
      return {
        me: { x: 90, y: 380, vx: 0, vy: 0, r: 16, m: 2 },
        barrels: [[520, 120], [560, 160], [300, 200], [780, 330], [120, 160]].map(([x, y]) => ({ x, y, vx: 0, vy: 0, r: 18, m: 1.2 })),
        hits: 0,
      };
    },
    update(s, dt, api) {
      const [ax, ay] = readAxes(api.input);
      steer(s.me, ax, ay, dt);
      const bodies = [s.me, ...s.barrels];
      for (const b of bodies) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b !== s.me) { b.vx *= Math.exp(-2.5 * dt); b.vy *= Math.exp(-2.5 * dt); }
      }
      if (api.mode === '2') {
        for (const b of s.barrels) if (circleCircle(s.me, b, 0.3) > 80) audio.thud(0.4, 0.3);
        for (let i = 0; i < s.barrels.length; i++) for (let j = i + 1; j < s.barrels.length; j++) circleCircle(s.barrels[i], s.barrels[j], 0.4);
        for (const b of bodies) for (const w of WALLS) {
          const v = circleRect(b, w, b === s.me ? 0 : 0.4);
          if (v > 120 && b === s.me) { s.hits++; audio.thud(0.7, Math.min(1, v / 400)); }
        }
      } else {
        // Sin espacio: el mundo envuelve en los bordes, para no salir de la pantalla.
        s.me.x = (s.me.x + W) % W;
        s.me.y = (s.me.y + H) % H;
      }
    },
    render(g, s, api) {
      const c = api.colors;
      g.fillStyle = c.stage;
      g.fillRect(0, 0, W, H);
      drawGrid(g, W, H, 40);
      g.fillStyle = c.surface2;
      for (const w of WALLS) g.fillRect(w.x, w.y, w.w, w.h);
      g.strokeStyle = c.line;
      for (const w of WALLS) g.strokeRect(w.x + 0.5, w.y + 0.5, w.w, w.h);
      for (const b of s.barrels) {
        g.fillStyle = c.accent3;
        g.beginPath();
        g.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = c.accent;
      g.beginPath();
      g.arc(s.me.x, s.me.y, s.me.r, 0, Math.PI * 2);
      g.fill();
      api.metric('speed', `${Math.round(Math.hypot(s.me.vx, s.me.vy))} px/s`);
      api.metric('hits', String(s.hits));
    },
  });
}

// ---------------- CH01-3 ----------------
const COMBOS = [
  { key: '1', label: 'Todo', ctl: true, sim: true, pol: true, note: 'Control + espacio + pulido: game feel verdadero.' },
  { key: '2', label: 'Sin pulido', ctl: true, sim: true, pol: false, note: 'Game feel "crudo": se siente la física, falta el atractivo.' },
  { key: '3', label: 'Sin espacio', ctl: true, sim: false, pol: true, note: 'Pulido sin simulación: chispas y sonidos que no se corresponden con nada.' },
  { key: '4', label: 'Sin control', ctl: false, sim: true, pol: true, note: 'Espacio y pulido vistos desde afuera, como en Peggle o Starcraft.' },
  { key: '5', label: 'Solo control', ctl: true, sim: false, pol: false, note: 'Control desnudo: entretiene un rato, pero el movimiento no significa nada.' },
  { key: '6', label: 'Solo espacio', ctl: false, sim: true, pol: false, note: 'Simulación desnuda, percibida pasivamente.' },
  { key: '7', label: 'Solo pulido', ctl: false, sim: false, pol: true, note: 'Pulido desnudo: efectos que venden interacciones que nadie controla.' },
];
const ARENA_WALLS = [
  { x: 0, y: 0, w: W, h: 12 }, { x: 0, y: H - 12, w: W, h: 12 }, { x: 0, y: 0, w: 12, h: H }, { x: W - 12, y: 0, w: 12, h: H },
  { x: 300, y: 150, w: 120, h: 24 }, { x: 560, y: 280, w: 24, h: 120 },
];

export function mountBlocks(mount, { id = 'CH01-3' } = {}) {
  return createDemo({
    mount,
    id,
    title: 'Control, espacio y pulido: las siete combinaciones',
    width: W,
    height: H,
    hint: 'Clic aquí · W A S D, flechas o stick · teclas 1–7',
    modes: COMBOS.map((m) => ({ key: m.key, label: m.label })),
    metrics: [
      { key: 'ctl', label: 'Control en tiempo real' },
      { key: 'sim', label: 'Espacio simulado' },
      { key: 'pol', label: 'Pulido' },
    ],
    foot: `<p><strong>Prueba esto:</strong> recorre las teclas <kbd>1</kbd>–<kbd>7</kbd> y empuja las pelotas. Compara <kbd>1</kbd> y
      <kbd>2</kbd>: la física es igual, pero sin chispas, sonido ni deformación los choques pierden peso. <kbd>3</kbd> es la combinación
      más rara: hay efectos de choque sin choque, y se nota que algo no encaja. En <kbd>4</kbd>, <kbd>6</kbd> y <kbd>7</kbd> el círculo
      naranja se mueve solo. Puede ser lindo de mirar, pero no lo sientes como tuyo.</p>`,

    setup() {
      const balls = [];
      for (let i = 0; i < 7; i++) {
        const r = 12 + i * 2.5;
        balls.push({ x: 160 + (i % 4) * 170, y: 110 + Math.floor(i / 4) * 230 + (i % 2) * 40, vx: 0, vy: 0, r, m: r * r / 300, touching: false, squash: 0 });
      }
      return {
        me: { x: 120, y: 230, vx: 0, vy: 0, r: 18, m: 2.5, squash: 0, touching: false },
        balls, parts: [], shake: 0, trail: [],
        goal: { x: 450, y: 230 }, goalIn: 0,
      };
    },

    update(s, dt, api) {
      const m = COMBOS.find((x) => x.key === api.mode) || COMBOS[0];
      let ax;
      let ay;
      if (m.ctl) {
        [ax, ay] = readAxes(api.input);
      } else {
        // Autopiloto: va hacia puntos al azar (el jugador solo mira).
        s.goalIn -= dt;
        if (s.goalIn <= 0 || Math.hypot(s.goal.x - s.me.x, s.goal.y - s.me.y) < 30) {
          s.goal = { x: 60 + Math.random() * (W - 120), y: 60 + Math.random() * (H - 120) };
          s.goalIn = 2 + Math.random() * 2;
        }
        ax = (s.goal.x - s.me.x) / 80;
        ay = (s.goal.y - s.me.y) / 80;
      }
      steer(s.me, ax, ay, dt);
      const bodies = [s.me, ...s.balls];
      for (const b of bodies) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b !== s.me) { b.vx *= Math.exp(-1.2 * dt); b.vy *= Math.exp(-1.2 * dt); }
        b.squash = Math.max(0, b.squash - dt * 5);
      }

      const impact = (x, y, v, mass, color) => {
        if (!m.pol || v < 40) return;
        const k = Math.min(1, v / 500);
        burst(s.parts, x, y, { n: 4 + Math.round(k * 12), speed: 120 + v * 0.5, life: 0.4, color, size: 3 + k * 3 });
        audio.thud(mass, 0.25 + k * 0.75);
        s.shake = Math.max(s.shake, k * 0.8);
      };

      if (m.sim) {
        for (const b of s.balls) {
          const v = circleCircle(s.me, b, 0.6);
          if (v) { b.squash = s.me.squash = Math.min(1, v / 400); impact((s.me.x + b.x) / 2, (s.me.y + b.y) / 2, v, 0.5, 'accent2'); }
        }
        for (let i = 0; i < s.balls.length; i++) {
          for (let j = i + 1; j < s.balls.length; j++) {
            const a = s.balls[i];
            const b = s.balls[j];
            const v = circleCircle(a, b, 0.8);
            if (v) impact((a.x + b.x) / 2, (a.y + b.y) / 2, v * 0.7, 0.35, 'accent3');
          }
        }
        for (const b of bodies) for (const w of ARENA_WALLS) {
          const v = circleRect(b, w, b === s.me ? 0.2 : 0.7);
          if (v) { b.squash = Math.min(1, v / 400); impact(b.x, b.y, v * 0.6, 0.6, 'muted'); }
        }
      } else {
        // Sin simulación: nada choca. Con pulido, igual se disparan efectos al superponerse.
        for (const b of bodies) { b.x = (b.x + W) % W; b.y = (b.y + H) % H; }
        for (const b of s.balls) {
          const o = overlapsCircle(s.me, b);
          if (o && !b.touching) impact((s.me.x + b.x) / 2, (s.me.y + b.y) / 2, Math.hypot(s.me.vx, s.me.vy), 0.5, 'accent2');
          b.touching = o;
        }
        const ow = ARENA_WALLS.slice(4).some((w) => overlapsRect(s.me, w));
        if (ow && !s.me.touching) impact(s.me.x, s.me.y, Math.hypot(s.me.vx, s.me.vy) * 0.6, 0.6, 'muted');
        s.me.touching = ow;
      }
      stepParticles(s.parts, dt);
      s.shake = Math.max(0, s.shake - dt * 3);
      if (m.pol) {
        s.trail.push({ x: s.me.x, y: s.me.y });
        if (s.trail.length > 14) s.trail.shift();
      } else s.trail.length = 0;
    },

    render(g, s, api) {
      const c = api.colors;
      const m = COMBOS.find((x) => x.key === api.mode) || COMBOS[0];
      g.fillStyle = c.stage;
      g.fillRect(0, 0, W, H);
      g.save();
      if (m.pol && s.shake > 0 && !reducedMotion()) g.translate((Math.random() - 0.5) * 10 * s.shake, (Math.random() - 0.5) * 10 * s.shake);
      drawGrid(g, W, H, 40);
      g.fillStyle = c.surface2;
      for (const w of ARENA_WALLS) g.fillRect(w.x, w.y, w.w, w.h);

      const drawBody = (b, color) => {
        const sp = Math.hypot(b.vx, b.vy);
        g.save();
        g.translate(b.x, b.y);
        if (m.pol) {
          // Sombra y estiramiento según velocidad y golpes.
          g.fillStyle = 'rgba(0,0,0,0.18)';
          g.beginPath();
          g.ellipse(3, b.r * 0.7, b.r, b.r * 0.4, 0, 0, Math.PI * 2);
          g.fill();
          g.rotate(Math.atan2(b.vy, b.vx));
          const st = Math.min(0.3, sp / 1500) - b.squash * 0.35;
          g.scale(1 + st, 1 - st * 0.8);
        }
        g.fillStyle = color;
        g.beginPath();
        g.arc(0, 0, b.r, 0, Math.PI * 2);
        g.fill();
        if (m.pol) {
          g.fillStyle = 'rgba(255,255,255,0.35)';
          g.beginPath();
          g.arc(-b.r * 0.3, -b.r * 0.3, b.r * 0.35, 0, Math.PI * 2);
          g.fill();
        }
        g.restore();
      };
      if (m.pol) {
        s.trail.forEach((p, i) => {
          g.globalAlpha = (i / s.trail.length) * 0.3;
          g.fillStyle = c.accent;
          g.beginPath();
          g.arc(p.x, p.y, s.me.r * (i / s.trail.length), 0, Math.PI * 2);
          g.fill();
        });
        g.globalAlpha = 1;
      }
      for (const b of s.balls) drawBody(b, c.accent3);
      drawBody(s.me, c.accent);
      drawParticles(g, s.parts, c);
      g.restore();

      drawVenn(g, c, W - 118, 30, m);
      text(g, m.note, 24, H - 24, { size: 13, color: c.text, weight: 600 });
      if (!m.ctl) text(g, 'autopiloto: el juego mueve al círculo naranja', 24, 36, { size: 12, color: c.warn, weight: 600 });

      const yes = (v) => (v ? 'sí' : 'no');
      api.metric('ctl', yes(m.ctl));
      api.metric('sim', yes(m.sim));
      api.metric('pol', yes(m.pol));
      for (const k of ['ctl', 'sim', 'pol']) api.metricColor(k, m[k] ? 'good' : 'muted');
    },
  });
}

// Diagrama de Venn pequeño (fig. 1.6): se rellenan los bloques presentes.
export function drawVenn(g, c, x, y, m, r = 30) {
  const circles = [
    { k: 'ctl', cx: x, cy: y + 18, label: 'Control', color: c.accent },
    { k: 'sim', cx: x + 36, cy: y + 18, label: 'Espacio', color: c.accent3 },
    { k: 'pol', cx: x + 18, cy: y + 48, label: 'Pulido', color: c.accent2 },
  ];
  for (const ci of circles) {
    g.globalAlpha = m[ci.k] ? 0.4 : 0.06;
    g.fillStyle = ci.color;
    g.beginPath();
    g.arc(ci.cx, ci.cy, r, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
    g.strokeStyle = m[ci.k] ? ci.color : c.line;
    g.lineWidth = 1.5;
    g.stroke();
  }
  text(g, 'Control', x - 34, y - 16, { size: 10, color: m.ctl ? c.text : c.muted });
  text(g, 'Espacio', x + 72, y - 16, { size: 10, align: 'right', color: m.sim ? c.text : c.muted });
  text(g, 'Pulido', x + 18, y + 92, { size: 10, align: 'center', color: m.pol ? c.text : c.muted });
}
