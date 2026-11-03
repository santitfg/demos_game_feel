// LAB · Test ciego A/B: ¿cuál de los dos tiene más lag?
// Escalera adaptativa 2-abajo/1-arriba: converge a la diferencia que detectas ~71 % de las veces.

import { createDemo, text, drawGrid, roundRect } from '../core/demo.js';
import { audio } from '../core/audio.js';
import { Pipeline } from './shared/pipeline.js';

const ARENA = { x: 10, y: 10, w: 560, h: 440 };
const CHART = { x: 630, y: 210, w: 250, h: 190 };
const STEP = 1.4;
const MIN_DIFF = 5;
const MAX_DIFF = 400;

export function mountLagAB(mount, { id = 'LAB-L4' } = {}) {
  let pipe = null;
  let S = null;
  const actions = [];

  const api = createDemo({
    mount,
    id,
    title: 'Test ciego A/B: ¿cuál tiene más lag?',
    width: 900,
    height: 460,
    hint: 'Mueve el mouse · A y B para alternar · ← o → para responder',
    params: [
      { key: 'base', label: 'Latencia base (ambos)', min: 0, max: 200, step: 10, value: 0, unit: 'ms', help: '¿Es más fácil distinguir 0 de 50 ms que 200 de 250 ms?' },
      { key: 'start', label: 'Diferencia inicial', min: 40, max: 300, step: 10, value: 200, unit: 'ms' },
    ],
    metrics: [
      { key: 'trial', label: 'Ensayo' },
      { key: 'diff', label: 'Diferencia actual' },
      { key: 'acc', label: 'Aciertos' },
      { key: 'thr', label: 'Tu umbral estimado' },
    ],
    foot: `<p><strong>Cómo funciona:</strong> en cada ensayo, A o B (al azar) tiene más retraso que el otro. Alterna con <kbd>A</kbd> y <kbd>B</kbd>
      mientras mueves el mouse y responde con <kbd>←</kbd> (A tiene más lag) o <kbd>→</kbd> (B tiene más lag). Dos aciertos seguidos achican la
      diferencia y un error la agranda. Tras unas 8 inversiones, el promedio estima tu umbral. Repite el test con latencia base 0 y con 150 ms:
      ¿te cuesta más notar la diferencia cuando ya todo va tarde? <kbd>R</kbd> empieza de cero.</p>`,

    setup(a) {
      pipe ||= new Pipeline(a.input);
      S = {
        diff: a.params.start,
        streak: 0,
        dir: null,
        reversals: [],
        history: [],
        cur: 'A',
        tried: { A: true, B: false },
        slow: Math.random() < 0.5 ? 'A' : 'B',
        p: { x: ARENA.x + ARENA.w / 2, y: ARENA.y + ARENA.h / 2 },
        view: { x: ARENA.x + ARENA.w / 2, y: ARENA.y + ARENA.h / 2 },
        fb: null, // {ok, t}
      };
      return S;
    },

    update(s, dt, a) {
      const inp = a.input;
      if (inp.wasPressed('KeyA')) actions.push('A');
      if (inp.wasPressed('KeyB')) actions.push('B');
      if (inp.wasPressed('ArrowLeft')) actions.push('ansA');
      if (inp.wasPressed('ArrowRight')) actions.push('ansB');
      while (actions.length) act(s, actions.shift(), a);

      const lag = a.params.base + (s.cur === s.slow ? s.diff : 0);
      pipe.configure({ delay: lag });
      if (pipe.step()) {
        const L = pipe.input;
        if (L.mouse.inside || L.mouse.down) {
          s.p.x = Math.max(ARENA.x + 20, Math.min(ARENA.x + ARENA.w - 20, L.mouse.x));
          s.p.y = Math.max(ARENA.y + 20, Math.min(ARENA.y + ARENA.h - 20, L.mouse.y));
        }
      }
      pipe.endStep();
      if (s.fb && a.time - s.fb.t > 1.2) s.fb = null;
    },

    render(g, s, a) {
      const c = a.colors;
      if (pipe.present()) s.view = { ...s.p };

      g.fillStyle = c.stage;
      g.fillRect(ARENA.x, ARENA.y, ARENA.w, ARENA.h);
      g.save();
      g.beginPath();
      g.rect(ARENA.x, ARENA.y, ARENA.w, ARENA.h);
      g.clip();
      drawGrid(g, a.w, a.h, 40);
      g.restore();
      g.strokeStyle = c.line;
      g.strokeRect(ARENA.x + 0.5, ARENA.y + 0.5, ARENA.w, ARENA.h);

      text(g, s.cur, ARENA.x + 20, ARENA.y + 54, { size: 48, weight: 700, color: s.cur === 'A' ? c.accent : c.accent3 });
      text(g, `probaste: ${s.tried.A ? 'A ✓' : 'A ·'}  ${s.tried.B ? 'B ✓' : 'B ·'}`, ARENA.x + 20, ARENA.y + 78, { size: 12, mono: true });

      roundRect(g, s.view.x - 18, s.view.y - 18, 36, 36, 6);
      g.fillStyle = s.cur === 'A' ? c.accent : c.accent3;
      g.fill();

      if (s.fb) {
        const msg = s.fb.ok ? '¡Correcto!' : `No: era ${s.fb.slow}`;
        text(g, msg, ARENA.x + ARENA.w / 2, ARENA.y + 40, { align: 'center', size: 18, weight: 700, color: s.fb.ok ? c.good : c.bad });
        text(g, `diferencia de ese ensayo: ${Math.round(s.fb.diff)} ms`, ARENA.x + ARENA.w / 2, ARENA.y + 62, { align: 'center', size: 12 });
      }

      // Panel derecho: instrucciones y escalera.
      const px = CHART.x;
      text(g, 'Cada ensayo', px, 34, { size: 13, weight: 700, color: c.text });
      const lines = ['1. Mueve el mouse con A y con B', '2. Alterna con las teclas A / B', '3. ← si A tiene más lag', '    → si B tiene más lag'];
      lines.forEach((l, i) => text(g, l, px, 58 + i * 20, { size: 12 }));
      if (!(s.tried.A && s.tried.B)) text(g, 'Prueba los dos antes de responder.', px, 150, { size: 12, color: c.warn, weight: 600 });

      drawStaircase(g, c, s);
      const thr = threshold(s);
      const ok = s.history.filter((h) => h.ok).length;
      a.metric('trial', String(s.history.length + 1));
      a.metric('diff', `${Math.round(s.diff)} ms`);
      a.metric('acc', s.history.length ? `${ok} / ${s.history.length}` : '—');
      a.metric('thr', thr ? `${Math.round(thr)} ms${s.reversals.length < 8 ? ' (provisorio)' : ''}` : '—');
    },
  });

  // Botones para táctil (y para quien prefiera clics).
  const row = document.createElement('div');
  row.className = 'modes ab-buttons';
  row.style.cssText = 'margin: 0; padding: 8px 12px; justify-content: flex-start;';
  for (const [act, label] of [['A', 'Probar A'], ['B', 'Probar B'], ['ansA', 'A tiene más lag'], ['ansB', 'B tiene más lag']]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn';
    b.textContent = label;
    b.addEventListener('click', () => { actions.push(act); api.stage.focus({ preventScroll: true }); });
    row.append(b);
  }
  api.fig.querySelector('.metrics').before(row);
  return api;

  function act(s, what, a) {
    if (what === 'A' || what === 'B') {
      s.cur = what;
      s.tried[what] = true;
      audio.click();
      return;
    }
    if (!(s.tried.A && s.tried.B)) return;
    const answer = what === 'ansA' ? 'A' : 'B';
    const ok = answer === s.slow;
    s.history.push({ diff: s.diff, ok });
    s.fb = { ok, slow: s.slow, diff: s.diff, t: a.time };
    ok ? audio.blip(990) : audio.tone({ freq: 200, dur: 0.12, type: 'square', gain: 0.06 });
    let dir = null;
    if (ok) {
      s.streak++;
      if (s.streak >= 2) { s.streak = 0; s.diff = Math.max(MIN_DIFF, s.diff / STEP); dir = 'down'; }
    } else {
      s.streak = 0;
      s.diff = Math.min(MAX_DIFF, s.diff * STEP);
      dir = 'up';
    }
    if (dir) {
      if (s.dir && dir !== s.dir) s.reversals.push(s.history[s.history.length - 1].diff);
      s.dir = dir;
    }
    s.slow = Math.random() < 0.5 ? 'A' : 'B';
    s.cur = 'A';
    s.tried = { A: true, B: false };
  }
}

