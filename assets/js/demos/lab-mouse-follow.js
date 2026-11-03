// LAB · Peso del mouse: el mismo objeto sigue al cursor con distintos modelos.
// El cursor no tiene masa (cap. 7, CH07-2 modo 3); todo el "peso" sale de cómo se filtra.

import { createDemo, text } from '../core/demo.js';

const R = 26;

export const FOLLOW_MODELS = [
  ['direct', 'Directo (es el cursor)'],
  ['exp', 'Suavizado exponencial'],
  ['maxSpeed', 'Velocidad máxima'],
  ['force', 'Fuerza limitada (inercia)'],
  ['spring', 'Resorte con masa'],
];

export function mountMouseFollow(mount, { id = 'LAB-M1' } = {}) {
  return createDemo({
    mount,
    id,
    title: 'Cinco maneras de pesar',
    width: 900,
    height: 460,
    hint: 'Mueve el mouse (o arrastra el dedo) sobre el área',
    params: [
      { key: 'model', type: 'select', label: 'Modelo', options: FOLLOW_MODELS, value: 'spring' },
      { heading: 'Resorte / fuerza' },
      { key: 'mass', label: 'Masa', min: 0.1, max: 8, step: 0.05, value: 1, unit: 'kg' },
      { key: 'k', label: 'Rigidez (k)', min: 5, max: 800, step: 5, value: 300 },
      { key: 'zeta', label: 'Amortiguación (ζ)', min: 0.05, max: 2.5, step: 0.01, value: 0.7, help: 'ζ<1 rebota, ζ=1 firme sin rebote, ζ>1 viscoso.' },
      { key: 'force', label: 'Fuerza máxima', min: 200, max: 30000, step: 100, value: 6000, unit: 'N' },
      { heading: 'Otros modelos' },
      { key: 'rate', label: 'Exponencial: tasa', min: 1, max: 40, step: 0.5, value: 10, unit: '/s' },
      { key: 'maxSpeed', label: 'Velocidad máxima', min: 100, max: 6000, step: 50, value: 1400, unit: 'px/s' },
      { heading: 'Pistas visuales' },
      { key: 'band', type: 'check', label: 'Banda elástica al cursor', value: true },
      { key: 'trail', type: 'check', label: 'Estela', value: false },
      { key: 'shadow', type: 'check', label: 'Sombra que se eleva con la velocidad', value: false },
      { key: 'squash', type: 'check', label: 'Squash & stretch', value: false },
    ],
    modes: [
      { key: '1', label: 'Cursor', values: { model: 'direct' } },
      { key: '2', label: 'Liviano', values: { model: 'spring', mass: 0.3, k: 300, zeta: 0.9 } },
      { key: '3', label: 'Pesado', values: { model: 'spring', mass: 3, k: 300, zeta: 0.75 } },
      { key: '4', label: 'Inercia', values: { model: 'force', mass: 2.5, force: 3500, maxSpeed: 1600 } },
      { key: '5', label: 'Gelatina', values: { model: 'spring', mass: 1, k: 220, zeta: 0.12 } },
      { key: '6', label: 'Suavizado', values: { model: 'exp', rate: 8 } },
    ],
    graph: {
      window: 3,
      series: [
        { label: 'cursor x', color: 'muted', min: 0, max: 1, width: 1.5 },
        { label: 'objeto x', color: 'accent' },
      ],
    },
    metrics: [
      { key: 'lag', label: 'Retraso medido' },
      { key: 'theory', label: 'Retraso teórico' },
      { key: 'over', label: 'Sobrepaso al frenar' },
      { key: 'settle', label: 'Asentamiento' },
    ],
    foot: `<p><strong>Prueba esto:</strong> mueve el mouse rápido y frena de golpe. Compara <kbd>1</kbd> (cursor: cero masa, cero retraso)
      con <kbd>3</kbd> (pesado): el retraso y el sobrepaso son lo que tu cerebro lee como masa. Luego, en modo resorte, sube solo la
      <em>masa</em> y fíjate en que el retraso crece con √masa; baja ζ y aparece el rebote.</p>`,

    setup(api) {
      return {
        p: { x: api.w / 2, y: api.h / 2 },
        v: { x: 0, y: 0 },
        target: { x: api.w / 2, y: api.h / 2 },
        prevTarget: { x: api.w / 2, y: api.h / 2 },
        tv: { x: 0, y: 0 },
        trail: [],
        lag: 0,
        stillTime: 0,
        lastDir: { x: 1, y: 0 },
        stop: null,
        over: null,
        settle: null,
      };
    },

    update(s, dt, api) {
      const { input: inp, params: p } = api;
      if (inp.mouse.inside || inp.mouse.down) s.target = { x: inp.mouse.x, y: inp.mouse.y };

      // Velocidad del cursor (suavizada) para medir retraso y detectar frenadas.
      const ivx = (s.target.x - s.prevTarget.x) / dt;
      const ivy = (s.target.y - s.prevTarget.y) / dt;
      s.prevTarget = { ...s.target };
      const a = 1 - Math.exp(-dt / 0.04);
      s.tv.x += (ivx - s.tv.x) * a;
      s.tv.y += (ivy - s.tv.y) * a;
      const tspeed = Math.hypot(s.tv.x, s.tv.y);

      step(s, p, dt);

      const dx = s.p.x - s.target.x;
      const dy = s.p.y - s.target.y;
      const dist = Math.hypot(dx, dy);

      // Retraso: cuánto tiempo "va detrás" el objeto cuando el cursor se mueve de forma sostenida.
      if (tspeed > 250) {
        s.lastDir = { x: s.tv.x / tspeed, y: s.tv.y / tspeed };
        const along = -(dx * s.lastDir.x + dy * s.lastDir.y);
        const lagMs = Math.max(0, (along / tspeed) * 1000);
        s.lag += (lagMs - s.lag) * (1 - Math.exp(-dt / 0.3));
        s.stillTime = 0;
        s.stop = null;
      } else if (tspeed < 15) {
        s.stillTime += dt;
        if (s.stillTime > 0.06 && !s.stop) {
          s.stop = { t: api.time, x: s.target.x, y: s.target.y, dir: { ...s.lastDir }, max: 0, settled: false };
        }
      }
      if (s.stop && !s.stop.settled) {
        const past = (s.p.x - s.stop.x) * s.stop.dir.x + (s.p.y - s.stop.y) * s.stop.dir.y;
        s.stop.max = Math.max(s.stop.max, past);
        if (dist < 2 && Math.hypot(s.v.x, s.v.y) < 25) {
          s.stop.settled = true;
          s.over = s.stop.max;
          s.settle = (api.time - s.stop.t) * 1000;
        }
      }

      s.trail.push({ x: s.p.x, y: s.p.y });
      if (s.trail.length > 26) s.trail.shift();
      api.graph.push(api.time, [s.target.x / api.w, s.p.x / api.w]);
    },

    render(g, s, api) {
      const c = api.colors;
      const p = api.params;
      g.fillStyle = c.stage;
      g.fillRect(0, 0, api.w, api.h);
      g.strokeStyle = c.grid;
      g.beginPath();
      for (let x = 40; x < api.w; x += 40) { g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, api.h); }
      for (let y = 40; y < api.h; y += 40) { g.moveTo(0, y + 0.5); g.lineTo(api.w, y + 0.5); }
      g.stroke();

      const speed = Math.hypot(s.v.x, s.v.y);

      if (p.trail) {
        s.trail.forEach((t, i) => {
          g.globalAlpha = (i / s.trail.length) * 0.3;
          g.fillStyle = c.accent;
          g.beginPath();
          g.arc(t.x, t.y, R * (0.4 + (0.6 * i) / s.trail.length), 0, Math.PI * 2);
          g.fill();
        });
        g.globalAlpha = 1;
      }

      if (p.band && p.model !== 'direct') {
        const d = Math.hypot(s.p.x - s.target.x, s.p.y - s.target.y);
        g.strokeStyle = c.accent2;
        g.lineWidth = Math.max(1, 4 - d / 60);
        g.globalAlpha = 0.7;
        g.beginPath();
        g.moveTo(s.target.x, s.target.y);
        g.lineTo(s.p.x, s.p.y);
        g.stroke();
        g.globalAlpha = 1;
      }

      if (p.shadow) {
        const lift = Math.min(22, 4 + speed * 0.012);
        g.fillStyle = 'rgba(0,0,0,0.25)';
        g.beginPath();
        g.ellipse(s.p.x + lift * 0.6, s.p.y + lift, R * (1 - lift / 90), R * 0.55 * (1 - lift / 90), 0, 0, Math.PI * 2);
        g.fill();
      }

      g.save();
      g.translate(s.p.x, s.p.y);
      if (p.squash && speed > 5) {
        const ang = Math.atan2(s.v.y, s.v.x);
        const st = Math.min(0.5, speed / 3000);
        g.rotate(ang);
        g.scale(1 + st, 1 / (1 + st));
        g.rotate(-ang);
      }
      g.fillStyle = c.accent;
      g.beginPath();
      g.arc(0, 0, R, 0, Math.PI * 2);
      g.fill();
      g.restore();

      // Cursor (objetivo).
      g.strokeStyle = c.text;
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(s.target.x - 8, s.target.y); g.lineTo(s.target.x + 8, s.target.y);
      g.moveTo(s.target.x, s.target.y - 8); g.lineTo(s.target.x, s.target.y + 8);
      g.stroke();

      api.hud(describe(p));
      api.metric('lag', p.model === 'direct' ? '0 ms' : `${Math.round(s.lag)} ms`);
      const th = theoryLag(p);
      api.metric('theory', th == null ? 'variable' : `${Math.round(th)} ms`);
      api.metric('over', s.over == null ? '—' : `${Math.max(0, s.over).toFixed(0)} px`);
      api.metric('settle', s.settle == null ? '—' : `${Math.round(s.settle)} ms`);
      const lagColor = s.lag <= 50 ? 'good' : s.lag <= 120 ? 'warn' : 'bad';
      api.metricColor('lag', p.model === 'direct' ? 'good' : lagColor);
    },
  });
}

