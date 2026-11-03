// LAB · Tareas con lag (mouse): seguir un objetivo móvil (error RMS) y apuntar (Fitts).
// Cada ronda guarda un punto (latencia, puntaje) en el gráfico de degradación.

import { createDemo, text } from '../core/demo.js';
import { audio } from '../core/audio.js';
import { Pipeline, FPS_OPTIONS } from './shared/pipeline.js';
import { drawResults } from './shared/lagviz.js';

const ARENA = { x: 10, y: 10, w: 560, h: 440 };
const CHART = { x: 640, y: 60, w: 240, h: 300 };
const TRACK_SECS = 10;
const AIM_TARGETS = 10;

export function mountLagTasks(mount, { id = 'LAB-L2' } = {}) {
  let pipe = null;
  const results = { 1: [], 2: [] };
  return createDemo({
    mount,
    id,
    title: 'Tareas con lag: seguir y apuntar',
    width: 900,
    height: 460,
    hint: 'Clic en el área para empezar una ronda',
    params: [
      { key: 'delay', label: 'Retraso del input', min: 0, max: 500, step: 10, value: 0, unit: 'ms' },
      { key: 'fps', type: 'select', label: 'Imagen', options: FPS_OPTIONS, value: '0' },
      { heading: 'Seguir' },
      { key: 'speed', label: 'Velocidad del objetivo', min: 0.3, max: 2, step: 0.05, value: 1, unit: '×' },
      { heading: 'Apuntar' },
      { key: 'r', label: 'Radio de los objetivos', min: 6, max: 40, step: 1, value: 16, unit: 'px' },
      { presets: { '0 ms': { delay: 0 }, '100 ms': { delay: 100 }, '200 ms': { delay: 200 }, '300 ms': { delay: 300 } } },
    ],
    modes: [
      { key: '1', label: 'Seguir' },
      { key: '2', label: 'Apuntar' },
    ],
    onModeChange(key, s, api) { if (s?.phase) api.reset(); },
    metrics: [
      { key: 'round', label: 'Ronda' },
      { key: 'score', label: 'Puntaje' },
      { key: 'extra', label: 'Fallos / sobrepasos' },
      { key: 'n', label: 'Rondas guardadas' },
    ],
    foot: `<p><strong>Prueba esto:</strong> haz una ronda de <kbd>1</kbd> Seguir con 0 ms, otra con 100 ms y otra con 300 ms (usa los presets).
      Cada ronda deja un punto en el gráfico; la línea es el promedio por tramo. Seguir un objetivo es una cadena continua de correcciones,
      así que el error crece con el retraso. Con <kbd>2</kbd> Apuntar, el lag no te frena al llegar: te hace <em>pasarte</em>, porque
      sigues moviendo la mano hasta ver que el cursor llegó. <kbd>C</kbd> borra los resultados.</p>`,

    setup(api) {
      pipe ||= new Pipeline(api.input);
      return {
        phase: 'ready', // ready | run | done
        cur: { x: ARENA.x + ARENA.w / 2, y: ARENA.y + ARENA.h / 2 },
        view: { cur: { x: ARENA.x + ARENA.w / 2, y: ARENA.y + ARENA.h / 2 }, target: null },
        t: 0, sumSq: 0, err: 0,
        target: null, hits: 0, misses: 0, overs: 0, times: [],
        last: null,
      };
    },

    update(s, dt, api) {
      const p = api.params;
      const mode = api.mode;
      pipe.configure({ delay: p.delay, fps: p.fps });
      if (api.input.wasPressed('KeyC')) results[mode].length = 0;
      if (!pipe.step()) { pipe.endStep(); return; }
      const L = pipe.input;
      if (L.mouse.inside || L.mouse.down) {
        s.cur.x = Math.max(ARENA.x, Math.min(ARENA.x + ARENA.w, L.mouse.x));
        s.cur.y = Math.max(ARENA.y, Math.min(ARENA.y + ARENA.h, L.mouse.y));
      }
      const click = L.mousePressed && inArena(s.cur);
      pipe.endStep();

      if (s.phase !== 'run') {
        if (click) start(s, mode, p);
        return;
      }

      if (mode === '1') {
        s.t += dt;
        s.target = trackPos(s.t, p.speed);
        const d = Math.hypot(s.cur.x - s.target.x, s.cur.y - s.target.y);
        s.sumSq += d * d * dt;
        s.err = Math.sqrt(s.sumSq / s.t);
        if (s.t >= TRACK_SECS) finish(s, { x: p.delay, y: s.err });
      } else {
        s.t += dt;
        const t = s.target;
        const d = Math.hypot(s.cur.x - t.x, s.cur.y - t.y);
        if (d < t.minD) { t.minD = d; t.approaching = true; } else if (t.approaching && d > t.minD + 6 && t.minD < t.r * 4) {
          s.overs++;
          t.approaching = false;
          t.minD = d;
        }
        if (click) {
          if (d <= t.r) {
            s.times.push(s.t - t.t0);
            s.hits++;
            audio.blip(990);
            if (s.hits >= AIM_TARGETS) {
              const mean = s.times.reduce((a, b) => a + b, 0) / s.times.length;
              finish(s, { x: p.delay, y: mean * 1000 });
            } else {
              s.target = aimTarget(s.cur, p.r, s.t);
            }
          } else {
            s.misses++;
            audio.tone({ freq: 180, dur: 0.08, type: 'square', gain: 0.06 });
          }
        }
      }

      function finish(st, point) {
        st.phase = 'done';
        st.last = point;
        results[mode].push(point);
        if (results[mode].length > 60) results[mode].shift();
        audio.blip(660);
      }
    },

    render(g, s, api) {
      const c = api.colors;
      const p = api.params;
      const mode = api.mode;
      if (pipe.present()) s.view = { cur: { ...s.cur }, target: s.target && { ...s.target } };
      const v = s.view;

      g.fillStyle = c.stage;
      g.fillRect(ARENA.x, ARENA.y, ARENA.w, ARENA.h);
      g.strokeStyle = c.line;
      g.lineWidth = 1;
      g.strokeRect(ARENA.x + 0.5, ARENA.y + 0.5, ARENA.w, ARENA.h);

      const cx = ARENA.x + ARENA.w / 2;
      if (s.phase === 'run' && v.target) {
        if (mode === '1') {
          g.strokeStyle = c.grid;
          g.lineWidth = 2;
          g.beginPath();
          for (let i = 0; i <= 200; i++) {
            const q = trackPos(s.t + (i - 100) * 0.03, p.speed);
            i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y);
          }
          g.stroke();
          g.fillStyle = c.accent;
          g.globalAlpha = 0.25;
          g.beginPath();
          g.arc(v.target.x, v.target.y, 26, 0, Math.PI * 2);
          g.fill();
          g.globalAlpha = 1;
          g.beginPath();
          g.arc(v.target.x, v.target.y, 8, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = c.accent;
          g.fillRect(ARENA.x, ARENA.y + ARENA.h - 4, ARENA.w * Math.min(1, s.t / TRACK_SECS), 4);
        } else {
          g.fillStyle = c.accent;
          g.beginPath();
          g.arc(v.target.x, v.target.y, v.target.r, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = c.surface;
          g.beginPath();
          g.arc(v.target.x, v.target.y, Math.max(2, v.target.r * 0.3), 0, Math.PI * 2);
          g.fill();
          text(g, `${s.hits} / ${AIM_TARGETS}`, ARENA.x + 12, ARENA.y + 22, { mono: true, size: 12, color: c.text });
        }
      } else {
        const title = mode === '1' ? 'Seguir: mantén el cursor sobre el punto durante 10 s' : `Apuntar: haz clic en ${AIM_TARGETS} objetivos`;
        text(g, title, cx, ARENA.y + ARENA.h / 2 - 40, { align: 'center', size: 15, weight: 600, color: c.text });
        text(g, `Clic para empezar · retraso ${p.delay} ms`, cx, ARENA.y + ARENA.h / 2 - 16, { align: 'center', size: 13 });
        if (s.phase === 'done' && s.last) {
          const val = mode === '1' ? `error RMS ${s.last.y.toFixed(1)} px` : `${Math.round(s.last.y)} ms por objetivo`;
          text(g, `Resultado: ${val}`, cx, ARENA.y + ARENA.h / 2 + 20, { align: 'center', size: 15, weight: 700, color: c.accent });
        }
      }

      // Cursor del juego (con lag).
      g.strokeStyle = c.text;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(v.cur.x - 9, v.cur.y); g.lineTo(v.cur.x + 9, v.cur.y);
      g.moveTo(v.cur.x, v.cur.y - 9); g.lineTo(v.cur.x, v.cur.y + 9);
      g.stroke();

      drawResults(g, CHART, c, mode === '1'
        ? { points: results[1], yMax: 160, yLabel: 'error RMS (px)', title: 'Seguir: error según el retraso', now: p.delay }
        : { points: results[2], yMax: 3000, yLabel: 'ms por objetivo', title: 'Apuntar: tiempo según el retraso', now: p.delay, fmtY: (y) => (y / 1000).toFixed(1) + 's' });

      const n = results[mode].length;
      api.metric('n', String(n));
      api.metric('round', s.phase === 'run' ? (mode === '1' ? `${s.t.toFixed(1)} / ${TRACK_SECS} s` : `${s.hits} / ${AIM_TARGETS}`) : s.phase === 'done' ? 'terminada' : 'lista');
      if (mode === '1') {
        api.metric('score', s.phase === 'ready' ? '—' : `${s.err.toFixed(1)} px RMS`);
        api.metric('extra', '—');
      } else {
        const mean = s.times.length ? s.times.reduce((a, b) => a + b, 0) / s.times.length : 0;
        api.metric('score', s.times.length ? `${Math.round(mean * 1000)} ms` : '—');
        api.metric('extra', s.phase === 'ready' ? '—' : `${s.misses} / ${s.overs}`);
      }
    },
  });
}

const inArena = (q) => q.x > ARENA.x && q.x < ARENA.x + ARENA.w && q.y > ARENA.y && q.y < ARENA.y + ARENA.h;

function start(s, mode, p) {
  Object.assign(s, { phase: 'run', t: 0, sumSq: 0, err: 0, hits: 0, misses: 0, overs: 0, times: [], last: null });
  s.target = mode === '1' ? trackPos(0, p.speed) : aimTarget(s.cur, p.r, 0);
}

// Curva de Lissajous: velocidad variable y cambios de dirección suaves pero imprevisibles.
function trackPos(t, speed) {
  const k = t * speed;
  return {
    x: ARENA.x + ARENA.w / 2 + Math.sin(k * 0.9) * 200 + Math.sin(k * 2.3 + 1) * 40,
    y: ARENA.y + ARENA.h / 2 + Math.sin(k * 1.27 + 0.6) * 150 + Math.cos(k * 2.9) * 30,
  };
}

function aimTarget(from, r, time) {
  let x;
  let y;
  let tries = 0;
  do {
    const ang = Math.random() * Math.PI * 2;
    const D = 140 + Math.random() * 220;
    x = from.x + Math.cos(ang) * D;
    y = from.y + Math.sin(ang) * D;
    tries++;
  } while ((x < ARENA.x + r + 8 || x > ARENA.x + ARENA.w - r - 8 || y < ARENA.y + r + 30 || y > ARENA.y + ARENA.h - r - 8) && tries < 60);
  return { x, y, r, t0: time, minD: Infinity, approaching: false };
}

