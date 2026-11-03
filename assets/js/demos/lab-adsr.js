// LAB · Envolvente ADSR: un cubo cuya velocidad sigue la envolvente al pulsar A/D.
// Cap. 7: ataque, decaimiento, sostenido y release como forma de "medir" la respuesta.

import { createDemo, text, roundRect } from '../core/demo.js';
import { ADSR, clamp } from '../core/curves.js';
import { audio } from '../core/audio.js';

const ED = { x: 40, y: 214, w: 520, h: 170 }; // editor de envolvente
const SPAN = 4.5; // segundos visibles en el editor
const YMAX = 1.6;
const HOLD = 0.4; // sostenido de ejemplo en el dibujo

export const ADSR_PRESETS = {
  jumpman: { label: 'Rígido (Jumpman)', attack: 0, decay: 0, peak: 1, sustain: 1, release: 0, shape: 1 },
  mario: { label: 'Suelto (Mario)', attack: 0.35, decay: 0, peak: 1, sustain: 1, release: 0.35, shape: 0.8 },
  thrust: { label: 'Empuje con inercia', attack: 1.2, decay: 0, peak: 1, sustain: 1, release: 1.4, shape: 1 },
  slow: { label: 'Sin respuesta', attack: 1.0, decay: 0, peak: 1, sustain: 1, release: 0.5, shape: 2.6 },
  quick: { label: 'Arranque rápido + ataque largo', attack: 1.2, decay: 0, peak: 1, sustain: 1, release: 0.5, shape: 0.35 },
  decay: { label: 'Decay (exploit)', attack: 0.08, decay: 0.45, peak: 1.5, sustain: 1, release: 0.15, shape: 1 },
  organ: { label: 'Órgano', attack: 0.01, decay: 0, peak: 1, sustain: 1, release: 0.02, shape: 1 },
  guitar: { label: 'Guitarra', attack: 0.02, decay: 0.6, peak: 1.2, sustain: 0.35, release: 0.9, shape: 1 },
};