function step(s, p, dt) {
  const t = s.target;
  const px = s.p.x;
  const py = s.p.y;
  if (p.model === 'direct') {
    s.p.x = t.x;
    s.p.y = t.y;
  } else if (p.model === 'exp') {
    const k = 1 - Math.exp(-p.rate * dt);
    s.p.x += (t.x - s.p.x) * k;
    s.p.y += (t.y - s.p.y) * k;
  } else if (p.model === 'maxSpeed') {
    const dx = t.x - s.p.x;
    const dy = t.y - s.p.y;
    const d = Math.hypot(dx, dy);
    const m = p.maxSpeed * dt;
    if (d <= m) { s.p.x = t.x; s.p.y = t.y; } else { s.p.x += (dx / d) * m; s.p.y += (dy / d) * m; }
  } else if (p.model === 'force') {
    // "Llegada": velocidad deseada limitada por lo que se puede frenar con la fuerza disponible.
    const amax = p.force / p.mass;
    const dx = t.x - s.p.x;
    const dy = t.y - s.p.y;
    const d = Math.hypot(dx, dy);
    const want = Math.min(p.maxSpeed, Math.sqrt(2 * amax * d) * 0.85);
    const dvx = (d > 0 ? (dx / d) * want : 0) - s.v.x;
    const dvy = (d > 0 ? (dy / d) * want : 0) - s.v.y;
    const dv = Math.hypot(dvx, dvy);
    const maxDv = amax * dt;
    const k = dv > maxDv ? maxDv / dv : 1;
    s.v.x += dvx * k;
    s.v.y += dvy * k;
    s.p.x += s.v.x * dt;
    s.p.y += s.v.y * dt;
    return;
  } else if (p.model === 'spring') {
    const c = p.zeta * 2 * Math.sqrt(p.k * p.mass);
    const ax = (p.k * (t.x - s.p.x) - c * s.v.x) / p.mass;
    const ay = (p.k * (t.y - s.p.y) - c * s.v.y) / p.mass;
    s.v.x += ax * dt;
    s.v.y += ay * dt;
    s.p.x += s.v.x * dt;
    s.p.y += s.v.y * dt;
    return;
  }
  s.v.x = (s.p.x - px) / dt;
  s.v.y = (s.p.y - py) / dt;
}

