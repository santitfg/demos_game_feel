// LAB · Tiempo de reacción: cuánto tardas en percibir, decidir y actuar.
// Se mide desde que se dibuja el estímulo hasta el timestamp del evento de input (+ el retraso añadido).

import { createDemo, text } from '../core/demo.js';
import { audio } from '../core/audio.js';

// Procesador Humano Modelo (Card, Moran y Newell): ciclo típico y rango de cada procesador.
const MHP = [
  { k: 'Percepción', ms: 100, lo: 50, hi: 200, color: 'accent' },
  { k: 'Cognición', ms: 70, lo: 30, hi: 100, color: 'accent2' },
  { k: 'Motor', ms: 70, lo: 25, hi: 170, color: 'accent3' },
];
const SCALE_MAX = 600;

export function mountLagReaction(mount, { id = 'LAB-L5' } = {}) {
  let S = null;
  const api = createDemo({
    mount,
    id,
    title: 'Tiempo de reacción',
    width: 900,
    height: 420,
    hint: 'Clic aquí o Espacio para empezar',
    params: [
      { key: 'stim', type: 'select', label: 'Estímulo', options: [['visual', 'Visual (el panel se pone verde)'], ['sound', 'Sonido (un pitido)'], ['both', 'Visual y sonido']], value: 'visual' },
      { key: 'delay', label: 'Latencia añadida del sistema', min: 0, max: 300, step: 10, value: 0, unit: 'ms', help: 'Se suma a cada medición, como un juego que tarda en leer tu botón.' },
    ],
    metrics: [
      { key: 'last', label: 'Última' },
      { key: 'avg', label: 'Promedio (últimas 10)' },
      { key: 'best', label: 'Mejor' },
      { key: 'early', label: 'Adelantos' },
    ],
    foot: `<p><strong>Prueba esto:</strong> haz 10 intentos. Con estímulo visual, la mayoría ronda los 200–280 ms; con sonido suele ser algo más
      rápido. Esa cifra ya incluye la latencia de tu monitor y de tu mouse o teclado, que en equipos comunes suma entre 10 y 50 ms antes de que
      entre ningún juego. Después sube la latencia añadida a 100 ms: el sistema se come una parte del ciclo que le correspondía a tu cuerpo.</p>`,

    setup() {
      S = { phase: 'idle', goAt: 0, shownAt: null, times: [], early: 0, last: null };
      return S;
    },

    update(s, dt, a) {
      const now = performance.now();
      if (s.phase === 'wait' && now >= s.goAt) {
        s.phase = 'go';
        s.shownAt = null;
        if (a.params.stim !== 'visual') {
          audio.tone({ freq: 1000, dur: 0.15, type: 'sine', gain: 0.35 });
          if (a.params.stim === 'sound') s.shownAt = now;
        }
      }
    },

    render(g, s, a) {
      const c = a.colors;
      const p = a.params;
      const PANEL = { x: 10, y: 10, w: 520, h: a.h - 20 };
      const showGreen = s.phase === 'go' && p.stim !== 'sound';
      if (s.phase === 'go' && s.shownAt == null) s.shownAt = performance.now();

      g.fillStyle = showGreen ? c.good : s.phase === 'early' ? c.bad : c.surface2;
      g.fillRect(PANEL.x, PANEL.y, PANEL.w, PANEL.h);
      const cx = PANEL.x + PANEL.w / 2;
      const cy = PANEL.y + PANEL.h / 2;
      const big = { align: 'center', size: 26, weight: 700, color: showGreen || s.phase === 'early' ? c.bg : c.text };
      const small = { align: 'center', size: 13, color: showGreen || s.phase === 'early' ? c.bg : c.muted };
      if (s.phase === 'idle') {
        text(g, 'Clic o Espacio para empezar', cx, cy - 6, big);
        text(g, p.stim === 'sound' ? 'Cuando suene el pitido, pulsa lo más rápido que puedas.' : 'Cuando el panel se ponga verde, pulsa lo más rápido que puedas.', cx, cy + 22, small);
      } else if (s.phase === 'wait') {
        text(g, p.stim === 'sound' ? 'Espera el pitido…' : 'Espera el verde…', cx, cy, big);
      } else if (s.phase === 'go') {
        text(g, '¡Ahora!', cx, cy, big);
      } else if (s.phase === 'early') {
        text(g, 'Demasiado pronto', cx, cy - 6, big);
        text(g, 'Clic o Espacio para intentar de nuevo', cx, cy + 22, small);
      } else if (s.phase === 'result') {
        text(g, `${Math.round(s.last)} ms`, cx, cy - 6, { ...big, size: 40 });
        text(g, 'Clic o Espacio para otro intento', cx, cy + 26, small);
      }

      drawBreakdown(g, c, { x: 570, y: 40, w: 310 }, s, p.delay);

      const recent = s.times.slice(-10);
      const avg = recent.length ? recent.reduce((x, y) => x + y, 0) / recent.length : null;
      a.metric('last', s.last != null ? `${Math.round(s.last)} ms` : '—');
      a.metric('avg', avg ? `${Math.round(avg)} ms` : '—');
      a.metric('best', s.times.length ? `${Math.round(Math.min(...s.times))} ms` : '—');
      a.metric('early', String(s.early));
    },
  });

  // Se usa el timestamp del evento (no el del paso de simulación) para medir con precisión.
  api.input.onEvent((ev) => {
    const hit = ev.type === 'down' || (ev.type === 'keydown' && (ev.code === 'Space' || ev.code === 'Enter'));
    if (!hit || !S) return;
    if (S.phase === 'idle' || S.phase === 'result' || S.phase === 'early') {
      S.phase = 'wait';
      S.goAt = performance.now() + 1200 + Math.random() * 2300;
    } else if (S.phase === 'wait') {
      S.phase = 'early';
      S.early++;
      audio.tone({ freq: 180, dur: 0.12, type: 'square', gain: 0.06 });
    } else if (S.phase === 'go' && S.shownAt != null) {
      const rt = ev.t + api.params.delay - S.shownAt;
      S.last = rt;
      S.times.push(rt);
      if (S.times.length > 50) S.times.shift();
      S.phase = 'result';
    }
  });
  return api;
}