export function mountADSR(mount, { id = 'LAB-C2', title = 'Envolvente ADSR: la forma de una respuesta', presets = Object.keys(ADSR_PRESETS), foot } = {}) {
  const modes = presets.map((k, i) => ({ key: String(i + 1), label: ADSR_PRESETS[k].label, values: ADSR_PRESETS[k] }));

  return createDemo({
    mount,
    id,
    title,
    width: 900,
    height: 420,
    hint: 'Clic aquí y mueve el cubo con A/D o ←/→',
    params: [
      { heading: 'Envolvente' },
      { key: 'attack', label: 'Ataque', min: 0, max: 1.5, step: 0.01, value: 0.35, unit: 's' },
      { key: 'decay', label: 'Decaimiento', min: 0, max: 1, step: 0.01, value: 0, unit: 's' },
      { key: 'peak', label: 'Pico', min: 0.1, max: 1.5, step: 0.01, value: 1, unit: '×' },
      { key: 'sustain', label: 'Sostenido', min: 0, max: 1.5, step: 0.01, value: 1, unit: '×' },
      { key: 'release', label: 'Release', min: 0, max: 1.5, step: 0.01, value: 0.35, unit: 's' },
      { key: 'shape', label: 'Curvatura', min: 0.2, max: 3, step: 0.05, value: 1, help: '<1: arranca rápido y llega lento. 1: rampa lineal. >1: arranca lento (menos respuesta inicial).' },
      { heading: 'Cuerpo' },
      { key: 'maxSpeed', label: 'Velocidad máx. (sostenido = 1×)', min: 50, max: 900, step: 10, value: 380, unit: 'px/s' },
      { key: 'sound', type: 'check', label: 'Clic al pulsar (feedback inmediato)', value: false },
    ],
    modes,
    graph: {
      window: 4,
      series: [
        { label: 'velocidad', color: 'accent', min: -1.6, max: 1.6 },
        { label: 'input (tecla)', color: 'accent2', step: true, width: 1.5 },
      ],
    },
    metrics: [
      { key: 'first', label: 'Primer movimiento visible' },
      { key: 'full', label: 'Hasta velocidad máx.' },
      { key: 'stop', label: 'Hasta detenerse' },
      { key: 'v', label: 'Velocidad actual' },
    ],
    foot: foot ?? `<p><strong>Prueba esto:</strong> arrastra los puntos de la envolvente (o usa los presets <kbd>1</kbd>–<kbd>${modes.length}</kbd>) y mueve el cubo.
      Fíjate en el <em>primer movimiento visible</em>: si tarda más de ~100 ms, la respuesta deja de sentirse instantánea aunque el ataque total sea corto.
      Con <em>Decay</em>, tamborilear la tecla es más rápido que mantenerla: el exploit de "skating" que describe el libro.</p>`,

    setup(api) {
      const p = api.params;
      return {
        L: new ADSR(p),
        R: new ADSR(p),
        x: api.w / 2,
        v: 0,
        drag: null,
        history: [],
        lastDir: 0,
      };
    },

    update(s, dt, api) {
      const { input: inp, params: p } = api;
      s.L.set(p);
      s.R.set(p);

      // Edición de la envolvente arrastrando los puntos.
      const pts = shapePoints(p);
      const m = inp.mouse;
      if (inp.mousePressed) {
        s.drag = null;
        pts.forEach((pt, i) => {
          if (Math.hypot(m.x - pt.sx, m.y - pt.sy) < 16) s.drag = i;
        });
      }
      if (!m.down) s.drag = null;
      if (s.drag != null) {
        const t = ((m.x - ED.x) / ED.w) * SPAN;
        const v = clamp(((ED.y + ED.h - m.y) / ED.h) * YMAX, 0, 1.5);
        const set = {};
        if (s.drag === 0) { set.attack = clamp(t, 0, 1.5); set.peak = Math.max(0.1, v); }
        if (s.drag === 1) { set.decay = clamp(t - p.attack, 0, 1); set.sustain = v; }
        if (s.drag === 2) { set.release = clamp(t - p.attack - p.decay - HOLD, 0, 1.5); }
        for (const [k, val] of Object.entries(set)) set[k] = Math.round(val * 100) / 100;
        api.paramsApi.setMany(set);
      }

      const left = inp.isDown('KeyA', 'ArrowLeft') || inp.pad.lx < -0.5;
      const right = inp.isDown('KeyD', 'ArrowRight') || inp.pad.lx > 0.5;
      if (inp.wasPressed('KeyA', 'ArrowLeft', 'KeyD', 'ArrowRight')) {
        api.graph.mark(api.time);
        if (p.sound) audio.click();
      }
      const l = s.L.update(dt, left);
      const r = s.R.update(dt, right);
      s.v = (r - l) * p.maxSpeed;
      s.x += s.v * dt;
      if (s.x > api.w + 30) s.x -= api.w + 60;
      if (s.x < -30) s.x += api.w + 60;

      s.history.push(s.x);
      if (s.history.length > 24) s.history.shift();
      api.graph.push(api.time, [r - l, (right ? 1 : 0) - (left ? 1 : 0)]);
    },

    render(g, s, api) {
      const c = api.colors;
      const p = api.params;

      // Carril del cubo.
      g.fillStyle = c.surface2;
      g.fillRect(0, 40, api.w, 120);
      for (let x = 0; x < api.w; x += 60) {
        g.fillStyle = c.grid;
        g.fillRect(x, 150, 30, 10);
      }
      // Estela: posiciones recientes.
      s.history.forEach((hx, i) => {
        g.globalAlpha = (i / s.history.length) * 0.25;
        g.fillStyle = c.accent;
        g.fillRect(hx - 22, 78, 44, 44);
      });
      g.globalAlpha = 1;
      g.fillStyle = c.accent;
      roundRect(g, s.x - 22, 78, 44, 44, 5);
      g.fill();
      text(g, `v = ${Math.round(s.v)} px/s`, 14, 28, { size: 12, mono: true });

      // Editor de envolvente.
      drawEnvelopeEditor(g, s, api);

      // Diagnóstico de la sensación.
      const lines = feelNotes(p);
      let ty = 232;
      text(g, 'Sensación probable', 590, 218, { size: 13, weight: 600, color: c.text });
      for (const ln of lines) {
        ty = wrap(g, ln, 590, ty + 4, 290, 17, c.muted);
      }

      const tFirst = timeToFraction(p, 0.1);
      api.metric('first', tFirst == null ? '—' : `${Math.round(tFirst * 1000)} ms`);
      api.metricColor('first', tFirst == null ? null : tFirst <= 0.1 ? 'good' : tFirst <= 0.2 ? 'warn' : 'bad');
      api.metric('full', `${Math.round((p.attack + p.decay) * 1000)} ms`);
      api.metric('stop', `${Math.round(p.release * 1000)} ms`);
      api.metric('v', `${Math.round(s.v)} px/s`);
    },
  });
}

