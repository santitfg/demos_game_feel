// LAB · Comparador de suavizados: cuatro formas de llevar un valor hacia un objetivo.

import { createDemo, text } from '../core/demo.js';
import { expSmooth, moveTowards, springStep, criticalDamping } from '../core/curves.js';

const LANES = [
  { key: 'snap', label: 'Directo (sin suavizado)', color: 'muted' },
  { key: 'linear', label: 'Lineal (velocidad constante)', color: 'accent3' },
  { key: 'exp', label: 'Exponencial (lerp por frame)', color: 'accent2' },
  { key: 'spring', label: 'Resorte amortiguado', color: 'accent' },
];
const X0 = 230;
const X1 = 870;

export function mountSmoothing(mount, { id = 'LAB-C4' } = {}) {
  return createDemo({
    mount,
    id,
    title: 'Suavizados: cuatro maneras de llegar',
    width: 900,
    height: 300,
    hint: 'Clic en el carril para fijar el objetivo',
    params: [
      { key: 'linSpeed', label: 'Lineal: velocidad', min: 100, max: 3000, step: 10, value: 900, unit: 'px/s' },
      { key: 'rate', label: 'Exponencial: tasa', min: 1, max: 40, step: 0.5, value: 9, unit: '/s', help: 'Fracción de la distancia recorrida por segundo (independiente del framerate).' },
      { key: 'k', label: 'Resorte: rigidez', min: 10, max: 800, step: 5, value: 180 },
      { key: 'zeta', label: 'Resorte: amortiguación (ζ)', min: 0.05, max: 2, step: 0.01, value: 0.45, help: 'ζ<1 rebota (subamortiguado), ζ=1 llega sin rebotar lo más rápido posible, ζ>1 se arrastra.' },
    ],
    modes: [
      { key: '1', label: 'Saltos automáticos', values: {} },
      { key: '2', label: 'Seguir al mouse', values: {} },
      { key: '3', label: 'Clic para fijar', values: {} },
    ],
    graph: {
      window: 3,
      series: [
        { label: 'objetivo', color: 'text', min: 0, max: 1, width: 1, step: true },
        ...LANES.map((l) => ({ label: l.key, color: l.color })),
      ],
    },
    metrics: LANES.map((l) => ({ key: l.key, label: `Asentamiento: ${l.label.split(' (')[0]}` })),
    foot: `<p><strong>Prueba esto:</strong> en <kbd>2</kbd> mueve el mouse en zigzag. El lineal llega "robótico", el exponencial
      frena suave pero nunca rebota, y el resorte con ζ&lt;1 sobrepasa y vuelve: se lee como <em>masa</em>. Sube ζ a 1 y desaparece el rebote.</p>`,

    setup() {
      const start = (X0 + X1) / 2;
      return {
        target: start,
        lastJump: 0,
        timer: 0,
        vals: { snap: start, linear: start, exp: start, spring: { x: start, v: 0 } },
        settle: {},
      };
    },

    update(s, dt, api) {
      const { input: inp, params: p } = api;
      const prev = s.target;
      if (api.mode === '1') {
        s.timer -= dt;
        if (s.timer <= 0) {
          s.timer = 1.6;
          s.target = X0 + Math.random() * (X1 - X0);
        }
      } else if (api.mode === '2') {
        if (inp.mouse.inside) s.target = Math.max(X0, Math.min(X1, inp.mouse.x));
      } else if (inp.mousePressed || inp.mouse.down) {
        s.target = Math.max(X0, Math.min(X1, inp.mouse.x));
      }
      if (Math.abs(s.target - prev) > 4) {
        s.lastJump = api.time;
        s.settle = {};
        if (api.mode !== '2') api.graph.mark(api.time);
      }

      const v = s.vals;
      v.snap = s.target;
      v.linear = moveTowards(v.linear, s.target, p.linSpeed * dt);
      v.exp = expSmooth(v.exp, s.target, p.rate, dt);
      springStep(v.spring, s.target, { k: p.k, c: p.zeta * criticalDamping(p.k, 1), m: 1 }, dt);

      // Tiempo de asentamiento: hasta quedar a <2 px del objetivo y quieto.
      for (const l of LANES) {
        const x = l.key === 'spring' ? v.spring.x : v[l.key];
        const still = l.key !== 'spring' || Math.abs(v.spring.v) < 20;
        if (Math.abs(x - s.target) < 2 && still) {
          if (s.settle[l.key] == null) s.settle[l.key] = api.time - s.lastJump;
        } else s.settle[l.key] = null;
      }

      const n = (x) => (x - X0) / (X1 - X0);
      api.graph.push(api.time, [n(s.target), n(v.snap), n(v.linear), n(v.exp), n(v.spring.x)]);
    },

    render(g, s, api) {
      const c = api.colors;
      const laneH = 62;
      LANES.forEach((l, i) => {
        const y = 28 + i * laneH;
        g.fillStyle = i % 2 ? c.surface : c.surface2;
        g.fillRect(0, y, api.w, laneH);
        text(g, l.label, 14, y + laneH / 2 + 4, { size: 12.5, color: c.text, weight: 500 });
        const x = l.key === 'spring' ? s.vals.spring.x : s.vals[l.key];
        g.fillStyle = c[l.color];
        g.beginPath();
        g.arc(x, y + laneH / 2, 14, 0, Math.PI * 2);
        g.fill();
        const st = s.settle[l.key];
        api.metric(l.key, st == null ? 'en camino…' : `${Math.round(st * 1000)} ms`);
      });
      // Objetivo.
      g.strokeStyle = c.text;
      g.lineWidth = 2;
      g.setLineDash([5, 5]);
      g.beginPath();
      g.moveTo(s.target, 20);
      g.lineTo(s.target, 28 + LANES.length * laneH);
      g.stroke();
      g.setLineDash([]);
      text(g, 'objetivo', s.target, 16, { align: 'center', size: 11, mono: true });
    },
  });
}
