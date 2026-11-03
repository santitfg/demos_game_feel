// CH12-1 · Recrear la sensación de una nave con inercia: todos los parámetros empiezan en cero.
// CH12-2 · Tres modelos de movimiento (fijar posición, trasladar, sumar empuje) y la casilla "input crudo".
// Sandbox de la mecánica analizada en el cap. 12, con formas vectoriales propias.

import { createDemo, text } from '../core/demo.js';
import { audio } from '../core/audio.js';

const W = 900;
const H = 440;
const BOOK = { rot: 300, attack: 0.3, thrust: 160, max: 380, damp: 0.22 };
const ZERO = { rot: 0, attack: 0, thrust: 0, max: 0, damp: 0 };

function rocksInit() {
  const rocks = [];
  for (let i = 0; i < 7; i++) {
    const r = 18 + Math.random() * 30;
    const pts = [];
    const n = 9;
    for (let k = 0; k < n; k++) pts.push(r * (0.7 + Math.random() * 0.35));
    rocks.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 50, vy: (Math.random() - 0.5) * 50, rot: 0, vr: (Math.random() - 0.5) * 0.8, pts });
  }
  return rocks;
}

const wrap = (b) => {
  if (b.x < 0) b.x += W;
  if (b.x > W) b.x -= W;
  if (b.y < 0) b.y += H;
  if (b.y > H) b.y -= H;
};

// Un paso de la nave. mode: 'set' | 'translate' | 'add'.
function stepShip(s, p, mode, inp, dt) {
  const turn = inp.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']) + (Math.abs(inp.pad.lx) > 0.3 ? Math.sign(inp.pad.lx) : 0);
  // Rotación: sin simulación, pero con un leve ataque filtrando el input (salvo con "input crudo").
  if (p.raw || p.attack <= 0) s.turnIn = turn;
  else s.turnIn += Math.sign(turn - s.turnIn) * Math.min(Math.abs(turn - s.turnIn), dt / p.attack);
  s.ang += s.turnIn * (p.rot * Math.PI / 180) * dt;
  s.angVel = s.turnIn * p.rot;
  const thrusting = inp.isDown('KeyW', 'ArrowUp') || !!inp.pad.buttons[0];
  s.thrusting = thrusting;
  const hx = Math.cos(s.ang);
  const hy = Math.sin(s.ang);
  if (mode === 'set') {
    // Fijar posición: avanza a velocidad máxima mientras se pulsa, nada más.
    s.vx = thrusting ? hx * p.max : 0;
    s.vy = thrusting ? hy * p.max : 0;
  } else if (mode === 'translate') {
    // La rapidez acumula, pero la dirección es siempre la del morro: un auto de carreras con agarre perfecto.
    let sp = Math.hypot(s.vx, s.vy);
    if (thrusting) sp += p.thrust * dt;
    sp *= Math.exp(-p.damp * dt);
    sp = Math.min(sp, p.max);
    s.vx = hx * sp;
    s.vy = hy * sp;
  } else {
    // Asteroids: el vector de empuje se SUMA a la velocidad de la nave.
    if (thrusting) { s.vx += hx * p.thrust * dt; s.vy += hy * p.thrust * dt; }
    const k = Math.exp(-p.damp * dt);
    s.vx *= k;
    s.vy *= k;
    const sp = Math.hypot(s.vx, s.vy);
    if (sp > p.max && sp > 0) { s.vx *= p.max / sp; s.vy *= p.max / sp; }
  }
  s.x += s.vx * dt;
  s.y += s.vy * dt;
  wrap(s);
  // Disparo: la bala hereda la velocidad de la nave.
  s.cool -= dt;
  if ((inp.isDown('Space', 'KeyJ') || inp.pad.buttons[2]) && s.cool <= 0) {
    s.cool = 0.22;
    s.shots.push({ x: s.x + hx * 14, y: s.y + hy * 14, vx: s.vx + hx * 520, vy: s.vy + hy * 520, life: 1 });
    audio.tone({ freq: 880, dur: 0.05, type: 'square', gain: 0.04, slide: 0.5 });
  }
  for (const b of s.shots) { b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; wrap(b); }
  s.shots = s.shots.filter((b) => b.life > 0);
  for (const r of s.rocks) { r.x += r.vx * dt; r.y += r.vy * dt; r.rot += r.vr * dt; wrap(r); }
  s.trail.push({ x: s.x, y: s.y });
  if (s.trail.length > 240) s.trail.shift();
}

