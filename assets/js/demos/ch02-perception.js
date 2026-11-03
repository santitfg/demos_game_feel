// CH02-1 · Ciclo de corrección: llevar el cursor a puntos y ver los sub-movimientos (sobrepaso y corrección).
// EX02-1 · Umbral del movimiento: el mismo objeto dibujado a 5, 10, 20, 30 y 60 fps.

import { createDemo, text } from '../core/demo.js';
import { audio } from '../core/audio.js';

// ---------------- CH02-1 ----------------
const AREA = { x: 10, y: 10, w: 600, h: 440 };
const PLOT = { x: 640, y: 40, w: 245, h: 160 };
const DWELL = 0.2; // s quieto dentro del punto para darlo por alcanzado

export function mountCorrection(mount, { id = 'CH02-1' } = {}) {
  return createDemo({
    mount,
    id,
    title: 'El ciclo de corrección',
    width: 900,
    height: 460,
    hint: 'Mueve el mouse: lleva el cursor a cada punto lo más rápido que puedas',
    params: [
      { key: 'r', label: 'Tamaño del punto', min: 4, max: 40, step: 1, value: 10, unit: 'px' },
      { key: 'minD', label: 'Distancia mínima', min: 80, max: 400, step: 10, value: 260, unit: 'px' },
    ],
    metrics: [
      { key: 'mt', label: 'Tiempo del último' },
      { key: 'subs', label: 'Correcciones' },
      { key: 'gap', label: 'Tiempo entre correcciones' },
      { key: 'avg', label: 'Promedio entre correcciones' },
    ],
    foot: `<p><strong>Prueba esto:</strong> alcanza unos diez puntos. Cada parada o cambio de rumbo de tu mano queda marcada en la
      trayectoria y en el gráfico de rapidez: es un ciclo de percibir, decidir y actuar. Un primer movimiento largo y rápido te deja cerca,
      y después llegan correcciones cada vez más chicas, separadas más o menos por un ciclo de corrección. Achica el punto y verás que
      aparecen más correcciones (Fitts).</p>`,

    setup(api) {
      return { target: newTarget(api.params, { x: AREA.x + AREA.w / 2, y: AREA.y + AREA.h / 2 }), path: [], speed: [], t: 0, dwell: 0, last: null, gaps: [], prev: null, sp: 0 };
    },
    update(s, dt, api) {
      const m = api.input.mouse;
      if (!m.inside) return;
      s.t += dt;
      const p = { x: m.x, y: m.y };
      const raw = s.prev ? Math.hypot(p.x - s.prev.x, p.y - s.prev.y) / dt : 0;
      s.prev = p;
      s.sp += (raw - s.sp) * (1 - Math.exp(-dt / 0.025));
      if (s.path.length || s.sp > 30) {
        s.path.push({ ...p, t: s.t, sp: s.sp });
        s.speed.push({ t: s.t, v: s.sp, x: p.x, y: p.y });
      }
      const tg = s.target;
      if (Math.hypot(p.x - tg.x, p.y - tg.y) <= tg.r) {
        s.dwell += dt;
        if (s.dwell >= DWELL && s.path.length > 5) {
          const subs = findSubmovements(s.speed);
          const g = subs.slice(1).map((x, i) => x.t - subs[i].t);
          s.gaps.push(...g);
          if (s.gaps.length > 40) s.gaps.splice(0, s.gaps.length - 40);
          s.last = { path: s.path, speed: s.speed, subs, mt: s.path[s.path.length - 1].t - s.path[0].t - DWELL, gap: g.length ? g.reduce((a, b) => a + b, 0) / g.length : null };
          audio.blip(990);
          s.target = newTarget(api.params, p);
          s.path = [];
          s.speed = [];
          s.t = 0;
          s.dwell = 0;
        }
      } else s.dwell = 0;
    },
    render(g, s, api) {
      const c = api.colors;
      g.fillStyle = c.stage;
      g.fillRect(AREA.x, AREA.y, AREA.w, AREA.h);
      g.strokeStyle = c.line;
      g.strokeRect(AREA.x + 0.5, AREA.y + 0.5, AREA.w, AREA.h);

      // Trayectoria anterior, con sus correcciones.
      if (s.last) {
        drawPath(g, s.last.path, c, 0.35);
        for (const sub of s.last.subs) {
          g.strokeStyle = c.accent2;
          g.lineWidth = 2;
          g.beginPath();
          g.arc(sub.x, sub.y, 7, 0, Math.PI * 2);
          g.stroke();
        }
      }
      drawPath(g, s.path, c, 1);
      const tg = s.target;
      g.fillStyle = c.accent;
      g.beginPath();
      g.arc(tg.x, tg.y, tg.r, 0, Math.PI * 2);
      g.fill();
      if (s.dwell > 0) {
        g.strokeStyle = c.good;
        g.lineWidth = 3;
        g.beginPath();
        g.arc(tg.x, tg.y, tg.r + 6, -Math.PI / 2, -Math.PI / 2 + (Math.min(1, s.dwell / DWELL)) * Math.PI * 2);
        g.stroke();
      }

      // Rapidez del último intento.
      const P = PLOT;
      g.fillStyle = c.surface;
      g.fillRect(P.x, P.y, P.w, P.h);
      g.strokeStyle = c.line;
      g.strokeRect(P.x + 0.5, P.y + 0.5, P.w, P.h);
      text(g, 'Rapidez de la mano en el último punto', P.x, P.y - 10, { size: 12, weight: 600, color: c.text });
      if (s.last && s.last.speed.length > 2) {
        const sp = s.last.speed;
        const t0 = sp[0].t;
        const tEnd = sp[sp.length - 1].t;
        const dur = Math.max(0.3, tEnd - t0);
        const vmax = Math.max(...sp.map((q) => q.v), 1);
        const X = (t) => P.x + ((t - t0) / dur) * P.w;
        const Y = (v) => P.y + P.h - (v / vmax) * (P.h - 10);
        // Bandas de 240 ms.
        for (let t = 0; t < dur; t += 0.24) {
          g.fillStyle = c.grid;
          if (Math.round(t / 0.24) % 2) g.fillRect(X(t0 + t), P.y, X(t0 + Math.min(dur, t + 0.24)) - X(t0 + t), P.h);
        }
        g.strokeStyle = c.accent;
        g.lineWidth = 2;
        g.beginPath();
        sp.forEach((q, i) => (i ? g.lineTo(X(q.t), Y(q.v)) : g.moveTo(X(q.t), Y(q.v))));
        g.stroke();
        for (const sub of s.last.subs) {
          g.fillStyle = c.accent2;
          g.beginPath();
          g.arc(X(sub.t), Y(sub.v), 4, 0, Math.PI * 2);
          g.fill();
        }
        text(g, `${Math.round(dur * 1000)} ms`, P.x + P.w, P.y + P.h + 14, { size: 10, align: 'right', mono: true });
        text(g, 'franjas: 240 ms', P.x, P.y + P.h + 14, { size: 10 });
      } else {
        text(g, 'Alcanza un punto', P.x + P.w / 2, P.y + P.h / 2, { size: 12, align: 'center' });
      }
      text(g, '◯ = corrección: la mano frena', P.x, P.y + P.h + 40, { size: 12, color: c.accent2, weight: 600 });
      text(g, 'y vuelve a acelerar o cambia de rumbo.', P.x, P.y + P.h + 58, { size: 12 });
      text(g, 'Percibir 100 + decidir 70 + actuar 70', P.x, P.y + P.h + 90, { size: 12 });
      text(g, '≈ 240 ms por ciclo (Card, Moran y Newell).', P.x, P.y + P.h + 108, { size: 12 });

      const avg = s.gaps.length ? s.gaps.reduce((a, b) => a + b, 0) / s.gaps.length : null;
      api.metric('mt', s.last ? `${Math.round(s.last.mt * 1000)} ms` : '—');
      api.metric('subs', s.last ? String(Math.max(0, s.last.subs.length - 1)) : '—');
      api.metric('gap', s.last?.gap ? `${Math.round(s.last.gap * 1000)} ms` : '—');
      api.metric('avg', avg ? `${Math.round(avg * 1000)} ms` : '—');
    },
  });
}