function shapePoints(p) {
  const X = (t) => ED.x + (t / SPAN) * ED.w;
  const Y = (v) => ED.y + ED.h - (v / YMAX) * ED.h;
  const t1 = p.attack;
  const t2 = p.attack + p.decay;
  const t3 = t2 + HOLD;
  const t4 = t3 + p.release;
  return [
    { t: t1, v: p.peak, sx: X(t1), sy: Y(p.peak), label: 'A' },
    { t: t2, v: p.sustain, sx: X(t2), sy: Y(p.sustain), label: 'D/S' },
    { t: t4, v: 0, sx: X(t4), sy: Y(0), label: 'R' },
    { t: t3, v: p.sustain, sx: X(t3), sy: Y(p.sustain) },
  ];
}

function drawEnvelopeEditor(g, s, api) {
  const c = api.colors;
  const p = api.params;
  const X = (t) => ED.x + (t / SPAN) * ED.w;
  const Y = (v) => ED.y + ED.h - (v / YMAX) * ED.h;

  g.fillStyle = c.surface;
  g.fillRect(ED.x, ED.y, ED.w, ED.h);
  g.strokeStyle = c.grid;
  g.beginPath();
  for (let t = 0.5; t < SPAN; t += 0.5) { g.moveTo(X(t) + 0.5, ED.y); g.lineTo(X(t) + 0.5, ED.y + ED.h); }
  g.stroke();
  g.strokeStyle = c.line;
  g.strokeRect(ED.x + 0.5, ED.y + 0.5, ED.w, ED.h);
  // Nivel 1× = velocidad máxima nominal.
  g.setLineDash([4, 4]);
  g.beginPath();
  g.moveTo(ED.x, Y(1));
  g.lineTo(ED.x + ED.w, Y(1));
  g.stroke();
  g.setLineDash([]);
  // Ventana de 100 ms (respuesta instantánea).
  g.fillStyle = c.good;
  g.globalAlpha = 0.12;
  g.fillRect(X(0), ED.y, X(0.1) - X(0), ED.h);
  g.globalAlpha = 1;

  // Curva simulada con la misma clase ADSR que mueve el cubo.
  const env = new ADSR(p);
  const n = 220;
  const dt = SPAN / n;
  const releaseAt = p.attack + p.decay + HOLD;
  g.strokeStyle = c.accent;
  g.lineWidth = 2.5;
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const t = i * dt;
    const v = env.update(i === 0 ? 0 : dt, t < releaseAt);
    i ? g.lineTo(X(t), Y(v)) : g.moveTo(X(t), Y(v));
  }
  g.stroke();

  // Puntos arrastrables.
  const pts = shapePoints(p);
  pts.slice(0, 3).forEach((pt, i) => {
    g.fillStyle = s.drag === i ? c.accent : c.surface;
    g.strokeStyle = c.accent;
    g.lineWidth = 2;
    g.beginPath();
    g.arc(pt.sx, pt.sy, 7, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    // Etiquetas desplazadas para que no se pisen cuando A y D/S coinciden.
    const off = [[-14, -12, 'right'], [10, -12, 'left'], [10, -10, 'left']][i];
    text(g, pt.label, pt.sx + off[0], pt.sy + off[1], { size: 11, mono: true, color: c.accent, align: off[2] });
  });

  // Cursor en vivo: dónde está cada envolvente ahora mismo.
  for (const e of [s.L, s.R]) {
    if (e.phase === 'idle') continue;
    let t = 0;
    if (e.phase === 'attack') t = e.t;
    else if (e.phase === 'decay') t = p.attack + e.t;
    else if (e.phase === 'sustain') t = p.attack + p.decay + Math.min(e.t, HOLD);
    else if (e.phase === 'release') t = releaseAt + e.t;
    g.fillStyle = c.accent2;
    g.beginPath();
    g.arc(X(Math.min(t, SPAN)), Y(e.level), 6, 0, Math.PI * 2);
    g.fill();
  }

  text(g, 'nivel (× vel. máx.)', ED.x, ED.y - 8, { size: 11, mono: true });
  text(g, 'tiempo →  (franja verde = 100 ms)', ED.x + ED.w, ED.y + ED.h + 16, { size: 11, mono: true, align: 'right' });
  const phases = [['ataque', 0, p.attack], ['decay', p.attack, p.attack + p.decay], ['sostenido', p.attack + p.decay, releaseAt], ['release', releaseAt, releaseAt + p.release]];
  for (const [label, a, b] of phases) {
    if (X(b) - X(a) < 60) continue;
    text(g, label, (X(a) + X(b)) / 2, ED.y + ED.h - 6, { size: 10, mono: true, align: 'center' });
  }
}

