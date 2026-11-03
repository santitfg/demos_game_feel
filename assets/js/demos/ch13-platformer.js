// CH13-1 · Un rectángulo de plataformas construido parámetro por parámetro (todo empieza en cero).
// CH13-2 · La misma física con un personaje animado, polvo y bloques que reaccionan.
// Sandbox de la mecánica analizada en el cap. 13: formas propias, nivel propio.

import { createDemo, text, roundRect } from '../core/demo.js';
import { audio } from '../core/audio.js';
import { burst, stepParticles, drawParticles } from './shared/physics2d.js';

const T = 32; // tamaño de bloque
const COLS = 28;
const ROWS = 13;
const PW = 22;
const PH = 30;

export const MARIO_LIKE = {
  accel: 600, decel: 900, walkMax: 150, runAccel: 900, runMax: 260,
  jumpVel: 520, jumpHold: 0.15, cutVel: 330, gravity: 1500, apexMult: 3, termVel: 700, air: 0.6,
};
const ZERO = Object.fromEntries(Object.keys(MARIO_LIKE).map((k) => [k, 0]));

function makeLevel() {
  const g = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
  for (let x = 0; x < COLS; x++) { g[ROWS - 1][x] = 1; g[ROWS - 2][x] = 1; }
  for (const x of [9, 10, 19]) { g[ROWS - 1][x] = 0; g[ROWS - 2][x] = 0; }
  for (let x = 5; x < 9; x++) g[7][x] = 2; // ladrillos
  g[7][6] = 3; // bloque "?"
  for (let x = 13; x < 17; x++) g[6][x] = 1;
  for (let y = 8; y < ROWS - 2; y++) g[y][23] = 1;
  g[9][22] = 1;
  return g;
}

const PARAMS = (v) => [
  { heading: 'Horizontal' },
  { key: 'accel', label: 'Aceleración (caminar)', min: 0, max: 3000, step: 10, value: v.accel, unit: 'px/s²' },
  { key: 'decel', label: 'Desaceleración (soltar)', min: 0, max: 3000, step: 10, value: v.decel, unit: 'px/s²' },
  { key: 'walkMax', label: 'Velocidad máxima (caminar)', min: 0, max: 2000, step: 5, value: v.walkMax, unit: 'px/s' },
  { key: 'runAccel', label: 'Aceleración con correr (J)', min: 0, max: 3000, step: 10, value: v.runAccel, unit: 'px/s²' },
  { key: 'runMax', label: 'Velocidad máxima con correr', min: 0, max: 2000, step: 5, value: v.runMax, unit: 'px/s' },
  { key: 'air', label: 'Control en el aire', min: 0, max: 1.5, step: 0.05, value: v.air, unit: '×' },
  { heading: 'Vertical' },
  { key: 'jumpVel', label: 'Velocidad de salto', min: 0, max: 1200, step: 5, value: v.jumpVel, unit: 'px/s' },
  { key: 'jumpHold', label: 'Duración máxima del empuje', min: 0, max: 10, step: 0.01, value: v.jumpHold, unit: 's' },
  { key: 'cutVel', label: 'Corte al soltar', min: 0, max: 1200, step: 5, value: v.cutVel, unit: 'px/s', help: 'Si sueltas mientras subes más rápido que esto, la subida se recorta: así sale el salto corto.' },
  { key: 'gravity', label: 'Gravedad', min: 0, max: 5000, step: 10, value: v.gravity, unit: 'px/s²' },
  { key: 'apexMult', label: 'Gravedad al caer', min: 1, max: 6, step: 0.1, value: v.apexMult || 1, unit: '×' },
  { key: 'termVel', label: 'Velocidad terminal', min: 0, max: 2000, step: 10, value: v.termVel, unit: 'px/s' },
];

