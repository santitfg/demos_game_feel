// Ideas del cap. 18, como prototipos jugables:
// EX18-1 · Muchos avatares a la vez, con una zona de influencia que se desvanece.
// EX18-2 · Avatar invisible: solo se ven las interacciones (el pulido), nunca el cuerpo.
// EX18-3 · Afinar como juego: los parámetros del salto son el control, cada meta pide otra afinación.

import { createDemo, text, roundRect } from '../core/demo.js';
import { audio } from '../core/audio.js';
import { burst, stepParticles, drawParticles } from './shared/physics2d.js';
import { mulberry } from './shared/rand.js';
import { reducedMotion } from '../core/theme.js';

// ---------- Nivel de bloques compartido (EX18-1) ----------
const T = 30;
function makeLevel(cols, rows, holes) {
  const L = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let x = 0; x < cols; x++) { L[rows - 1][x] = 1; L[0][x] = 1; }
  for (let y = 0; y < rows; y++) { L[y][0] = 1; L[y][cols - 1] = 1; }
  for (const [x0, x1, y] of holes) for (let x = x0; x <= x1; x++) L[y][x] = 1;
  return L;
}
const solidAt = (L, x, y) => {
  const cx = Math.floor(x / T);
  const cy = Math.floor(y / T);
  return cy < 0 || cy >= L.length || cx < 0 || cx >= L[0].length || L[cy][cx] === 1;
};
// Mueve un rectángulo w×h por el nivel, eje por eje. Devuelve si quedó apoyado.
function moveBody(b, L, dt) {
  const hw = b.w / 2;
  const hh = b.h / 2;
  b.x += b.vx * dt;
  for (const sy of [-hh + 1, 0, hh - 1]) {
    if (b.vx > 0 && solidAt(L, b.x + hw, b.y + sy)) { b.x = Math.floor((b.x + hw) / T) * T - hw - 0.01; b.vx = 0; }
    if (b.vx < 0 && solidAt(L, b.x - hw, b.y + sy)) { b.x = Math.floor((b.x - hw) / T + 1) * T + hw + 0.01; b.vx = 0; }
  }
  b.y += b.vy * dt;
  let ground = false;
  for (const sx of [-hw + 1, hw - 1]) {
    if (b.vy > 0 && solidAt(L, b.x + sx, b.y + hh)) { b.y = Math.floor((b.y + hh) / T) * T - hh - 0.01; b.vy = 0; ground = true; }
    if (b.vy < 0 && solidAt(L, b.x + sx, b.y - hh)) { b.y = Math.floor((b.y - hh) / T + 1) * T + hh + 0.01; b.vy = 0; }
  }
  return ground;
}
function drawLevel(g, L, c, color) {
  g.fillStyle = color || c.line;
  for (let y = 0; y < L.length; y++) for (let x = 0; x < L[0].length; x++) if (L[y][x] === 1) g.fillRect(x * T, y * T, T, T);
}

