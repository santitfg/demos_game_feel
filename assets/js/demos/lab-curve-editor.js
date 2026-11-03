// LAB · Editor de curva de respuesta: input (stick) → curva → giro de un vehículo.
// Inspirado en la fig. 7.19 (giro progresivo según cuánto se inclina el stick).

import { createDemo, text } from '../core/demo.js';
import { CURVES, bezier, deadzone1D, power, clamp } from '../core/curves.js';
import { drawCurvePlot, inBox } from '../core/plot.js';

const BOX = { x: 60, y: 46, w: 300, h: 300 };
const SCENE = { x: 400, y: 0, w: 500, h: 440 };
const ROAD_W = 64;

// Trazado sinuoso: curvas suaves alternadas con curvas cerradas.
const roadX = (y) => 70 * Math.sin(y / 260) + 45 * Math.sin(y / 97 + 1.3) + 18 * Math.sin(y / 41);

export function mountCurveEditor(mount, { id = 'LAB-C1' } = {}) {
  const curveOptions = [
    ...Object.entries(CURVES).map(([k, v]) => [k, v.label]),
    ['power', 'Potencia (exponente ajustable)'],
    ['bezier', 'Bezier (arrastra las manijas)'],
  ];

  return createDemo({
    mount,
    id,
    title: 'Editor de curva: del stick al volante',
    width: 900,
    height: 440,
    hint: 'Clic y arrastra a los lados (stick virtual) · A/D · gamepad',
    params: [
      { heading: 'Curva' },
      { key: 'curve', type: 'select', label: 'Forma', options: curveOptions, value: 'linear' },
      { key: 'exp', label: 'Exponente', min: 0.25, max: 5, step: 0.05, value: 2.2, help: 'Solo para "Potencia". <1: sensible al centro. >1: suave al centro, brusco al borde.' },
      { key: 'inner', label: 'Zona muerta interior', min: 0, max: 0.5, step: 0.01, value: 0 },
      { key: 'outer', label: 'Saturación (borde)', min: 0.5, max: 1, step: 0.01, value: 1, help: 'A partir de aquí el output ya es 1.' },
      { heading: 'Vehículo' },
      { key: 'speed', label: 'Velocidad', min: 40, max: 400, step: 5, value: 170, unit: 'px/s' },
      { key: 'turn', label: 'Giro máximo', min: 30, max: 400, step: 5, value: 200, unit: '°/s' },
      { key: 'ghost', type: 'check', label: 'Fantasma con curva lineal', value: true },
      { heading: 'Teclado (A/D)' },
      { key: 'ramp', label: 'Rampa de input', min: 0, max: 1, step: 0.01, value: 0.25, unit: 's', help: 'El teclado es on/off. Una rampa convierte la tecla en un "stick" que se inclina con el tiempo; con 0 la curva no tiene nada que curvar.' },
    ],
    modes: [
      { key: '1', label: 'Lineal', values: { curve: 'linear', inner: 0, outer: 1 } },
      { key: '2', label: 'Progresiva (GTA)', values: { curve: 'power', exp: 2.2, inner: 0.1, outer: 0.95 } },
      { key: '3', label: 'Sensible al centro', values: { curve: 'sqrt', inner: 0, outer: 1 } },
      { key: '4', label: 'Digital', values: { curve: 'digital', inner: 0, outer: 1 } },
      { key: '5', label: 'Bezier', values: { curve: 'bezier', inner: 0.05, outer: 1 } },
    ],
    graph: {
      window: 4,
      series: [
        { label: 'input', color: 'accent2', min: -1, max: 1 },
        { label: 'output (curva)', color: 'accent' },
      ],
    },
    metrics: [
      { key: 'in', label: 'Input' },
      { key: 'out', label: 'Output' },
      { key: 'err', label: 'Error lateral (RMS 5 s)' },
      { key: 'off', label: 'Fuera de pista' },
    ],
    foot: `<p><strong>Prueba esto:</strong> con <kbd>1</kbd> (lineal) intenta seguir las curvas suaves sin zigzaguear, luego pasa a <kbd>2</kbd>.
      La curva progresiva hace que los primeros milímetros del stick casi no giren: correcciones finas en recta y giro fuerte solo al fondo.
      El fantasma recibe <em>el mismo input</em> con curva lineal, así ves la diferencia en la trayectoria.</p>`,

    setup() {
      return {
        handles: [{ x: 0.55, y: 0.05 }, { x: 0.8, y: 0.6 }],
        dragHandle: -1,
        stickAnchor: null,
        raw: 0,
        keyVal: 0,
        car: { x: roadX(0), y: 0, a: 0 },
        ghost: { x: roadX(0), y: 0, a: 0 },
        trail: [],
        errs: [],
        lastOut: 0,
      };
    },

    update(s, dt, api) {
      const { input: inp, params: p } = api;
      const m = inp.mouse;

      // Arrastre: manijas bezier dentro del recuadro, stick virtual fuera.
      if (inp.mousePressed) {
        s.dragHandle = -1;
        if (p.curve === 'bezier' && inBox(m, { x: BOX.x - 10, y: BOX.y - 10, w: BOX.w + 20, h: BOX.h + 20 })) {
          s.handles.forEach((hd, i) => {
            const hx = BOX.x + hd.x * BOX.w;
            const hy = BOX.y + BOX.h - hd.y * BOX.h;
            if (Math.hypot(m.x - hx, m.y - hy) < 16) s.dragHandle = i;
          });
        }
        if (s.dragHandle < 0 && !inBox(m, BOX)) s.stickAnchor = { x: m.x, y: m.y };
      }
      if (!m.down) { s.dragHandle = -1; s.stickAnchor = null; }
      if (s.dragHandle >= 0) {
        const hd = s.handles[s.dragHandle];
        hd.x = clamp((m.x - BOX.x) / BOX.w);
        hd.y = clamp((BOX.y + BOX.h - m.y) / BOX.h, -0.2, 1.2);
      }

      // Fuente de input: stick virtual > gamepad > teclado con rampa.
      const keyTarget = inp.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']);
      if (p.ramp <= 0) s.keyVal = keyTarget;
      else {
        const step = dt / p.ramp;
        s.keyVal += clamp(keyTarget - s.keyVal, -step, step);
        if (keyTarget === 0 && Math.abs(s.keyVal) <= step) s.keyVal = 0;
      }
      let raw = s.keyVal;
      if (inp.pad.connected && Math.abs(inp.pad.lx) > 0.02) raw = inp.pad.lx;
      if (s.stickAnchor) raw = clamp((m.x - s.stickAnchor.x) / 110, -1, 1);
      s.raw = raw;

      const fn = curveFn(p, s.handles);
      const shaped = (v) => {
        const d = deadzone1D(v, p.inner, p.outer);
        return Math.sign(d) * fn(Math.abs(d));
      };
      const out = shaped(raw);
      const outLinear = deadzone1D(raw, p.inner, p.outer);
      s.lastOut = out;

      const turn = (p.turn * Math.PI) / 180;
      for (const [car, o] of [[s.car, out], [s.ghost, outLinear]]) {
        car.a += o * turn * dt;
        car.x += Math.sin(car.a) * p.speed * dt;
        car.y -= Math.cos(car.a) * p.speed * dt;
        // Si se sale mucho de la pista, se reubica suavemente: la demo no castiga, enseña.
        const e = car.x - roadX(car.y);
        if (Math.abs(e) > 260) { car.x = roadX(car.y); car.a *= 0.3; }
      }

      const err = s.car.x - roadX(s.car.y);
      s.errs.push(err);
      if (s.errs.length > 600) s.errs.shift();

      s.trail.push([Math.abs(raw), Math.abs(out)]);
      if (s.trail.length > 50) s.trail.shift();

      api.graph.push(api.time, [raw, out]);
    },

    render(g, s, api) {
      const c = api.colors;
      const p = api.params;
      const fn = curveFn(p, s.handles);
      const full = (x) => {
        const d = deadzone1D(x, p.inner, p.outer);
        return fn(Math.abs(d));
      };

      drawCurvePlot(g, BOX, {
        fn: full,
        ghost: p.ghost ? (x) => deadzone1D(x, p.inner, p.outer) : null,
        point: { x: Math.abs(s.raw), y: Math.abs(s.lastOut) },
        handles: p.curve === 'bezier' ? s.handles : null,
        trail: s.trail,
        xLabel: '|input del stick|',
        yLabel: 'output → giro',
        title: CURVE_TITLE(p),
      });

      // Barra del stick (-1..1).
      const by = 392;
      g.fillStyle = c.surface2;
      g.fillRect(BOX.x, by, BOX.w, 10);
      g.fillStyle = c.line;
      g.fillRect(BOX.x + BOX.w / 2 - 1, by - 4, 2, 18);
      const deadW = (p.inner * BOX.w) / 2;
      g.fillStyle = c.grid;
      g.fillRect(BOX.x + BOX.w / 2 - deadW, by, deadW * 2, 10);
      g.fillStyle = c.accent2;
      g.beginPath();
      g.arc(BOX.x + BOX.w / 2 + (s.raw * BOX.w) / 2, by + 5, 8, 0, Math.PI * 2);
      g.fill();
      text(g, 'stick: −1', BOX.x, by + 32, { size: 11, mono: true });
      text(g, '+1', BOX.x + BOX.w, by + 32, { size: 11, mono: true, align: 'right' });

      drawScene(g, s, api);
      api.metric('in', s.raw.toFixed(2));
      api.metric('out', s.lastOut.toFixed(2));
      const rms = Math.sqrt(s.errs.reduce((a, e) => a + e * e, 0) / Math.max(1, s.errs.length));
      api.metric('err', `${rms.toFixed(1)} px`);
      const off = s.errs.filter((e) => Math.abs(e) > ROAD_W / 2).length / Math.max(1, s.errs.length);
      api.metric('off', `${Math.round(off * 100)} %`);
      api.metricColor('off', off > 0.25 ? 'bad' : off > 0.05 ? 'warn' : 'good');
    },
  });
}

