// LAB · Ratio control-display (C:D) y aceleración del puntero.
// El cursor virtual se mueve con delta_mouse × ganancia(velocidad). Tarea de Fitts para medir.

import { createDemo, text } from '../core/demo.js';
import { drawCurvePlot } from '../core/plot.js';
import { audio } from '../core/audio.js';

const PLOT = { x: 54, y: 46, w: 240, h: 200 };
const ARENA = { x: 330, y: 10, w: 560, h: 440 };
const VMAX = 2500;
const GMAX = 6;

export function gainFn(p) {
  if (p.curve === 'const') return () => p.gain;
  if (p.curve === 'linear') return (v) => Math.min(p.gmax, p.gmin + (v / VMAX) * (p.gmax - p.gmin) * 1.5);
  // Sigmoide: lento con movimientos lentos (precisión), rápido con movimientos rápidos (alcance).
  return (v) => p.gmin + (p.gmax - p.gmin) / (1 + Math.exp(-(v - p.vmid) / (p.vmid * 0.25)));
}

export function mountCDRatio(mount, { id = 'LAB-M4' } = {}) {
  return createDemo({
    mount,
    id,
    title: 'Ratio C:D y aceleración del puntero',
    width: 900,
    height: 460,
    pointerLock: true,
    hint: 'Clic para capturar el mouse · Esc para soltarlo',
    params: [
      { key: 'curve', type: 'select', label: 'Ganancia', options: [['const', 'Constante (C:D fijo)'], ['accel', 'Aceleración (sigmoide)'], ['linear', 'Aceleración lineal']], value: 'const' },
      { key: 'gain', label: 'Ganancia constante', min: 0.1, max: 5, step: 0.05, value: 1, unit: '×' },
      { key: 'gmin', label: 'Ganancia mínima (lento)', min: 0.1, max: 2, step: 0.05, value: 0.6, unit: '×' },
      { key: 'gmax', label: 'Ganancia máxima (rápido)', min: 0.5, max: 6, step: 0.05, value: 2.6, unit: '×' },
      { key: 'vmid', label: 'Velocidad de transición', min: 100, max: 2000, step: 10, value: 600, unit: 'px/s' },
      { heading: 'Tarea' },
      { key: 'minR', label: 'Radio mínimo del objetivo', min: 4, max: 30, step: 1, value: 10, unit: 'px' },
      { key: 'maxR', label: 'Radio máximo del objetivo', min: 10, max: 60, step: 1, value: 32, unit: 'px' },
    ],
    modes: [
      { key: '1', label: '1:1', values: { curve: 'const', gain: 1 } },
      { key: '2', label: 'Rápido ×3', values: { curve: 'const', gain: 3 } },
      { key: '3', label: 'Lento ×0.4', values: { curve: 'const', gain: 0.4 } },
      { key: '4', label: 'Aceleración tipo SO', values: { curve: 'accel', gmin: 0.6, gmax: 2.6, vmid: 600 } },
      { key: '5', label: 'Aceleración extrema', values: { curve: 'accel', gmin: 0.25, gmax: 6, vmid: 450 } },
    ],
    onModeChange(key, s) { if (s?.resetStats) s.resetStats(); },
    metrics: [
      { key: 'mt', label: 'Tiempo medio por objetivo' },
      { key: 'over', label: 'Sobrepasos por objetivo' },
      { key: 'miss', label: 'Clics fallados' },
      { key: 'tp', label: 'Rendimiento (Fitts)' },
    ],
    foot: `<p><strong>Prueba esto:</strong> haz 10 objetivos con cada modo. Con <kbd>2</kbd> (×3) llegas rápido pero sobrepasas los objetivos chicos;
      con <kbd>3</kbd> (×0.4) eres preciso pero tienes que "remar" con el mouse. La aceleración <kbd>4</kbd> intenta darte las dos cosas:
      ganancia baja al moverte despacio cerca del objetivo y alta en los desplazamientos largos. El <em>rendimiento</em> (bits/s) resume ambas cosas.</p>`,

    setup(api) {
      const s = {
        cur: { x: ARENA.x + ARENA.w / 2, y: ARENA.y + ARENA.h / 2 },
        speed: 0,
        g: 1,
        stats: [],
        misses: 0,
      };
      s.resetStats = () => { s.stats = []; s.misses = 0; s.target = newTarget(s.cur, api.params, api.time); };
      s.target = newTarget(s.cur, api.params, api.time);
      return s;
    },

    update(s, dt, api) {
      const { input: inp, params: p } = api;
      const dx = inp.mouse.dx;
      const dy = inp.mouse.dy;
      const raw = Math.hypot(dx, dy) / dt;
      s.speed += (raw - s.speed) * (1 - Math.exp(-dt / 0.04));
      s.g = gainFn(p)(s.speed);
      if (inp.locked || inp.mouse.down) {
        s.cur.x = Math.max(ARENA.x, Math.min(ARENA.x + ARENA.w, s.cur.x + dx * s.g));
        s.cur.y = Math.max(ARENA.y, Math.min(ARENA.y + ARENA.h, s.cur.y + dy * s.g));
      }

      // Sobrepasos: el cursor se acercaba al objetivo y empieza a alejarse.
      const t = s.target;
      const d = Math.hypot(s.cur.x - t.x, s.cur.y - t.y);
      if (d < t.minD) { t.minD = d; t.approaching = true; } else if (t.approaching && d > t.minD + 6 && t.minD < t.r * 4) {
        t.overshoots++;
        t.approaching = false;
        t.minD = d;
      }

      // Con captura, el clic cuenta al pulsar; sin captura (táctil), al levantar el dedo.
      const click = (inp.mousePressed && inp.locked) || (inp.mouseReleased && !inp.locked);
      if (click) {
        if (d <= t.r) {
          s.stats.push({ mt: api.time - t.t0, id: Math.log2(t.D / (2 * t.r) + 1), over: t.overshoots });
          if (s.stats.length > 10) s.stats.shift();
          audio.blip(990);
          s.target = newTarget(s.cur, p, api.time);
        } else {
          s.misses++;
          audio.tone({ freq: 180, dur: 0.08, type: 'square', gain: 0.06 });
        }
      }
    },

    render(g, s, api) {
      const c = api.colors;
      const p = api.params;
      const fn = gainFn(p);
      drawCurvePlot(g, PLOT, {
        fn: (v) => fn(v),
        xMax: VMAX,
        yMax: GMAX,
        point: { x: Math.min(VMAX, s.speed), y: Math.min(GMAX, s.g) },
        xLabel: 'velocidad del mouse (px/s)',
        yLabel: 'ganancia',
        title: 'Curva de ganancia',
      });
      text(g, `ganancia actual  ${s.g.toFixed(2)}×`, PLOT.x, PLOT.y + PLOT.h + 46, { mono: true, size: 12, color: c.text });
      text(g, `C:D equivalente  1 : ${s.g.toFixed(2)}`, PLOT.x, PLOT.y + PLOT.h + 66, { mono: true, size: 12 });
      text(g, `velocidad        ${Math.round(s.speed)} px/s`, PLOT.x, PLOT.y + PLOT.h + 86, { mono: true, size: 12 });
      const last = s.stats[s.stats.length - 1];
      if (last) text(g, `último: ${Math.round(last.mt * 1000)} ms · ID ${last.id.toFixed(2)} bits`, PLOT.x, PLOT.y + PLOT.h + 106, { mono: true, size: 12 });
      text(g, 'Fitts: tiempo = a + b · log₂(D/W + 1)', PLOT.x, PLOT.y + PLOT.h + 140, { size: 12 });

      g.fillStyle = c.surface2;
      g.fillRect(ARENA.x, ARENA.y, ARENA.w, ARENA.h);
      g.strokeStyle = c.line;
      g.strokeRect(ARENA.x + 0.5, ARENA.y + 0.5, ARENA.w, ARENA.h);

      const t = s.target;
      g.strokeStyle = c.line;
      g.setLineDash([3, 5]);
      g.beginPath();
      g.moveTo(t.sx, t.sy);
      g.lineTo(t.x, t.y);
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = c.accent;
      g.beginPath();
      g.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = c.surface;
      g.beginPath();
      g.arc(t.x, t.y, Math.max(2, t.r * 0.3), 0, Math.PI * 2);
      g.fill();

      // Cursor virtual.
      g.strokeStyle = c.text;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(s.cur.x - 9, s.cur.y); g.lineTo(s.cur.x + 9, s.cur.y);
      g.moveTo(s.cur.x, s.cur.y - 9); g.lineTo(s.cur.x, s.cur.y + 9);
      g.stroke();

      if (!api.input.locked) {
        text(g, 'Clic aquí para capturar el mouse', ARENA.x + ARENA.w / 2, ARENA.y + 30, { align: 'center', size: 14, weight: 600, color: c.accent });
        text(g, '(sin captura, arrastrar también mueve el cursor, pero con la aceleración del sistema encima)', ARENA.x + ARENA.w / 2, ARENA.y + 50, { align: 'center', size: 11 });
      }

      const n = s.stats.length;
      if (n) {
        const mt = s.stats.reduce((a, b) => a + b.mt, 0) / n;
        const id = s.stats.reduce((a, b) => a + b.id, 0) / n;
        const ov = s.stats.reduce((a, b) => a + b.over, 0) / n;
        api.metric('mt', `${Math.round(mt * 1000)} ms`);
        api.metric('over', ov.toFixed(1));
        api.metric('tp', `${(id / mt).toFixed(2)} bits/s`);
      } else {
        api.metric('mt', '—');
        api.metric('over', '—');
        api.metric('tp', '—');
      }
      api.metric('miss', String(s.misses));
    },
  });
}

function newTarget(from, p, time) {
  const r = p.minR + Math.random() * Math.max(0, p.maxR - p.minR);
  let x;
  let y;
  let D;
  let tries = 0;
  do {
    const ang = Math.random() * Math.PI * 2;
    D = 120 + Math.random() * 330;
    x = from.x + Math.cos(ang) * D;
    y = from.y + Math.sin(ang) * D;
    tries++;
  } while ((x < ARENA.x + r + 6 || x > ARENA.x + ARENA.w - r - 6 || y < ARENA.y + r + 6 || y > ARENA.y + ARENA.h - r - 6) && tries < 60);
  return { x, y, r, D: Math.hypot(x - from.x, y - from.y), t0: time, sx: from.x, sy: from.y, minD: Infinity, approaching: false, overshoots: 0 };
}