// ---------------- EX18-1 ----------------
export function mountSwarm(mount, { id = 'EX18-1' } = {}) {
  const COLS = 30;
  const ROWS = 15;
  const level = makeLevel(COLS, ROWS, [[4, 9, 10], [12, 16, 7], [19, 24, 10], [8, 11, 4], [22, 26, 5], [14, 15, 12], [14, 15, 13]]);
  const goal = { x: 25 * T, y: 3 * T, w: 2 * T, h: 2 * T };
  return createDemo({
    mount,
    id,
    title: 'Cien avatares a la vez',
    width: 900,
    height: 450,
    hint: 'Clic aquí · A/D y Espacio mueven a todos · el mouse marca la zona de influencia',
    modes: [
      { key: '1', label: 'Todos por igual', values: { radius: 0 } },
      { key: '2', label: 'Zona de influencia', values: { radius: 160 } },
    ],
    params: [
      { key: 'count', label: 'Cantidad de avatares', min: 1, max: 300, step: 1, value: 100 },
      { key: 'radius', label: 'Radio de influencia', min: 0, max: 400, step: 10, value: 0, unit: 'px', help: 'En 0, todos obedecen al 100 %. Si no, la influencia cae con la distancia al cursor.' },
      { key: 'jitter', label: 'Diferencia entre avatares', min: 0, max: 0.5, step: 0.01, value: 0.15, help: 'Cada avatar acelera y salta un poco distinto: así el grupo se estira como un fluido.' },
    ],
    metrics: [
      { key: 'goal', label: 'En la meta' },
      { key: 'active', label: 'Obedecen (> 50 %)' },
      { key: 'time', label: 'Tiempo' },
    ],
    foot: `<p><strong>Prueba esto:</strong> en <kbd>1</kbd> todos los cuadrados obedecen igual: el grupo se derrama por los bordes y se apila
      como un líquido. Lleva a todos a la zona verde de arriba a la derecha. En <kbd>2</kbd> solo obedecen del todo los que están cerca del
      cursor: separa un grupo, déjalo esperando y vuelve por el resto. Sube la cantidad a 300.</p>`,

    setup(api) {
      const rand = mulberry(18);
      const n = api.params.count;
      const bodies = [];
      for (let i = 0; i < n; i++) bodies.push({ x: 2 * T + rand() * 5 * T, y: 11 * T + rand() * 2 * T, vx: 0, vy: 0, w: 12, h: 14, k: rand() * 2 - 1, ground: false, inGoal: false, infl: 1 });
      return { bodies, t: 0, done: null };
    },
    update(s, dt, api) {
      const p = api.params;
      if (s.bodies.length !== p.count) { api.reset(); return; }
      const inp = api.input;
      const ax = inp.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']) || (inp.pad.connected ? inp.pad.lx : 0);
      const jump = inp.wasPressed('Space', 'KeyW', 'ArrowUp') || inp.padPressed.has(0);
      const held = inp.isDown('Space', 'KeyW', 'ArrowUp') || !!inp.pad.buttons[0];
      const m = inp.mouse;
      let inGoal = 0;
      let active = 0;
      s.t += dt;
      for (const b of s.bodies) {
        b.infl = p.radius > 0 && m.inside ? Math.max(0, 1 - Math.hypot(b.x - m.x, b.y - m.y) / p.radius) : p.radius > 0 ? 0 : 1;
        if (b.infl > 0.5) active++;
        const var1 = 1 + b.k * p.jitter;
        const target = ax * 190 * var1 * b.infl;
        const acc = b.ground ? 1400 : 700;
        b.vx += Math.sign(target - b.vx) * Math.min(Math.abs(target - b.vx), acc * dt);
        if (jump && b.ground && b.infl > 0.05) { b.vy = -560 * (1 + b.k * p.jitter * 0.5) * (0.6 + 0.4 * b.infl); b.ground = false; }
        b.vy += (held && b.vy < 0 ? 1100 : 2000) * dt;
        b.ground = moveBody(b, level, dt);
        b.inGoal = b.x > goal.x && b.x < goal.x + goal.w && b.y > goal.y && b.y < goal.y + goal.h;
        if (b.inGoal) inGoal++;
      }
      // Separación simple: se empujan entre ellos para que el grupo ocupe espacio, como un fluido.
      const bs = s.bodies;
      for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
        const a = bs[i];
        const b = bs[j];
        const dx = b.x - a.x;
        if (dx > 12 || dx < -12) continue;
        const dy = b.y - a.y;
        if (dy > 14 || dy < -14) continue;
        const ox = 12 - Math.abs(dx);
        const oy = 14 - Math.abs(dy);
        if (ox < oy) { const sx = (dx < 0 ? -1 : 1) * ox * 0.5; a.x -= sx; b.x += sx; }
        else { const sy = (dy < 0 ? -1 : 1) * oy * 0.5; a.y -= sy; b.y += sy; if (dy > 0) { a.vy = Math.min(a.vy, 0); a.ground = true; } else { b.vy = Math.min(b.vy, 0); b.ground = true; } }
      }
      if (jump) audio.tone({ freq: 500 + Math.random() * 100, dur: 0.08, type: 'triangle', gain: 0.08, slide: 1.6 });
      if (inGoal === bs.length && s.done == null) { s.done = s.t; audio.blip(990); }
      s.inGoal = inGoal;
      s.active = active;
    },
    render(g, s, api) {
      const c = api.colors;
      const p = api.params;
      g.fillStyle = c.stage;
      g.fillRect(0, 0, api.w, api.h);
      g.fillStyle = c.good;
      g.globalAlpha = 0.25;
      g.fillRect(goal.x, goal.y, goal.w, goal.h);
      g.globalAlpha = 1;
      drawLevel(g, level, c);
      const m = api.input.mouse;
      if (p.radius > 0 && m.inside) {
        const grd = g.createRadialGradient(m.x, m.y, 0, m.x, m.y, p.radius);
        grd.addColorStop(0, 'rgba(120,180,255,0.25)');
        grd.addColorStop(1, 'rgba(120,180,255,0)');
        g.fillStyle = grd;
        g.beginPath();
        g.arc(m.x, m.y, p.radius, 0, Math.PI * 2);
        g.fill();
      }
      for (const b of s.bodies) {
        g.globalAlpha = 0.35 + 0.65 * b.infl;
        g.fillStyle = b.inGoal ? c.good : c.accent;
        g.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
      }
      g.globalAlpha = 1;
      api.metric('goal', `${s.inGoal ?? 0} / ${s.bodies.length}`);
      api.metric('active', String(s.active ?? 0));
      api.metric('time', s.done != null ? `${s.done.toFixed(1)} s ✓` : `${s.t.toFixed(1)} s`);
    },
  });
}