function drawShip(g, s, c, p) {
  g.fillStyle = c.stage;
  g.fillRect(0, 0, W, H);
  g.strokeStyle = c.muted;
  g.lineWidth = 1.5;
  for (const r of s.rocks) {
    g.beginPath();
    r.pts.forEach((d, k) => {
      const a = r.rot + (k / r.pts.length) * Math.PI * 2;
      k ? g.lineTo(r.x + Math.cos(a) * d, r.y + Math.sin(a) * d) : g.moveTo(r.x + Math.cos(a) * d, r.y + Math.sin(a) * d);
    });
    g.closePath();
    g.stroke();
  }
  g.fillStyle = c.accent2;
  for (let i = 1; i < s.trail.length; i += 3) {
    const t = s.trail[i];
    g.globalAlpha = (i / s.trail.length) * 0.5;
    g.fillRect(t.x - 1, t.y - 1, 2, 2);
  }
  g.globalAlpha = 1;
  g.fillStyle = c.text;
  for (const b of s.shots) g.fillRect(b.x - 1.5, b.y - 1.5, 3, 3);
  g.save();
  g.translate(s.x, s.y);
  g.rotate(s.ang);
  g.strokeStyle = c.text;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(16, 0);
  g.lineTo(-11, -10);
  g.lineTo(-6, 0);
  g.lineTo(-11, 10);
  g.closePath();
  g.stroke();
  if (s.thrusting && Math.random() > 0.3) {
    g.strokeStyle = c.accent;
    g.beginPath();
    g.moveTo(-7, -5);
    g.lineTo(-18 - Math.random() * 6, 0);
    g.lineTo(-7, 5);
    g.stroke();
  }
  g.restore();
  // Velocidad (vector) y rumbo.
  const sp = Math.hypot(s.vx, s.vy);
  text(g, `velocidad ${Math.round(sp)} px/s`, 14, H - 32, { size: 12, mono: true, color: c.text });
  text(g, `giro ${Math.round(Math.abs(s.angVel))}°/s${p.raw ? ' (input crudo)' : ''}`, 14, H - 14, { size: 12, mono: true });
}

function baseState() {
  return { x: W / 2, y: H / 2, vx: 0, vy: 0, ang: -Math.PI / 2, angVel: 0, turnIn: 0, cool: 0, shots: [], rocks: rocksInit(), trail: [], thrusting: false };
}

const SHIP_PARAMS = (v) => [
  { key: 'rot', label: 'Velocidad de giro', min: 0, max: 720, step: 5, value: v.rot, unit: '°/s' },
  { key: 'attack', label: 'Ataque del giro', min: 0, max: 1, step: 0.01, value: v.attack, unit: 's' },
  { key: 'thrust', label: 'Empuje', min: 0, max: 1200, step: 5, value: v.thrust, unit: 'px/s²' },
  { key: 'max', label: 'Velocidad máxima', min: 0, max: 1000, step: 5, value: v.max, unit: 'px/s' },
  { key: 'damp', label: 'Amortiguación', min: 0, max: 5, step: 0.01, value: v.damp, unit: '/s' },
  { key: 'raw', type: 'check', label: 'Input crudo (sin ataque en el giro)', value: false },
];