// Tiempo (s) hasta que la envolvente alcanza `frac` del pico durante el ataque.
export function timeToFraction(p, frac) {
  if (p.peak <= 0) return null;
  if (p.attack <= 0) return 0;
  return p.attack * Math.pow(frac, 1 / p.shape);
}

export function feelNotes(p) {
  const notes = [];
  const tFirst = timeToFraction(p, 0.1) ?? 0;
  if (p.attack <= 0.03 && p.release <= 0.03) {
    notes.push('Rígida y precisa: responde y frena en seco, como un cursor. Ideal para posicionamiento exacto; poco orgánica.');
  } else if (tFirst > 0.1) {
    notes.push(`Sin respuesta inmediata: tarda ${Math.round(tFirst * 1000)} ms en moverse de forma visible (>100 ms). Se percibe como lag aunque no lo haya.`);
  } else if (p.attack > 0.6) {
    notes.push('Suelta y flotante pero responsiva: arranca enseguida y sigue ganando velocidad mucho tiempo, como un empuje con inercia.');
  } else if (p.attack > 0.1) {
    notes.push('Suelta y orgánica: una aceleración curva que se siente con masa pero sigue siendo ajustada.');
  } else {
    notes.push('Ajustada y responsiva: el ataque es breve.');
  }
  if (p.attack > 0 && p.attack <= 0.1 && p.shape <= 1.05 && p.shape >= 0.95) notes.push('Ataque muy corto y lineal: tiende a sentirse "nervioso" (twitchy).');
  if (p.release > 0.6 && p.release > p.attack * 1.5) notes.push('Release largo: patina al soltar, como sobre hielo. Difícil detenerse en un punto exacto.');
  else if (p.release <= 0.03 && p.attack > 0.1) notes.push('Sin release: arranca suave pero para en seco; la asimetría se nota.');
  else if (Math.abs(p.release - p.attack) < 0.08 && p.attack > 0.1) notes.push('Ataque y release espejados: la sensación suelta se mantiene al soltar.');
  if (p.decay > 0 && p.peak > p.sustain + 0.05) notes.push('Hay decay con pico mayor que el sostenido: pulsar repetidamente es más rápido que mantener. Cansa la mano y se vuelve exploit.');
  if (p.sustain < 0.5) notes.push('Sostenido bajo: la respuesta se apaga mientras mantienes la tecla, como una cuerda pulsada.');
  return notes;
}

function wrap(g, str, x, y, maxW, lh, color) {
  g.font = '500 12.5px Inter, system-ui, sans-serif';
  g.fillStyle = color;
  g.textAlign = 'left';
  g.textBaseline = 'top';
  const words = str.split(' ');
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (g.measureText(test).width > maxW && line) {
      g.fillText(line, x, y);
      y += lh;
      line = w;
    } else line = test;
  }
  if (line) { g.fillText(line, x, y); y += lh; }
  return y;
}