function newTarget(p, from) {
  let x;
  let y;
  let n = 0;
  do {
    x = AREA.x + p.r + 10 + Math.random() * (AREA.w - 2 * p.r - 20);
    y = AREA.y + p.r + 10 + Math.random() * (AREA.h - 2 * p.r - 20);
    n++;
  } while (Math.hypot(x - from.x, y - from.y) < p.minD && n < 80);
  return { x, y, r: p.r };
}

// Sub-movimientos: el inicio y cada mínimo local de rapidez seguido de una nueva aceleración.
function findSubmovements(sp) {
  const subs = [];
  if (sp.length < 3) return subs;
  subs.push({ ...sp[0] });
  const vmax = Math.max(...sp.map((q) => q.v));
  let lastT = sp[0].t;
  for (let i = 2; i < sp.length - 2; i++) {
    const v = sp[i].v;
    if (v <= sp[i - 1].v && v < sp[i + 1].v && v < vmax * 0.5) {
      // Debe seguir un repunte claro, y no estar pegado al anterior.
      const ahead = Math.max(...sp.slice(i, i + 12).map((q) => q.v));
      if (ahead - v > Math.max(25, vmax * 0.06) && sp[i].t - lastT > 0.08) {
        subs.push({ ...sp[i] });
        lastT = sp[i].t;
      }
    }
  }
  return subs;
}