// Física compartida por CH13-1 y CH13-2.
function makeBody() {
  return { x: 3 * T, y: (ROWS - 2) * T - PH, vx: 0, vy: 0, ground: true, jumpT: 0, holding: false, face: 1, skid: 0, events: [] };
}
function solid(level, cx, cy) { return cy >= 0 && cy < ROWS && cx >= 0 && cx < COLS && level[cy][cx] > 0; }
function stepBody(b, p, inp, dt, level) {
  b.events.length = 0;
  const dir = inp.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']) || (Math.abs(inp.pad.lx) > 0.3 ? Math.sign(inp.pad.lx) : 0);
  const run = inp.isDown('KeyJ', 'ShiftLeft', 'ShiftRight') || !!inp.pad.buttons[2];
  const acc = (run ? p.runAccel : p.accel) * (b.ground ? 1 : p.air);
  const max = run ? p.runMax : p.walkMax;
  if (dir) {
    if (b.ground && Math.sign(b.vx) === -dir && Math.abs(b.vx) > 40) b.skid = 0.12;
    b.vx += dir * acc * dt;
    b.face = dir;
  } else if (b.ground) {
    const d = p.decel * dt;
    b.vx = Math.abs(b.vx) <= d ? 0 : b.vx - Math.sign(b.vx) * d;
  }
  if (Math.abs(b.vx) > max) b.vx = Math.sign(b.vx) * Math.max(max, Math.abs(b.vx) - (p.decel || 600) * dt);
  b.skid = Math.max(0, b.skid - dt);

  const jumpDown = inp.isDown('Space', 'KeyW', 'ArrowUp') || !!inp.pad.buttons[0];
  if ((inp.wasPressed('Space', 'KeyW', 'ArrowUp') || inp.padPressed.has(0)) && b.ground && p.jumpVel > 0) {
    b.vy = -p.jumpVel;
    b.ground = false;
    b.jumpT = 0;
    b.holding = true;
    b.events.push('jump');
  }
  if (b.holding) {
    b.jumpT += dt;
    if (!jumpDown) {
      b.holding = false;
      if (b.vy < -p.cutVel) b.vy = -p.cutVel; // el truco del salto corto
    } else if (b.jumpT < p.jumpHold) {
      b.vy = Math.min(b.vy, -p.jumpVel); // empuje sostenido mientras se mantiene
    } else b.holding = false;
  }
  const gmult = b.vy > 0 ? p.apexMult : 1;
  b.vy = Math.min(p.termVel || Infinity, b.vy + p.gravity * gmult * dt);

  // Colisión por ejes contra la grilla.
  b.x += b.vx * dt;
  const top = Math.floor(b.y / T);
  const bot = Math.floor((b.y + PH - 1) / T);
  if (b.vx > 0) {
    const cx = Math.floor((b.x + PW) / T);
    for (let cy = top; cy <= bot; cy++) if (solid(level, cx, cy)) { b.x = cx * T - PW; b.vx = 0; }
  } else if (b.vx < 0) {
    const cx = Math.floor(b.x / T);
    for (let cy = top; cy <= bot; cy++) if (solid(level, cx, cy)) { b.x = (cx + 1) * T; b.vx = 0; }
  }
  b.x = Math.max(0, Math.min(COLS * T - PW, b.x));
  const wasGround = b.ground;
  b.ground = false;
  b.y += b.vy * dt;
  const left = Math.floor(b.x / T);
  const right = Math.floor((b.x + PW - 1) / T);
  if (b.vy >= 0) {
    const cy = Math.floor((b.y + PH) / T);
    for (let cx = left; cx <= right; cx++) {
      if (solid(level, cx, cy)) {
        b.y = cy * T - PH;
        if (!wasGround && b.vy > 150) b.events.push({ land: b.vy });
        b.vy = 0;
        b.ground = true;
      }
    }
  } else {
    const cy = Math.floor(b.y / T);
    for (let cx = left; cx <= right; cx++) {
      if (solid(level, cx, cy)) {
        b.y = (cy + 1) * T;
        b.vy = 0;
        b.holding = false;
        b.events.push({ head: [Math.floor((b.x + PW / 2) / T), cy] });
      }
    }
  }
  if (b.y > ROWS * T + 40) { Object.assign(b, makeBody()); b.events.push('fall'); }
}

function drawLevel(g, level, c, bump) {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const t = level[y][x];
      if (!t) continue;
      const dy = bump && bump.x === x && bump.y === y ? -Math.sin((bump.t / 0.18) * Math.PI) * 8 : 0;
      g.fillStyle = t === 2 ? c.accent3 : t === 3 ? c.warn : c.surface2;
      g.fillRect(x * T + 1, y * T + 1 + dy, T - 2, T - 2);
      if (t === 2) { g.strokeStyle = c.stage; g.lineWidth = 1; g.strokeRect(x * T + 4.5, y * T + 4.5 + dy, T - 9, T / 2 - 5); }
      if (t === 3) text(g, '?', x * T + T / 2, y * T + 22 + dy, { align: 'center', size: 16, weight: 700, color: c.bg });
    }
  }
}