const CURVE_TITLE = (p) => {
  if (p.curve === 'power') return `Potencia x^${p.exp.toFixed(2)}`;
  if (p.curve === 'bezier') return 'Bezier personalizada';
  return CURVES[p.curve]?.label ?? p.curve;
};

function curveFn(p, handles) {
  if (p.curve === 'power') return (x) => power(x, p.exp);
  if (p.curve === 'bezier') return bezier(handles[0].x, handles[0].y, handles[1].x, handles[1].y);
  return CURVES[p.curve]?.fn ?? ((x) => x);
}

function drawScene(g, s, api) {
  const c = api.colors;
  const { x: sx, y: sy, w: sw, h: sh } = SCENE;
  g.save();
  g.beginPath();
  g.rect(sx, sy, sw, sh);
  g.clip();
  g.fillStyle = c.surface2;
  g.fillRect(sx, sy, sw, sh);

  // Cámara: sigue al auto, con el auto en el tercio inferior.
  const camX = s.car.x - sw / 2;
  const camY = s.car.y - sh * 0.68;
  const toS = (wx, wy) => [sx + wx - camX, sy + wy - camY];

  // Pista.
  g.strokeStyle = c.stage;
  g.lineWidth = ROAD_W;
  g.lineCap = 'round';
  g.beginPath();
  for (let wy = camY - 20; wy <= camY + sh + 20; wy += 8) {
    const [px, py] = toS(roadX(wy), wy);
    wy === camY - 20 ? g.moveTo(px, py) : g.lineTo(px, py);
  }
  g.stroke();
  g.strokeStyle = c.line;
  g.lineWidth = 2;
  g.setLineDash([14, 14]);
  g.lineDashOffset = -camY;
  g.stroke();
  g.setLineDash([]);

  const drawCar = (car, color, alpha) => {
    const [px, py] = toS(car.x, car.y);
    g.save();
    g.globalAlpha = alpha;
    g.translate(px, py);
    g.rotate(car.a);
    g.fillStyle = color;
    g.beginPath();
    g.roundRect ? g.roundRect(-9, -16, 18, 32, 4) : g.rect(-9, -16, 18, 32);
    g.fill();
    g.fillStyle = c.stage;
    g.fillRect(-6, -12, 12, 6);
    g.restore();
  };
  if (api.params.ghost) drawCar(s.ghost, c.muted, 0.45);
  drawCar(s.car, c.accent, 1);

  g.restore();

  // Stick virtual.
  if (s.stickAnchor) {
    g.strokeStyle = c.accent2;
    g.lineWidth = 2;
    g.beginPath();
    g.arc(s.stickAnchor.x, s.stickAnchor.y, 110, Math.PI * 0.85, Math.PI * 1.15);
    g.stroke();
    g.beginPath();
    g.arc(s.stickAnchor.x, s.stickAnchor.y, 110, -Math.PI * 0.15, Math.PI * 0.15);
    g.stroke();
    g.fillStyle = c.accent2;
    g.beginPath();
    g.arc(s.stickAnchor.x + s.raw * 110, s.stickAnchor.y, 10, 0, Math.PI * 2);
    g.fill();
  }
  text(g, 'mismo input · ', sx + 12, 22, { size: 11, mono: true });
  text(g, 'tu curva', sx + 110, 22, { size: 11, mono: true, color: c.accent });
  if (api.params.ghost) text(g, '· fantasma lineal', sx + 172, 22, { size: 11, mono: true });
}
