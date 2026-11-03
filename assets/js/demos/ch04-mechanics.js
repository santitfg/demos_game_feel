// EX04-1 · El mismo nivel con tres tipos de control: tiempo real, clic para mover y por turnos.
// EX04-2 · La animación manda o el control manda: bloqueos de animación frente a respuesta cancelable.

import { createDemo, text, drawGrid, roundRect } from '../core/demo.js';
import { audio } from '../core/audio.js';
import { circleRect } from './shared/physics2d.js';

// ---------------- EX04-1 ----------------
const CELL = 40;
const COLS = 22;
const ROWS = 11;
const SPEED = 220;
const BLOCKS = [[5, 1], [5, 2], [5, 3], [5, 4], [10, 6], [11, 6], [12, 6], [13, 6], [16, 2], [16, 3], [16, 4], [8, 9], [9, 9], [3, 7]];

export function mountControlTypes(mount, { id = 'EX04-1' } = {}) {
  const walls = BLOCKS.map(([cx, cy]) => ({ x: cx * CELL, y: cy * CELL, w: CELL, h: CELL }));
  const blocked = (cx, cy) => cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS || BLOCKS.some(([x, y]) => x === cx && y === cy);
  return createDemo({
    mount,
    id,
    title: 'Tiempo real, clic para mover y por turnos',
    width: COLS * CELL,
    height: ROWS * CELL,
    hint: 'Clic aquí · W A S D o flechas · en el modo 2, clic para elegir destino',
    modes: [
      { key: '1', label: 'Tiempo real' },
      { key: '2', label: 'Clic para mover' },
      { key: '3', label: 'Por turnos' },
    ],
    onModeChange(k, s, api) { if (s?.coins) api.reset(); },
    metrics: [
      { key: 'coins', label: 'Monedas' },
      { key: 'hits', label: 'Golpes' },
      { key: 'inputs', label: 'Órdenes por segundo' },
      { key: 'kind', label: 'Tipo de control' },
    ],
    foot: `<p><strong>Prueba esto:</strong> junta monedas esquivando a los guardias con cada modo. En <kbd>1</kbd> corriges el rumbo
      todo el tiempo, y esquivar se hace con la mano. En <kbd>2</kbd> eliges un destino y el personaje lo cumple solo: es un impulso de
      control que termina apenas empieza, como en Starcraft. En <kbd>3</kbd> el mundo te espera: puedes pensar cada paso, pero no hay ciclo de
      corrección, porque no hay nada que corregir mientras pasa. Los tres son juegos válidos, pero solo el primero tiene game feel en el
      sentido del libro.</p>`,

    setup() {
      const s = {
        me: { x: 1.5 * CELL, y: 5.5 * CELL, vx: 0, vy: 0, r: 13 },
        dest: null,
        guards: [
          { x: 7.5 * CELL, y: 1.5 * CELL, ax: 'y', min: 1.5, max: 9.5, dir: 1, speed: 120 },
          { x: 14.5 * CELL, y: 8.5 * CELL, ax: 'x', min: 9.5, max: 20.5, dir: 1, speed: 140 },
          { x: 19.5 * CELL, y: 1.5 * CELL, ax: 'y', min: 1.5, max: 9.5, dir: -1, speed: 100 },
        ],
        coins: [],
        got: 0, hits: 0, orders: [], hurt: 0,
      };
      for (let i = 0; i < 6; i++) s.coins.push(randomCoin(blocked));
      return s;
    },
    update(s, dt, api) {
      const inp = api.input;
      const mode = api.mode;
      let moved = false;
      const now = api.time;
      if (mode === '1') {
        const ax = inp.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']);
        const ay = inp.axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']);
        if (inp.pressed.size) s.orders.push(now);
        const l = Math.hypot(ax, ay) || 1;
        s.me.vx = (ax / l) * SPEED;
        s.me.vy = (ay / l) * SPEED;
        moved = true;
      } else if (mode === '2') {
        if (inp.mousePressed) { s.dest = { x: inp.mouse.x, y: inp.mouse.y }; s.orders.push(now); }
        if (s.dest) {
          const dx = s.dest.x - s.me.x;
          const dy = s.dest.y - s.me.y;
          const d = Math.hypot(dx, dy);
          if (d < 4) { s.dest = null; s.me.vx = s.me.vy = 0; } else { s.me.vx = (dx / d) * SPEED; s.me.vy = (dy / d) * SPEED; }
        } else { s.me.vx = s.me.vy = 0; }
        moved = true;
      } else {
        // Por turnos: cada pulsación es un paso de una celda, y el mundo avanza un paso.
        const step = inp.wasPressed('KeyA', 'ArrowLeft') ? [-1, 0] : inp.wasPressed('KeyD', 'ArrowRight') ? [1, 0] : inp.wasPressed('KeyW', 'ArrowUp') ? [0, -1] : inp.wasPressed('KeyS', 'ArrowDown') ? [0, 1] : null;
        if (step) {
          s.orders.push(now);
          const cx = Math.floor(s.me.x / CELL) + step[0];
          const cy = Math.floor(s.me.y / CELL) + step[1];
          if (!blocked(cx, cy)) { s.me.x = (cx + 0.5) * CELL; s.me.y = (cy + 0.5) * CELL; audio.click(); }
          for (const gd of s.guards) moveGuard(gd, 0.33);
          checkHits(s);
        }
      }
      if (moved) {
        s.me.x += s.me.vx * dt;
        s.me.y += s.me.vy * dt;
        for (const w of walls) circleRect(s.me, w);
        s.me.x = Math.max(s.me.r, Math.min(COLS * CELL - s.me.r, s.me.x));
        s.me.y = Math.max(s.me.r, Math.min(ROWS * CELL - s.me.r, s.me.y));
        for (const gd of s.guards) moveGuard(gd, (gd.speed * dt) / CELL);
        checkHits(s);
      }
      s.coins = s.coins.map((cn) => {
        if (Math.hypot(cn.x - s.me.x, cn.y - s.me.y) < 22) { s.got++; audio.blip(1200); return randomCoin(blocked); }
        return cn;
      });
      s.orders = s.orders.filter((t) => t > now - 3);
      s.hurt = Math.max(0, s.hurt - dt * 2);
    },
    render(g, s, api) {
      const c = api.colors;
      g.fillStyle = c.stage;
      g.fillRect(0, 0, api.w, api.h);
      drawGrid(g, api.w, api.h, CELL);
      g.fillStyle = c.surface2;
      for (const w of walls) g.fillRect(w.x + 1, w.y + 1, w.w - 2, w.h - 2);
      for (const cn of s.coins) {
        g.fillStyle = c.warn;
        g.beginPath();
        g.arc(cn.x, cn.y, 7, 0, Math.PI * 2);
        g.fill();
      }
      for (const gd of s.guards) {
        g.fillStyle = c.bad;
        g.fillRect(gd.x - 13, gd.y - 13, 26, 26);
      }
      if (s.dest) {
        g.strokeStyle = c.accent;
        g.setLineDash([4, 4]);
        g.beginPath();
        g.moveTo(s.me.x, s.me.y);
        g.lineTo(s.dest.x, s.dest.y);
        g.stroke();
        g.setLineDash([]);
        g.beginPath();
        g.arc(s.dest.x, s.dest.y, 6, 0, Math.PI * 2);
        g.stroke();
      }
      g.fillStyle = s.hurt > 0 ? c.bad : c.accent;
      g.beginPath();
      g.arc(s.me.x, s.me.y, s.me.r, 0, Math.PI * 2);
      g.fill();
      if (api.mode === '3') text(g, 'el mundo solo avanza cuando das un paso', 12, 24, { size: 12, color: c.text, weight: 600 });

      api.metric('coins', String(s.got));
      api.metric('hits', String(s.hits));
      api.metric('inputs', (s.orders.length / 3).toFixed(1));
      api.metric('kind', { 1: 'continuo', 2: 'impulsos', 3: 'discreto' }[api.mode]);
    },
  });
}