// ---------------- EX18-2 ----------------
export function mountInvisible(mount, { id = 'EX18-2' } = {}) {
  const W = 2400;
  const H = 1400;
  const rand = mulberry(182);
  const walls = [{ x: 0, y: 0, w: W, h: 30 }, { x: 0, y: H - 30, w: W, h: 30 }, { x: 0, y: 0, w: 30, h: H }, { x: W - 30, y: 0, w: 30, h: H }];
  for (let i = 0; i < 26; i++) {
    const w = 80 + rand() * 260;
    const h = 80 + rand() * 260;
    const x = 100 + rand() * (W - 200 - w);
    const y = 100 + rand() * (H - 200 - h);
    if (x < 500 && y < 500) continue;
    walls.push({ x, y, w, h });
  }
  const paint = document.createElement('canvas');
  paint.width = W / 2;
  paint.height = H / 2;
  const pg = paint.getContext('2d');
  return createDemo({
    mount,
    id,
    title: 'Avatar invisible',
    width: 900,
    height: 460,
    hint: 'Clic aquí · W A S D o flechas para moverte',
    modes: [
      { key: '1', label: 'Visible', values: { body: true, cam: true, paint: false, fx: true } },
      { key: '2', label: 'Invisible con pulido', values: { body: false, cam: true, paint: false, fx: true } },
      { key: '3', label: 'Invisible sin nada', values: { body: false, cam: false, paint: false, fx: false } },
      { key: '4', label: 'Pintar al tocar', values: { body: false, cam: true, paint: true, fx: true } },
    ],
    params: [
      { key: 'body', type: 'check', label: 'Dibujar el avatar', value: true },
      { key: 'cam', type: 'check', label: 'La cámara lo sigue', value: true },
      { key: 'fx', type: 'check', label: 'Pulido: huellas, polvo, golpe y temblor', value: true },
      { key: 'paint', type: 'check', label: 'Pintar las paredes al tocarlas', value: false },
    ],
    metrics: [
      { key: 'hits', label: 'Choques' },
      { key: 'speed', label: 'Velocidad' },
      { key: 'painted', label: 'Pintado' },
    ],
    foot: `<p><strong>Prueba esto:</strong> empieza en <kbd>1</kbd> y pasa a <kbd>2</kbd>: el avatar desaparece, pero las huellas, el polvo al
      chocar, el sonido y la cámara que lo sigue alcanzan para sentirlo. En <kbd>3</kbd> no queda nada: sin pulido ni cámara, no hay feel.
      <kbd>4</kbd> es la idea del libro de un mundo blanco que se descubre tocándolo: recorre el mapa y pinta las paredes.</p>`,

    setup() {
      pg.clearRect(0, 0, paint.width, paint.height);
      return { x: 250, y: 250, vx: 0, vy: 0, camX: 250, camY: 250, shake: 0, steps: [], parts: [], hits: 0, stepT: 0, painted: 0, paintCount: 0 };
    },
    update(s, dt, api) {
      const p = api.params;
      const inp = api.input;
      let [ax, ay] = [inp.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']), inp.axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown'])];
      if (inp.pad.connected && Math.hypot(inp.pad.lx, inp.pad.ly) > 0.15) { ax = inp.pad.lx; ay = inp.pad.ly; }
      const n = Math.hypot(ax, ay) || 1;
      s.vx += (ax / n) * 2200 * dt;
      s.vy += (ay / n) * 2200 * dt;
      s.vx *= Math.exp(-5 * dt);
      s.vy *= Math.exp(-5 * dt);
      const R = 16;
      for (const axis of ['x', 'y']) {
        s[axis] += s['v' + axis] * dt;
        for (const w of walls) {
          if (s.x + R <= w.x || s.x - R >= w.x + w.w || s.y + R <= w.y || s.y - R >= w.y + w.h) continue;
          const v = s['v' + axis];
          if (axis === 'x') s.x = v > 0 ? w.x - R : w.x + w.w + R;
          else s.y = v > 0 ? w.y - R : w.y + w.h + R;
          const hit = Math.abs(v);
          s['v' + axis] = -v * 0.15;
          const cx = axis === 'x' ? s.x + Math.sign(v) * R : s.x;
          const cy = axis === 'y' ? s.y + Math.sign(v) * R : s.y;
          if (hit > 60) {
            s.hits++;
            if (p.fx) {
              audio.thud(0.5, Math.min(1, hit / 500));
              s.shake = Math.min(1, hit / 500);
              burst(s.parts, cx, cy, { n: 6 + Math.floor(hit / 60), speed: 60 + hit * 0.4, life: 0.5, color: 'muted', size: 5, dir: Math.atan2(-Math.sign(axis === 'y' ? v : 0), -Math.sign(axis === 'x' ? v : 0)), spread: 2 });
            }
          }
          if (p.paint) {
            // Mancha de pintura en el punto de contacto (en el lienzo del mundo, a media resolución).
            pg.fillStyle = `hsl(${(s.paintCount * 7) % 360} 70% 55%)`;
            pg.beginPath();
            pg.arc(cx / 2, cy / 2, 10 + Math.min(20, hit / 30), 0, Math.PI * 2);
            pg.fill();
            s.paintCount++;
          }
        }
      }
      const sp = Math.hypot(s.vx, s.vy);
      // Huellas: aparecen al ritmo del paso, más seguidas cuanto más rápido.
      s.stepT += sp * dt;
      if (p.fx && s.stepT > 36) {
        s.stepT = 0;
        const a = Math.atan2(s.vy, s.vx);
        const side = (s.steps.length % 2 ? 1 : -1) * 7;
        s.steps.push({ x: s.x - Math.sin(a) * side, y: s.y + Math.cos(a) * side, a, t: api.time });
        if (s.steps.length > 60) s.steps.shift();
        audio.tone({ freq: 220 + Math.random() * 40, dur: 0.03, gain: 0.05, type: 'triangle' });
      }
      stepParticles(s.parts, dt);
      s.shake = Math.max(0, s.shake - dt * 4);
      if (p.cam) {
        s.camX += (s.x - s.camX) * (1 - Math.exp(-6 * dt));
        s.camY += (s.y - s.camY) * (1 - Math.exp(-6 * dt));
      } else { s.camX = Math.max(450, Math.min(W - 450, s.camX)); s.camY = Math.max(230, Math.min(H - 230, s.camY)); }
      s.sp = sp;
    },
    render(g, s, api) {
      const c = api.colors;
      const p = api.params;
      g.fillStyle = p.paint ? '#f4f4f2' : c.stage;
      g.fillRect(0, 0, api.w, api.h);
      g.save();
      const sh = reducedMotion() ? 0 : s.shake * 8;
      g.translate(Math.round(api.w / 2 - s.camX + (Math.random() - 0.5) * sh), Math.round(api.h / 2 - s.camY + (Math.random() - 0.5) * sh));
      // Paredes: en el modo pintura son invisibles (blanco sobre blanco) salvo donde se las tocó.
      if (p.paint) {
        g.drawImage(paint, 0, 0, W, H);
        g.strokeStyle = '#ececea';
        for (const w of walls) g.strokeRect(w.x, w.y, w.w, w.h);
      } else {
        g.fillStyle = c.line;
        for (const w of walls) g.fillRect(w.x, w.y, w.w, w.h);
      }
      if (p.fx) {
        for (const st of s.steps) {
          const age = api.time - st.t;
          if (age > 3) continue;
          g.globalAlpha = Math.max(0, 1 - age / 3) * 0.7;
          g.save();
          g.translate(st.x, st.y);
          g.rotate(st.a);
          g.fillStyle = p.paint ? '#999' : c.muted;
          g.fillRect(-5, -3, 10, 6);
          g.restore();
        }
        g.globalAlpha = 1;
        drawParticles(g, s.parts, c);
      }
      if (p.body) {
        g.fillStyle = c.accent;
        g.beginPath();
        g.arc(s.x, s.y, 16, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
      if (!p.cam) text(g, 'cámara fija: el avatar puede salir de cuadro', 14, api.h - 14, { size: 12, color: c.muted });
      api.metric('hits', String(s.hits));
      api.metric('speed', `${Math.round(s.sp || 0)} px/s`);
      api.metric('painted', p.paint ? `${s.paintCount} manchas` : '—');
    },
  });
}