// Barra del ciclo humano (modelo) frente a tus tiempos.
function drawBreakdown(g, c, { x, y, w }, s, delay) {
  const X = (ms) => x + (Math.min(SCALE_MAX, ms) / SCALE_MAX) * w;
  text(g, 'Procesador Humano Modelo (ciclo típico)', x, y, { size: 12, weight: 600, color: c.text });
  let acc = 0;
  const by = y + 12;
  for (const m of MHP) {
    g.fillStyle = c[m.color];
    g.fillRect(X(acc), by, X(acc + m.ms) - X(acc), 22);
    text(g, String(m.ms), (X(acc) + X(acc + m.ms)) / 2, by + 15, { size: 10, align: 'center', color: c.bg, weight: 700, mono: true });
    acc += m.ms;
  }
  // Leyenda: nombre y rango de cada procesador.
  let lx = x;
  for (const m of MHP) {
    g.fillStyle = c[m.color];
    g.fillRect(lx, by + 56, 9, 9);
    text(g, `${m.k} ${m.lo}–${m.hi}`, lx + 13, by + 65, { size: 10 });
    lx += 13 + g.measureText(`${m.k} ${m.lo}–${m.hi}`).width + 12;
  }
  // Rango posible: suma de mínimos a suma de máximos.
  const lo = MHP.reduce((a, m) => a + m.lo, 0);
  const hi = MHP.reduce((a, m) => a + m.hi, 0);
  g.strokeStyle = c.muted;
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(X(lo), by + 32); g.lineTo(X(hi), by + 32);
  g.moveTo(X(lo), by + 28); g.lineTo(X(lo), by + 36);
  g.moveTo(X(hi), by + 28); g.lineTo(X(hi), by + 36);
  g.stroke();
  text(g, `rango ${lo}–${hi} ms`, X(hi), by + 48, { size: 10, align: 'right' });

  // Tus intentos.
  const ty = by + 104;
  text(g, 'Tus intentos', x, ty - 10, { size: 12, weight: 600, color: c.text });
  g.fillStyle = c.surface2;
  g.fillRect(x, ty, w, 26);
  if (delay > 0) {
    g.fillStyle = c.warn;
    g.globalAlpha = 0.3;
    g.fillRect(x, ty, X(delay) - x, 26);
    g.globalAlpha = 1;
    text(g, 'sistema', x + 3, ty + 40, { size: 10, color: c.warn });
  }
  s.times.slice(-10).forEach((t, i, arr) => {
    g.fillStyle = c.text;
    g.globalAlpha = 0.35 + (0.65 * (i + 1)) / arr.length;
    g.fillRect(X(t) - 1.5, ty + 3, 3, 20);
  });
  g.globalAlpha = 1;
  const recent = s.times.slice(-10);
  if (recent.length) {
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    g.fillStyle = c.accent;
    g.beginPath();
    g.moveTo(X(avg), ty - 2);
    g.lineTo(X(avg) - 6, ty - 10);
    g.lineTo(X(avg) + 6, ty - 10);
    g.closePath();
    g.fill();
  }

  // Eje y umbral de 240 ms.
  const ay = ty + 56;
  g.strokeStyle = c.line;
  g.beginPath();
  g.moveTo(x, ay); g.lineTo(x + w, ay);
  g.stroke();
  for (let t = 0; t <= SCALE_MAX; t += 100) text(g, String(t), X(t), ay + 14, { size: 10, align: 'center', mono: true });
  text(g, 'ms', x + w, ay + 28, { size: 10, align: 'right' });
  g.strokeStyle = c.bad;
  g.setLineDash([4, 3]);
  g.beginPath();
  g.moveTo(X(240), by - 4); g.lineTo(X(240), by + 40);
  g.moveTo(X(240), ty - 4); g.lineTo(X(240), ay);
  g.stroke();
  g.setLineDash([]);
  text(g, '240 ms: un ciclo de corrección', X(240) + 4, ay + 44, { size: 10, color: c.bad });

  text(g, 'Swink cuenta que su mejor marca ronda los 170 ms.', x, ay + 80, { size: 11 });
  text(g, 'Un juego con 100 ms de lag te quita casi medio ciclo.', x, ay + 98, { size: 11 });
}