function threshold(s) {
  const r = s.reversals.slice(-6);
  if (r.length < 2) return null;
  return r.reduce((x, y) => x + y, 0) / r.length;
}

function drawStaircase(g, c, s) {
  const { x, y, w, h } = CHART;
  g.fillStyle = c.surface2;
  g.fillRect(x, y, w, h);
  g.strokeStyle = c.line;
  g.strokeRect(x + 0.5, y + 0.5, w, h);
  text(g, 'Diferencia por ensayo (ms)', x, y - 10, { size: 12, weight: 600, color: c.text });
  const yMax = 400;
  const Y = (v) => y + h - (Math.min(yMax, v) / yMax) * h;
  for (const t of [100, 200, 300]) {
    g.strokeStyle = c.grid;
    g.beginPath();
    g.moveTo(x, Math.round(Y(t)) + 0.5);
    g.lineTo(x + w, Math.round(Y(t)) + 0.5);
    g.stroke();
    text(g, String(t), x - 4, Y(t) + 3, { size: 10, align: 'right', mono: true });
  }
  const hist = s.history.slice(-30);
  const X = (i) => x + 10 + (i / 29) * (w - 20);
  g.strokeStyle = c.muted;
  g.lineWidth = 1;
  g.beginPath();
  hist.forEach((hh, i) => (i ? g.lineTo(X(i), Y(hh.diff)) : g.moveTo(X(i), Y(hh.diff))));
  g.stroke();
  hist.forEach((hh, i) => {
    g.fillStyle = hh.ok ? c.good : c.bad;
    g.beginPath();
    g.arc(X(i), Y(hh.diff), 4, 0, Math.PI * 2);
    g.fill();
  });
  const thr = threshold(s);
  if (thr) {
    g.strokeStyle = c.accent;
    g.setLineDash([5, 4]);
    g.beginPath();
    g.moveTo(x, Y(thr));
    g.lineTo(x + w, Y(thr));
    g.stroke();
    g.setLineDash([]);
    text(g, `umbral ≈ ${Math.round(thr)} ms`, x + w - 4, Y(thr) - 5, { size: 11, align: 'right', color: c.accent, weight: 600 });
  }
  g.fillStyle = c.good;
  g.beginPath(); g.arc(x + 4, y + h + 13, 3.5, 0, Math.PI * 2); g.fill();
  text(g, 'acierto', x + 12, y + h + 17, { size: 10 });
  g.fillStyle = c.bad;
  g.beginPath(); g.arc(x + 64, y + h + 13, 3.5, 0, Math.PI * 2); g.fill();
  text(g, 'error', x + 72, y + h + 17, { size: 10 });
}