// ---------------- CH12-1 ----------------
export function mountShipZero(mount, { id = 'CH12-1' } = {}) {
  return createDemo({
    mount,
    id,
    title: 'Recrea la nave: todo empieza en cero',
    width: W,
    height: H,
    hint: 'Clic aquí · A/D girar · W empujar · Espacio disparar',
    params: [...SHIP_PARAMS(ZERO), { presets: { 'Todo en cero': ZERO, 'Valores de referencia': BOOK } }],
    metrics: [
      { key: 'sp', label: 'Velocidad' },
      { key: 't90', label: 'Tiempo hasta el máximo' },
      { key: 'coast', label: 'Planeo tras soltar' },
    ],
    foot: `<p><strong>Prueba esto:</strong> así empieza el ejemplo del libro: la nave existe, pero todos los números están en cero y no hace nada.
      Sube primero el giro y después el empuje y la velocidad máxima. Busca una rotación nítida y un avance flotante, que tarde unos tres segundos
      en llegar al máximo y siga planeando varios segundos más al soltar. Si te pierdes, el preset "Valores de referencia" carga unos valores
      cercanos a los del análisis.</p>`,
    setup() { return { ...baseState(), pressT: null, t90: null, relT: null, coast: null }; },
    update(s, dt, api) {
      stepShip(s, api.params, 'add', api.input, dt);
      const sp = Math.hypot(s.vx, s.vy);
      if (s.thrusting && s.pressT == null) { s.pressT = api.time; s.t90 = null; s.relT = null; }
      if (s.thrusting && s.t90 == null && api.params.max > 0 && sp >= api.params.max * 0.9) s.t90 = api.time - s.pressT;
      if (!s.thrusting && s.pressT != null) { s.pressT = null; s.relT = api.time; s.coast = null; s.relSp = sp; }
      if (s.relT != null && s.coast == null && s.relSp > 20 && sp < s.relSp * 0.1) s.coast = api.time - s.relT;
    },
    render(g, s, api) {
      drawShip(g, s, api.colors, api.params);
      const p = api.params;
      if (!p.rot && !p.thrust) text(g, 'Todos los parámetros están en cero: súbelos en el panel', W / 2, 30, { size: 14, weight: 600, align: 'center', color: api.colors.accent });
      api.metric('sp', `${Math.round(Math.hypot(s.vx, s.vy))} px/s`);
      api.metric('t90', s.t90 != null ? `${s.t90.toFixed(2)} s` : '—');
      api.metric('coast', s.coast != null ? `${s.coast.toFixed(1)} s` : s.relT != null ? 'planeando…' : '—');
    },
  });
}

// ---------------- CH12-2 ----------------
export function mountShipModes(mount, { id = 'CH12-2' } = {}) {
  return createDemo({
    mount,
    id,
    title: 'Fijar posición, trasladar o sumar empuje',
    width: W,
    height: H,
    hint: 'Clic aquí · A/D girar · W empujar · Espacio disparar',
    params: SHIP_PARAMS(BOOK),
    modes: [
      { key: '1', label: 'Fijar posición' },
      { key: '2', label: 'Trasladar' },
      { key: '3', label: 'Sumar empuje' },
    ],
    startMode: '3',
    metrics: [
      { key: 'model', label: 'Modelo' },
      { key: 'sp', label: 'Velocidad' },
    ],
    foot: `<p><strong>Prueba esto:</strong> en <kbd>1</kbd> la nave avanza solo mientras empujas: nítida, pero rígida y sin inercia. En <kbd>2</kbd> hay
      inercia, pero la velocidad apunta siempre hacia el morro: traza círculos como un auto de carreras pegado al asfalto. En <kbd>3</kbd> el empuje se
      <em>suma</em> a la velocidad, y la nave puede girar mientras sigue derivando: esa separación entre rumbo y movimiento es la sensación que se busca.
      Marca "input crudo" y gira a toquecitos: sin el tercio de segundo de ataque, el giro se vuelve robótico.</p>`,
    setup() { return baseState(); },
    update(s, dt, api) {
      stepShip(s, api.params, { 1: 'set', 2: 'translate', 3: 'add' }[api.mode], api.input, dt);
    },
    render(g, s, api) {
      drawShip(g, s, api.colors, api.params);
      api.metric('model', { 1: 'posición = rumbo × máx', 2: 'velocidad sigue al morro', 3: 'velocidad += empuje' }[api.mode]);
      api.metric('sp', `${Math.round(Math.hypot(s.vx, s.vy))} px/s`);
    },
  });
}