function moveGuard(gd, cells) {
  const key = gd.ax;
  const cur = gd[key] / CELL + cells * gd.dir;
  if (cur > gd.max) { gd.dir = -1; gd[key] = gd.max * CELL; } else if (cur < gd.min) { gd.dir = 1; gd[key] = gd.min * CELL; } else gd[key] = cur * CELL;
}
function checkHits(s) {
  for (const gd of s.guards) {
    if (Math.abs(gd.x - s.me.x) < 13 + s.me.r && Math.abs(gd.y - s.me.y) < 13 + s.me.r && s.hurt <= 0) {
      s.hits++;
      s.hurt = 1;
      s.dest = null;
      s.me.x = 1.5 * CELL;
      s.me.y = 5.5 * CELL;
      audio.tone({ freq: 180, dur: 0.2, type: 'square', gain: 0.07, slide: 0.6 });
    }
  }
}
function randomCoin(blocked) {
  let cx;
  let cy;
  do { cx = Math.floor(Math.random() * COLS); cy = Math.floor(Math.random() * ROWS); } while (blocked(cx, cy) || (cx < 3 && Math.abs(cy - 5) < 2));
  return { x: (cx + 0.5) * CELL, y: (cy + 0.5) * CELL };
}

// ---------------- EX04-2 ----------------
const GY = 300;
const RUN = 260;
const BLADES = [{ x: 300, period: 1.7, phase: 0 }, { x: 500, period: 1.3, phase: 0.4 }, { x: 700, period: 2.1, phase: 0.9 }];
const GOAL = 850;