// ---------------- EX18-3 ----------------
const GOALS = [
  { name: 'Subir al estante alto', hint: 'Hace falta mucha altura de salto.', start: [80, 380], target: { x: 760, y: 120, w: 90, h: 20 }, blocks: [{ x: 0, y: 400, w: 900, h: 40 }, { x: 760, y: 140, w: 90, h: 260 }] },
  { name: 'Cruzar el pozo bajo el techo', hint: 'El techo es bajo: un salto alto se golpea. Hace falta velocidad.', start: [60, 380], target: { x: 700, y: 380, w: 160, h: 20 }, blocks: [{ x: 0, y: 400, w: 260, h: 40 }, { x: 700, y: 400, w: 200, h: 40 }, { x: 0, y: 0, w: 900, h: 300 }] },
  { name: 'Aterrizar en la plataforma chica', hint: 'Mucha velocidad se pasa de largo: hace falta control fino y poco deslizamiento.', start: [80, 380], target: { x: 520, y: 260, w: 34, h: 20 }, blocks: [{ x: 0, y: 400, w: 900, h: 40 }, { x: 520, y: 280, w: 34, h: 120 }, { x: 600, y: 120, w: 300, h: 280 }] },
];
export function mountTune(mount, { id = 'EX18-3' } = {}) {
  return createDemo({
    mount,
    id,
    title: 'Afinar como juego',
    width: 900,
    height: 440,
    hint: 'Clic aquí · A/D moverse · Espacio saltar · el panel es tu control',
    modes: GOALS.map((g, i) => ({ key: String(i + 1), label: `Meta ${i + 1}` })),
    onModeChange(k, s, api) { if (s) api.reset(); },
    params: [
      { key: 'speed', label: 'Velocidad máxima', min: 50, max: 600, step: 10, value: 200, unit: 'px/s' },
      { key: 'accel', label: 'Aceleración', min: 100, max: 5000, step: 50, value: 1200, unit: 'px/s²' },
      { key: 'friction', label: 'Frenado en el suelo', min: 100, max: 5000, step: 50, value: 1500, unit: 'px/s²' },
      { key: 'jump', label: 'Fuerza de salto', min: 200, max: 1100, step: 10, value: 480, unit: 'px/s' },
      { key: 'gravity', label: 'Gravedad', min: 400, max: 4000, step: 50, value: 1800, unit: 'px/s²' },
      { key: 'air', label: 'Control en el aire', min: 0, max: 1, step: 0.05, value: 0.5 },
    ],
    metrics: [
      { key: 'goal', label: 'Meta' },
      { key: 'jumps', label: 'Saltos' },
      { key: 'tweaks', label: 'Cambios de parámetros' },
      { key: 'done', label: 'Metas cumplidas' },
    ],
    foot: `<p><strong>Prueba esto:</strong> la idea del libro es que afinar una mecánica puede ser el juego. Cada meta (<kbd>1</kbd>–<kbd>3</kbd>)
      es imposible con los valores iniciales: cambia los parámetros del panel hasta que puedas cumplirla. La afinación que sirve para una meta
      suele arruinar la siguiente. Caerse o quedar atascado se arregla con <kbd>R</kbd>.</p>`,

    setup(api) {
      const goal = GOALS[+(api.mode || 1) - 1];
      if (!api.done) {
        api.tweaks = 0;
        api.jumps = 0;
        api.done = new Set();
        api.paramsApi.onChange(() => { api.tweaks++; });
      }
      return { x: goal.start[0], y: goal.start[1], vx: 0, vy: 0, ground: true, won: false, parts: [] };
    },
    update(s, dt, api) {
      const p = api.params;
      const goal = GOALS[+api.mode - 1];
      const inp = api.input;
      const ax = inp.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']) || (inp.pad.connected && Math.abs(inp.pad.lx) > 0.2 ? Math.sign(inp.pad.lx) : 0);
      const acc = p.accel * (s.ground ? 1 : p.air);
      if (ax) s.vx += Math.sign(ax * p.speed - s.vx) * Math.min(Math.abs(ax * p.speed - s.vx), acc * dt);
      else if (s.ground) s.vx -= Math.sign(s.vx) * Math.min(Math.abs(s.vx), p.friction * dt);
      if ((inp.wasPressed('Space', 'KeyW', 'ArrowUp') || inp.padPressed.has(0)) && s.ground) { s.vy = -p.jump; s.ground = false; api.jumps++; audio.tone({ freq: 420, dur: 0.1, type: 'triangle', gain: 0.12, slide: 1.7 }); }
      s.vy += p.gravity * dt;
      const hw = 11;
      const hh = 15;
      s.x += s.vx * dt;
      for (const b of goal.blocks) if (s.x + hw > b.x && s.x - hw < b.x + b.w && s.y + hh > b.y && s.y - hh < b.y + b.h) { s.x = s.vx > 0 ? b.x - hw : b.x + b.w + hw; s.vx = 0; }
      s.y += s.vy * dt;
      s.ground = false;
      for (const b of goal.blocks) if (s.x + hw > b.x && s.x - hw < b.x + b.w && s.y + hh > b.y && s.y - hh < b.y + b.h) {
        if (s.vy > 0) { s.y = b.y - hh; s.ground = true; } else { s.y = b.y + b.h + hh; audio.click(); }
        s.vy = 0;
      }
      s.x = Math.max(hw, Math.min(api.w - hw, s.x));
      const t = goal.target;
      if (!s.won && s.ground && s.x > t.x && s.x < t.x + t.w && Math.abs(s.y + hh - (t.y + t.h)) < 4) {
        s.won = true;
        api.done.add(api.mode);
        audio.blip(880);
        setTimeout(() => audio.blip(1320), 120);
        burst(s.parts, s.x, s.y, { n: 24, speed: 260, life: 0.8, color: 'good' });
      }
      if (s.y > api.h + 60) api.reset();
      stepParticles(s.parts, dt);
    },
    render(g, s, api) {
      const c = api.colors;
      const goal = GOALS[+api.mode - 1];
      g.fillStyle = c.stage;
      g.fillRect(0, 0, api.w, api.h);
      g.fillStyle = c.line;
      for (const b of goal.blocks) g.fillRect(b.x, b.y, b.w, b.h);
      const t = goal.target;
      g.fillStyle = c.good;
      g.globalAlpha = s.won ? 0.9 : 0.45;
      g.fillRect(t.x, t.y + t.h - 6, t.w, 6);
      g.globalAlpha = 1;
      roundRect(g, s.x - 11, s.y - 15, 22, 30, 4);
      g.fillStyle = c.accent;
      g.fill();
      drawParticles(g, s.parts, c);
      text(g, goal.name, 14, 24, { size: 15, color: c.text, weight: 700 });
      text(g, goal.hint, 14, 44, { size: 12 });
      if (s.won) text(g, '¡Meta cumplida! Prueba la siguiente con la misma afinación.', api.w / 2, 80, { align: 'center', size: 15, color: c.good, weight: 700 });
      api.metric('goal', goal.name);
      api.metric('jumps', String(api.jumps));
      api.metric('tweaks', String(api.tweaks));
      api.metric('done', `${api.done.size} / ${GOALS.length}`);
    },
  });
}