function drawPath(g, path, c, alpha) {
  if (path.length < 2) return;
  g.globalAlpha = alpha;
  g.lineWidth = 2;
  for (let i = 1; i < path.length; i++) {
    const k = Math.min(1, path[i].sp / 1500);
    g.strokeStyle = k > 0.3 ? c.accent : c.accent3;
    g.beginPath();
    g.moveTo(path[i - 1].x, path[i - 1].y);
    g.lineTo(path[i].x, path[i].y);
    g.stroke();
  }
  g.globalAlpha = 1;
}


// ---------------- EX02-1 ----------------
const RATES = [5, 10, 20, 30, 60];

export function mountFrameRates(mount, { id = 'EX02-1' } = {}) {
  return createDemo({
    mount,
    id,
    title: 'Umbral del movimiento: de 5 a 60 fps',
    width: 900,
    height: 420,
    hint: 'Mueve el mouse a los lados sobre el área',
    modes: [
      { key: '1', label: 'Lo mueves tú' },
      { key: '2', label: 'Movimiento automático' },
    ],
    params: [
      { key: 'speed', label: 'Velocidad automática', min: 0.2, max: 3, step: 0.05, value: 1, unit: '×' },
    ],
    foot: `<p><strong>Prueba esto:</strong> mueve el mouse de lado a lado. Las cinco filas muestran el mismo objeto, pero cada una solo
      se redibuja a su tasa. A 5 fps ves saltos sueltos, no movimiento. Cerca de 10 fps las posiciones se empiezan a fundir en un objeto que
      se mueve, aunque a tirones. A 20 o 30 se vuelve fluido, y 60 es lo que tu monitor probablemente da. Fíjate también en que las filas
      lentas <em>llegan tarde</em>: una tasa baja también es latencia.</p>`,

    setup() {
      return { x: 450, t: 0, shown: RATES.map(() => ({ x: 450, at: -1 })) };
    },
    update(s, dt, api) {
      s.t += dt;
      if (api.mode === '1') {
        if (api.input.mouse.inside) s.x = Math.max(160, Math.min(870, api.input.mouse.x));
      } else {
        s.x = 515 + Math.sin(s.t * 2.2 * api.params.speed) * 340;
      }
    },
    render(g, s, api) {
      const c = api.colors;
      const now = performance.now() / 1000;
      g.fillStyle = c.stage;
      g.fillRect(0, 0, api.w, api.h);
      const lane = api.h / RATES.length;
      g.fillStyle = c.surface;
      g.fillRect(0, 0, 130, api.h);
      RATES.forEach((fps, i) => {
        const sh = s.shown[i];
        if (now - sh.at >= 1 / fps - 0.001) { sh.x = s.x; sh.at = now - sh.at > 2 / fps ? now : sh.at + 1 / fps; }
        const y = lane * i + lane / 2;
        g.strokeStyle = c.grid;
        g.beginPath();
        g.moveTo(0, Math.round(lane * (i + 1)) + 0.5);
        g.lineTo(api.w, Math.round(lane * (i + 1)) + 0.5);
        g.stroke();
        g.fillStyle = fps < 10 ? c.bad : fps < 20 ? c.warn : c.accent;
        g.fillRect(sh.x - 18, y - 18, 36, 36);
        text(g, `${fps} fps`, 14, y + 5, { size: 14, weight: 700, mono: true, color: c.text });
        text(g, fps < 10 ? 'debajo del umbral' : fps < 20 ? 'en el umbral' : fps < 30 ? 'fluido' : 'muy fluido', 14, y + 22, { size: 10 });
      });
    },
  });
}