// ---------------- CH13-1 ----------------
export function mountRectangle(mount, { id = 'CH13-1' } = {}) {
  let level = makeLevel();
  let edit = false; // el clic que da el foco no edita el nivel
  const api = createDemo({
    mount,
    id,
    title: 'Un rectángulo que salta: la receta paso a paso',
    width: COLS * T,
    height: ROWS * T,
    hint: 'Clic aquí · A/D · Espacio saltar · J correr · clic en el nivel para poner o quitar bloques',
    panelWidth: 300,
    params: [...PARAMS(ZERO), { presets: { 'Todo en cero': ZERO, 'Valores de referencia': MARIO_LIKE } }],
    metrics: [
      { key: 'vx', label: 'Velocidad horizontal' },
      { key: 'h', label: 'Altura del último salto' },
      { key: 'state', label: 'Estado' },
    ],
    foot: `<p><strong>Prueba esto:</strong> el libro arranca así, con un rectángulo quieto y todo en cero. Agrega por partes:
      aceleración y velocidad máxima; después desaceleración para que frene; después J para correr, con valores más altos. Luego gravedad y velocidad
      de salto. Pon la duración del empuje en 10 s para ver por qué hace falta un límite, y sube "Gravedad al caer" para que la caída sea más
      rápida que la subida. Con el corte al soltar, un toque da un salto corto y mantener da uno largo. Haz clic en el nivel para editar bloques.</p>`,
    setup() { return { b: makeBody(), trace: [], peak: null, h: null, startY: null }; },
    update(s, dt, api) {
      const inp = api.input;
      if (inp.mousePressed && edit) {
        edit = false;
        const cx = Math.floor(inp.mouse.x / T);
        const cy = Math.floor(inp.mouse.y / T);
        if (cy >= 0 && cy < ROWS && cx >= 0 && cx < COLS) level[cy][cx] = level[cy][cx] ? 0 : 1;
      }
      if (inp.wasPressed('KeyR')) level = makeLevel();
      stepBody(s.b, api.params, inp, dt, level);
      for (const e of s.b.events) {
        if (e === 'jump') { s.startY = s.b.y; s.peak = s.b.y; }
        if (e.land && s.peak != null) { s.h = (s.startY - s.peak) / T; s.peak = null; }
      }
      if (s.peak != null) s.peak = Math.min(s.peak, s.b.y);
      s.trace.push({ x: s.b.x + PW / 2, y: s.b.y + PH / 2 });
      if (s.trace.length > 360) s.trace.shift();
    },
    render(g, s, api) {
      const c = api.colors;
      g.fillStyle = c.stage;
      g.fillRect(0, 0, api.w, api.h);
      drawLevel(g, level, c);
      g.fillStyle = c.accent2;
      for (let i = 0; i < s.trace.length; i += 2) g.fillRect(s.trace[i].x - 1, s.trace[i].y - 1, 2, 2);
      g.fillStyle = c.accent;
      g.fillRect(s.b.x, s.b.y, PW, PH);
      const p = api.params;
      if (!p.accel && !p.jumpVel) text(g, 'Todo en cero: sube los parámetros o carga un preset', api.w / 2, 28, { align: 'center', size: 14, weight: 600, color: c.accent });
      api.metric('vx', `${Math.round(Math.abs(s.b.vx))} px/s`);
      api.metric('h', s.h != null ? `${s.h.toFixed(1)} bloques` : '—');
      api.metric('state', s.b.ground ? 'suelo' : s.b.vy < 0 ? 'subiendo' : 'cayendo');
    },
  });
  // En captura, antes de que Input enfoque el escenario: ¿ya tenía el foco?
  api.stage.addEventListener('pointerdown', () => { edit = document.activeElement === api.stage; }, { capture: true });
  return api;
}