export function mountAnimLock(mount, { id = 'EX04-2' } = {}) {
  return createDemo({
    mount,
    id,
    title: 'La animación manda o el control manda',
    width: 900,
    height: 380,
    hint: 'Clic aquí · A/D o ←/→ para correr',
    params: [
      { key: 'start', label: 'Animación de arranque', min: 100, max: 1200, step: 10, value: 530, unit: 'ms' },
      { key: 'stop', label: 'Animación de frenada', min: 100, max: 1000, step: 10, value: 400, unit: 'ms' },
      { key: 'hop', label: 'Paso corto', min: 60, max: 400, step: 10, value: 150, unit: 'ms' },
    ],
    modes: [
      { key: '1', label: 'La animación manda' },
      { key: '2', label: 'El control manda' },
      { key: '3', label: 'Pasos cortos' },
    ],
    onModeChange(k, s, api) { if (s?.anim !== undefined) api.reset(); },
    metrics: [
      { key: 'cross', label: 'Cruces logrados' },
      { key: 'hits', label: 'Cortes' },
      { key: 'locked', label: 'Tiempo bloqueado' },
      { key: 'anim', label: 'Animación actual' },
    ],
    foot: `<p><strong>Prueba esto:</strong> cruza las cuchillas hasta la bandera. En <kbd>1</kbd>, como en el Prince of Persia original,
      arrancar y frenar son animaciones que no se pueden interrumpir: el movimiento es fluido y lindo, pero entre que pulsas y que puedes volver
      a decidir pasa casi un segundo. En <kbd>2</kbd> la misma figura obedece al instante. <kbd>3</kbd> es el "paso corto", el único movimiento
      de ese juego que pasa los umbrales del cap. 2: corto, preciso y casi en tiempo real. Por eso es el que se usa entre cuchillas.</p>`,

    setup() {
      return { x: 40, v: 0, face: 1, anim: 'quieto', animT: 0, animDur: 0, locked: 0, total: 0, cross: 0, hits: 0, legT: 0, hurt: 0, from: 0 };
    },
    update(s, dt, api) {
      const p = api.params;
      const inp = api.input;
      const ax = inp.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']);
      s.total += dt;
      const mode = api.mode;
      if (s.animDur > 0) {
        s.animT += dt;
        s.locked += dt;
        const k = Math.min(1, s.animT / s.animDur);
        if (s.anim === 'arranque') s.v = s.face * RUN * k * k;
        if (s.anim === 'frenada') s.v = s.face * RUN * (1 - k) * (1 - k);
        if (s.anim === 'paso') s.x = s.from + s.face * 26 * Math.sin((k * Math.PI) / 2);
        if (k >= 1) {
          s.animDur = 0;
          if (s.anim === 'arranque') s.anim = 'carrera';
          else { s.anim = 'quieto'; if (s.animT) s.v = 0; }
        }
      } else if (mode === '1') {
        if (s.anim === 'quieto' && ax) { s.face = ax; s.anim = 'arranque'; s.animT = 0; s.animDur = p.start / 1000; } else if (s.anim === 'carrera' && ax !== s.face) { s.anim = 'frenada'; s.animT = 0; s.animDur = p.stop / 1000; }
      } else if (mode === '2') {
        if (ax) s.face = ax;
        s.v += (ax * RUN - s.v) * (1 - Math.exp(-dt / 0.03));
        s.anim = Math.abs(s.v) > 10 ? 'carrera' : 'quieto';
      } else if (ax && inp.wasPressed('KeyA', 'ArrowLeft', 'KeyD', 'ArrowRight')) {
        s.face = ax;
        s.anim = 'paso';
        s.animT = 0;
        s.animDur = p.hop / 1000;
        s.from = s.x;
        s.v = 0;
      }
      if (s.anim !== 'paso') s.x += s.v * dt;
      s.x = Math.max(20, Math.min(GOAL + 20, s.x));
      s.legT += Math.abs(s.v) * dt * 0.05 + (s.anim === 'paso' ? dt * 6 : 0);

      // Cuchillas: bajan una parte del ciclo.
      for (const b of BLADES) {
        b.down = bladeDown(b, api.time);
        if (b.down && Math.abs(b.x - s.x) < 18 && s.hurt <= 0) {
          s.hits++;
          s.hurt = 1;
          audio.tone({ freq: 200, dur: 0.18, type: 'sawtooth', gain: 0.07, slide: 0.5 });
          Object.assign(s, { x: 40, v: 0, anim: 'quieto', animDur: 0 });
        }
      }
      if (s.x >= GOAL) {
        s.cross++;
        audio.blip(1100);
        Object.assign(s, { x: 40, v: 0, anim: 'quieto', animDur: 0 });
      }
      s.hurt = Math.max(0, s.hurt - dt * 2);
    },
    render(g, s, api) {
      const c = api.colors;
      g.fillStyle = c.stage;
      g.fillRect(0, 0, api.w, api.h);
      g.fillStyle = c.surface2;
      g.fillRect(0, GY, api.w, api.h - GY);
      g.fillStyle = c.line;
      g.fillRect(0, GY, api.w, 2);
      g.fillStyle = c.good;
      g.fillRect(GOAL, GY - 70, 4, 70);
      g.beginPath();
      g.moveTo(GOAL + 4, GY - 70); g.lineTo(GOAL + 34, GY - 60); g.lineTo(GOAL + 4, GY - 50);
      g.fill();
      for (const b of BLADES) {
        const y = b.down ? GY - 6 : 60;
        g.fillStyle = c.muted;
        g.fillRect(b.x - 1, 20, 2, y - 20);
        g.fillStyle = b.down ? c.bad : c.text;
        g.fillRect(b.x - 10, y - 50, 20, 50);
        // Aviso: la cuchilla tiembla poco antes de bajar.
        const soon = !b.down && bladeDown(b, api.time + 0.25);
        if (soon) { g.strokeStyle = c.warn; g.lineWidth = 2; g.strokeRect(b.x - 13, y - 53, 26, 56); }
      }

      // Figura: cuerpo + piernas que oscilan; inclinación según animación.
      const lean = s.anim === 'arranque' ? 0.25 : s.anim === 'frenada' ? -0.3 : s.anim === 'carrera' ? 0.15 : 0;
      g.save();
      g.translate(s.x, GY);
      g.scale(s.face, 1);
      g.rotate(lean);
      const sw = Math.sin(s.legT * 2) * (s.anim === 'quieto' ? 0 : 0.7);
      g.strokeStyle = s.hurt > 0 ? c.bad : c.accent;
      g.lineWidth = 6;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(0, -28); g.lineTo(Math.sin(sw) * 16, -2);
      g.moveTo(0, -28); g.lineTo(-Math.sin(sw) * 16, -2);
      g.stroke();
      roundRect(g, -10, -62, 20, 36, 6);
      g.fillStyle = s.hurt > 0 ? c.bad : c.accent;
      g.fill();
      g.beginPath();
      g.arc(0, -72, 9, 0, Math.PI * 2);
      g.fill();
      g.restore();
      if (s.animDur > 0) {
        const k = Math.min(1, s.animT / s.animDur);
        g.fillStyle = c.muted;
        g.fillRect(s.x - 25, GY - 104, 50 * (1 - k), 4);
        text(g, `${s.anim} · sin control`, s.x, GY - 112, { size: 11, align: 'center', color: c.warn, weight: 600 });
      }

      api.metric('cross', String(s.cross));
      api.metric('hits', String(s.hits));
      api.metric('locked', s.total > 0 ? `${Math.round((s.locked / s.total) * 100)} %` : '—');
      api.metric('anim', s.anim);
    },
  });
}

const bladeDown = (b, t) => ((t / b.period + b.phase) % 1) < 0.42;
