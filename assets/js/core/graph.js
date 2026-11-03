// Osciloscopio en vivo: dibuja series contra el tiempo en una ventana deslizante.
//
// const g = createGraph(canvas, {
//   window: 3,                       // segundos visibles
//   series: [{ label: 'velocidad', color: 'accent', min: -400, max: 400 }, …],
//   shared: true,                    // todas las series comparten el eje Y del primer elemento
// });
// g.push(t, [v1, v2]);  g.mark(t, 'salto');  g.draw();

import { colors } from './theme.js';

export function createGraph(canvas, { window: win = 3, series = [], shared = true, autoscale = false } = {}) {
  const ctx = canvas.getContext('2d');
  const samples = []; // {t, v: []}
  const marks = []; // {t, label}
  let dpr = 1;
  let w = 0;
  let h = 0;
  let paused = false;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    w = r.width;
    h = r.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  function range(i) {
    const s = shared ? series[0] : series[i];
    if (autoscale) {
      let lo = Infinity;
      let hi = -Infinity;
      for (const smp of samples) {
        for (let k = 0; k < series.length; k++) {
          if (!shared && k !== i) continue;
          const v = smp.v[k];
          if (v == null || Number.isNaN(v)) continue;
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
      }
      if (!Number.isFinite(lo)) return [s.min ?? -1, s.max ?? 1];
      lo = Math.min(lo, s.min ?? lo);
      hi = Math.max(hi, s.max ?? hi);
      const pad = (hi - lo) * 0.1 || 1;
      return [lo - pad, hi + pad];
    }
    return [s.min ?? -1, s.max ?? 1];
  }

  return {
    push(t, v) {
      if (paused) return;
      samples.push({ t, v });
      while (samples.length && samples[0].t < t - win - 0.5) samples.shift();
      while (marks.length && marks[0].t < t - win - 0.5) marks.shift();
    },
    mark(t, label = '') { if (!paused) marks.push({ t, label }); },
    clear() { samples.length = 0; marks.length = 0; },
    set paused(p) { paused = p; },
    get paused() { return paused; },
    setSeries(s) { series = s; },
    draw() {
      const c = colors();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (!samples.length) return;
      const tEnd = samples[samples.length - 1].t;
      const tStart = tEnd - win;
      const x = (t) => ((t - tStart) / win) * w;
      const padT = 18;
      const padB = 6;

      // Rejilla: una línea por segundo y el cero.
      ctx.strokeStyle = c.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let s = Math.ceil(tStart); s <= tEnd; s++) {
        ctx.moveTo(Math.round(x(s)) + 0.5, 0);
        ctx.lineTo(Math.round(x(s)) + 0.5, h);
      }
      ctx.stroke();
      const [lo0, hi0] = range(0);
      if (lo0 < 0 && hi0 > 0) {
        const y0 = padT + (1 - (0 - lo0) / (hi0 - lo0)) * (h - padT - padB);
        ctx.strokeStyle = c.line;
        ctx.beginPath();
        ctx.moveTo(0, Math.round(y0) + 0.5);
        ctx.lineTo(w, Math.round(y0) + 0.5);
        ctx.stroke();
      }

      // Marcas de eventos (pulsaciones, saltos…).
      ctx.font = '10px ' + getComputedStyle(document.body).getPropertyValue('--font-mono');
      for (const m of marks) {
        if (m.t < tStart) continue;
        ctx.strokeStyle = c.muted;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(Math.round(x(m.t)) + 0.5, padT);
        ctx.lineTo(Math.round(x(m.t)) + 0.5, h);
        ctx.stroke();
        ctx.setLineDash([]);
        if (m.label) {
          ctx.fillStyle = c.muted;
          ctx.fillText(m.label, x(m.t) + 3, padT + 10);
        }
      }

      // Series.
      series.forEach((s, i) => {
        const [lo, hi] = range(i);
        const y = (v) => padT + (1 - (v - lo) / (hi - lo)) * (h - padT - padB);
        ctx.strokeStyle = c[s.color] || s.color || c.accent;
        ctx.lineWidth = s.width || 2;
        if (s.dash) ctx.setLineDash(s.dash);
        ctx.beginPath();
        let started = false;
        let prevY = 0;
        for (const smp of samples) {
          const v = smp.v[i];
          if (v == null || Number.isNaN(v)) { started = false; continue; }
          const px = x(smp.t);
          const py = y(Math.max(lo, Math.min(hi, v)));
          if (s.step && started) ctx.lineTo(px, prevY); // escalón: horizontal y luego vertical
          started ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
          prevY = py;
          started = true;
        }
        ctx.stroke();
        ctx.setLineDash([]);
      });

      // Leyenda.
      let lx = 8;
      for (const s of series) {
        ctx.fillStyle = c[s.color] || s.color || c.accent;
        ctx.fillRect(lx, 6, 10, 3);
        lx += 14;
        ctx.fillStyle = c.muted;
        ctx.fillText(s.label, lx, 11);
        lx += ctx.measureText(s.label).width + 14;
      }
    },
  };
}