// ---------------- CH13-2 ----------------
export function mountCharacter(mount, { id = 'CH13-2' } = {}) {
  let level = makeLevel();
  return createDemo({
    mount,
    id,
    title: 'Del rectángulo al personaje',
    width: COLS * T,
    height: ROWS * T,
    hint: 'Clic aquí · A/D · Espacio saltar · J correr · golpea los ladrillos desde abajo',
    params: [
      { key: 'skin', type: 'check', label: 'Personaje animado (si no, el rectángulo)', value: true },
      { key: 'dust', type: 'check', label: 'Polvo al frenar y aterrizar', value: true },
      { key: 'bump', type: 'check', label: 'Los ladrillos saltan al golpearlos', value: true },
      { key: 'big', type: 'check', label: 'Personaje grande: rompe ladrillos', value: false },
      { key: 'sound', type: 'check', label: 'Sonido', value: true },
    ],
    metrics: [
      { key: 'anim', label: 'Pose' },
      { key: 'speed', label: 'Velocidad de la animación' },
      { key: 'bricks', label: 'Ladrillos golpeados' },
    ],
    foot: `<p><strong>Prueba esto:</strong> corre, frena en seco y golpea los ladrillos desde abajo. La física es la del ejemplo anterior con valores de
      referencia; solo cambia la representación. La velocidad de la animación de correr sigue a la velocidad real. Ahora desmarca "los ladrillos saltan" y
      el personaje grande: sin esas respuestas el mundo deja de sentirse físico y maleable. Marca "personaje grande" y el mismo cabezazo rompe el ladrillo:
      parece que pesa más.</p>`,
    setup() { return { b: makeBody(), parts: [], bump: null, legT: 0, bricks: 0 }; },
    update(s, dt, api) {
      const p = api.params;
      if (api.input.wasPressed('KeyR')) level = makeLevel();
      stepBody(s.b, MARIO_LIKE, api.input, dt, level);
      const b = s.b;
      for (const e of b.events) {
        if (e === 'jump' && p.sound) audio.tone({ freq: 330, dur: 0.12, type: 'square', gain: 0.05, slide: 2 });
        if (e.land && p.dust) burst(s.parts, b.x + PW / 2, b.y + PH, { n: 8, speed: 90, life: 0.35, color: 'muted', size: 4, dir: -Math.PI / 2, spread: Math.PI });
        if (e.head) {
          const [cx, cy] = e.head;
          const t = level[cy]?.[cx];
          if (t === 2 || t === 3) {
            s.bricks++;
            if (p.big && t === 2) {
              level[cy][cx] = 0;
              burst(s.parts, cx * T + T / 2, cy * T + T / 2, { n: 12, speed: 260, life: 0.8, color: 'accent3', size: 7, gravity: 1400, dir: -Math.PI / 2, spread: Math.PI * 1.2 });
              if (p.sound) audio.noise({ dur: 0.18, gain: 0.3, freq: 1400 });
            } else {
              if (p.bump) s.bump = { x: cx, y: cy, t: 0 };
              if (p.sound) audio.tone({ freq: 160, dur: 0.06, type: 'square', gain: 0.07 });
            }
          }
        }
      }
      if (b.skid > 0 && p.dust && b.ground && Math.random() < 0.5) burst(s.parts, b.x + PW / 2 - b.face * 8, b.y + PH, { n: 1, speed: 50, life: 0.3, color: 'muted', size: 4, dir: -Math.PI / 2, spread: 1.5 });
      if (s.bump) { s.bump.t += dt; if (s.bump.t > 0.18) s.bump = null; }
      s.legT += Math.abs(b.vx) * dt * 0.06;
      stepParticles(s.parts, dt);
    },
    render(g, s, api) {
      const c = api.colors;
      const p = api.params;
      const b = s.b;
      g.fillStyle = c.stage;
      g.fillRect(0, 0, api.w, api.h);
      drawLevel(g, level, c, p.bump ? s.bump : null);
      const pose = !b.ground ? 'salto' : b.skid > 0 ? 'derrape' : Math.abs(b.vx) > 5 ? 'carrera' : 'quieto';
      const scale = p.big ? 1.35 : 1;
      if (!p.skin) {
        g.fillStyle = c.accent;
        g.fillRect(b.x, b.y, PW, PH);
      } else {
        g.save();
        g.translate(b.x + PW / 2, b.y + PH);
        g.scale(b.face * scale, scale);
        const sw = pose === 'carrera' ? Math.sin(s.legT * 6) : 0;
        g.strokeStyle = c.accent3;
        g.lineWidth = 5;
        g.lineCap = 'round';
        g.beginPath();
        if (pose === 'salto') { g.moveTo(-3, -12); g.lineTo(-8, -4); g.moveTo(3, -12); g.lineTo(9, -8); } else if (pose === 'derrape') { g.moveTo(-2, -12); g.lineTo(-10, -1); g.moveTo(3, -12); g.lineTo(-2, -1); } else { g.moveTo(-2, -12); g.lineTo(-2 + sw * 7, -1); g.moveTo(2, -12); g.lineTo(2 - sw * 7, -1); }
        g.stroke();
        roundRect(g, -10, -30, 20, 20, 5);
        g.fillStyle = c.accent;
        g.fill();
        g.beginPath();
        g.arc(2, -34, 8, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = c.bg;
        g.fillRect(5, -36, 3, 3);
        if (pose === 'salto') { g.strokeStyle = c.accent; g.lineWidth = 4; g.beginPath(); g.moveTo(6, -26); g.lineTo(10, -40); g.stroke(); }
        g.restore();
      }
      drawParticles(g, s.parts, c);
      api.metric('anim', pose);
      api.metric('speed', pose === 'carrera' ? `${(Math.abs(b.vx) * 0.06 * 6 / (Math.PI * 2)).toFixed(1)} pasos/s` : '—');
      api.metric('bricks', String(s.bricks));
    },
  });
}