// Retraso en régimen estacionario siguiendo un cursor a velocidad constante.
// Exponencial: 1/tasa. Resorte: c/k = 2ζ/ω, con ω = √(k/m).
function theoryLag(p) {
  if (p.model === 'direct') return 0;
  if (p.model === 'exp') return 1000 / p.rate;
  if (p.model === 'spring') return (1000 * p.zeta * 2 * Math.sqrt(p.k * p.mass)) / p.k;
  return null;
}

function describe(p) {
  if (p.model === 'spring') {
    const w = Math.sqrt(p.k / p.mass);
    const period = (2 * Math.PI) / w;
    const kind = p.zeta < 0.95 ? 'subamortiguado: rebota' : p.zeta <= 1.05 ? 'crítico: llega sin rebotar' : 'sobreamortiguado: se arrastra';
    return `ω = √(k/m) = ${w.toFixed(1)} rad/s · período ≈ ${Math.round(period * 1000)} ms\nζ = ${p.zeta.toFixed(2)} → ${kind}`;
  }
  if (p.model === 'force') return `aceleración máx = F/m = ${Math.round(p.force / p.mass)} px/s²`;
  if (p.model === 'exp') return `cada segundo recorre el ${Math.round((1 - Math.exp(-p.rate)) * 100)} % de la distancia restante`;
  if (p.model === 'maxSpeed') return `velocidad tope ${p.maxSpeed} px/s, sin aceleración: arranca y frena en seco`;
  return 'mapeo directo: posición del mouse = posición del objeto';
}
