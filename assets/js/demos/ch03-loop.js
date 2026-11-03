// EX03-1 · El modelo de interactividad (fig. 3.1) como un bucle animado con sus tiempos.
// Un pulso recorre: humano (percibir → decidir → actuar) → músculos → dispositivo → computadora → mundo → salida → sentidos.

import { createDemo, text, roundRect } from '../core/demo.js';
import { lagBand } from '../core/lag.js';
import { audio } from '../core/audio.js';

const CX = 450;
const CY = 185;
const RX = 330;
const RY = 140;

const NODES = [
  { k: 'human', label: 'Procesador humano', n: 1, ang: Math.PI, desc: 'Percibe (~100 ms), decide (~70 ms) y ordena a los músculos (~70 ms). Los tres procesadores trabajan a la vez, en cadena: mientras uno decide, el otro ya está percibiendo el siguiente instante.' },
  { k: 'muscles', label: 'Músculos', n: 2, ang: Math.PI * 0.72, desc: 'La mano ejecuta la orden y, de paso, informa por propiocepción dónde está cada dedo: el "megáfono para los pulgares" del cap. 1.' },
  { k: 'input', label: 'Dispositivo de input', n: 3, ang: Math.PI * 0.5, desc: 'El órgano de expresión del jugador. Toda intención pasa por su filtro: sus botones, ejes y resistencias facilitan unos movimientos y entorpecen otros. Además se lee cada tanto (sondeo).' },
  { k: 'computer', label: 'Computadora', n: 4, ang: Math.PI * 0.28, desc: 'Recibe el input, simula y decide la respuesta. Su mitad del ciclo tiene que caber dentro de un ciclo perceptivo del jugador para que la respuesta se lea como causa y efecto.' },
  { k: 'world', label: 'Mundo del juego', n: 5, ang: 0, desc: 'Existe sobre todo en la mente del jugador. El avatar es su cuerpo sustituto: a través de él se tantea y se aprende ese mundo.' },
  { k: 'output', label: 'Salida', n: 6, ang: -Math.PI * 0.4, desc: 'Monitor, parlantes, vibración: la ventana al mundo del juego. El monitor suma su propio retraso, de unos milisegundos a decenas en algunos televisores.' },
  { k: 'senses', label: 'Sentidos', n: 7, ang: -Math.PI * 0.68, desc: 'Ojos, oídos y manos toman el nuevo estado y lo pasan al procesador perceptivo. El ciclo se cierra en menos de medio segundo.' },
];
const pos = (n) => ({ x: CX + Math.cos(n.ang) * RX, y: CY + Math.sin(n.ang) * RY });

export function mountLoop(mount, { id = 'EX03-1' } = {}) {
  let selected = 0;
  const api = createDemo({
    mount,
    id,
    title: 'El bucle de interactividad, cronometrado',
    width: 900,
    height: 440,
    hint: 'Clic en una etapa para leerla · Espacio dispara un ciclo',
    params: [
      { key: 'slow', label: 'Cámara lenta', min: 0.05, max: 1, step: 0.05, value: 0.2, unit: '×', help: '1× es tiempo real: un ciclo dura menos de medio segundo.' },
      { heading: 'La mitad de la computadora' },
      { key: 'poll', label: 'Sondeo del input', min: 1, max: 50, step: 1, value: 8, unit: 'ms' },
      { key: 'comp', label: 'Simulación y render', min: 8, max: 300, step: 1, value: 50, unit: 'ms', help: '3 frames a 60 fps son 50 ms.' },
      { key: 'disp', label: 'Monitor', min: 2, max: 120, step: 1, value: 16, unit: 'ms' },
      { heading: 'La mitad humana' },
      { key: 'perc', label: 'Percepción', min: 50, max: 200, step: 5, value: 100, unit: 'ms' },
      { key: 'cog', label: 'Cognición', min: 30, max: 100, step: 5, value: 70, unit: 'ms' },
      { key: 'motor', label: 'Motor', min: 25, max: 170, step: 5, value: 70, unit: 'ms' },
    ],
    modes: [
      { key: '1', label: 'Un ciclo' },
      { key: '2', label: 'Continuo' },
    ],
    metrics: [
      { key: 'human', label: 'Mitad humana' },
      { key: 'comp', label: 'Mitad computadora' },
      { key: 'total', label: 'Ciclo completo' },
      { key: 'verdict', label: 'Respuesta' },
    ],
    foot: `<p><strong>Prueba esto:</strong> pulsa <kbd>Espacio</kbd> y sigue el pulso. Después sube "Simulación y render" a 200 ms:
      la mitad de la computadora pasa a ser tan larga como la del jugador y la respuesta deja de leerse como inmediata. En <kbd>2</kbd>
      sale un pulso nuevo en cada ciclo perceptivo, como pasa en realidad: el jugador no espera a ver el resultado para seguir percibiendo.
      Haz clic en cualquier etapa para leer qué pasa ahí.</p>`,

    setup() {
      return { pulses: [], emitIn: 0 };
    },
    update(s, dt, a) {
      const p = a.params;
      const segs = segments(p);
      const total = segs.reduce((x, y) => x + y.ms, 0);
      const sdt = dt * 1000 * p.slow;
      if (a.input.wasPressed('Space')) s.pulses.push({ t: 0 });
      if (a.input.mousePressed) {
        const m = a.input.mouse;
        const hit = NODES.findIndex((n) => { const q = pos(n); return Math.abs(m.x - q.x) < 80 && Math.abs(m.y - q.y) < 30; });
        if (hit >= 0) selected = hit;
      }
      if (a.mode === '2') {
        s.emitIn -= sdt;
        if (s.emitIn <= 0) { s.pulses.push({ t: 0 }); s.emitIn = p.perc; }
      }
      for (const q of s.pulses) {
        const before = segIndex(segs, q.t);
        q.t += sdt;
        const after = segIndex(segs, q.t);
        if (after !== before && a.mode === '1' && after >= 0) audio.tone({ freq: 500 + after * 60, dur: 0.03, type: 'sine', gain: 0.05 });
      }
      s.pulses = s.pulses.filter((q) => q.t < total);
    },
    render(g, s, a) {
      const c = a.colors;
      const p = a.params;
      const segs = segments(p);
      g.fillStyle = c.stage;
      g.fillRect(0, 0, a.w, a.h);

      // Óvalo del bucle, mitad humana (izquierda) y mitad computadora (derecha).
      g.lineWidth = 3;
      g.strokeStyle = c.line;
      g.beginPath();
      g.ellipse(CX, CY, RX, RY, 0, 0, Math.PI * 2);
      g.stroke();
      text(g, 'JUGADOR', CX - 150, CY + 6, { size: 12, weight: 700, color: c.muted, align: 'center' });
      text(g, 'COMPUTADORA', CX + 150, CY + 6, { size: 12, weight: 700, color: c.muted, align: 'center' });
      g.strokeStyle = c.grid;
      g.setLineDash([4, 6]);
      g.beginPath();
      g.moveTo(CX, CY - RY - 10);
      g.lineTo(CX, CY + RY + 10);
      g.stroke();
      g.setLineDash([]);

      // Pulsos.
      for (const q of s.pulses) {
        const { x, y } = pulsePos(segs, q.t);
        g.fillStyle = c.accent;
        g.beginPath();
        g.arc(x, y, 9, 0, Math.PI * 2);
        g.fill();
      }

      // Nodos.
      NODES.forEach((n, i) => {
        const q = pos(n);
        const w = n.k === 'human' ? 170 : 150;
        const active = s.pulses.some((pl) => segIndex(segs, pl.t) === i);
        roundRect(g, q.x - w / 2, q.y - 24, w, 48, 8);
        g.fillStyle = active ? c.accent : c.surface;
        g.fill();
        g.strokeStyle = i === selected ? c.accent2 : c.line;
        g.lineWidth = i === selected ? 2.5 : 1;
        g.stroke();
        text(g, `${n.n}. ${n.label}`, q.x, q.y - 4, { size: 12, weight: 700, align: 'center', color: active ? c.bg : c.text });
        text(g, `${Math.round(segs[i].ms)} ms`, q.x, q.y + 13, { size: 11, align: 'center', mono: true, color: active ? c.bg : c.muted });
        if (n.k === 'human') {
          // Las tres partes del procesador humano.
          const parts = [['P', p.perc, c.accent], ['C', p.cog, c.accent2], ['M', p.motor, c.accent3]];
          const tot = p.perc + p.cog + p.motor;
          let x0 = q.x - w / 2;
          for (const [lab, ms, col] of parts) {
            const ww = (ms / tot) * w;
            g.fillStyle = col;
            g.fillRect(x0, q.y + 26, ww, 8);
            text(g, `${lab} ${ms}`, x0 + ww / 2, q.y + 46, { size: 10, align: 'center', mono: true });
            x0 += ww;
          }
        }
      });

      // Descripción de la etapa elegida.
      const n = NODES[selected];
      g.fillStyle = c.surface;
      g.fillRect(0, a.h - 66, a.w, 66);
      text(g, `${n.n}. ${n.label}`, 16, a.h - 46, { size: 12, weight: 700, color: c.accent2 });
      wrap(g, n.desc, 16, a.h - 28, a.w - 32, 12, c.text);

      const human = p.perc + p.cog + p.motor;
      const comp = p.poll + p.comp + p.disp;
      const band = lagBand(comp);
      a.metric('human', `${human} ms`);
      a.metric('comp', `${comp} ms`);
      a.metric('total', `${Math.round(segs.reduce((x, y) => x + y.ms, 0))} ms`);
      a.metric('verdict', band.label);
      a.metricColor('verdict', band.color);
    },
  });
  return api;
}

function segments(p) {
  return [
    { ms: p.perc + p.cog + p.motor },
    { ms: 15 },
    { ms: p.poll },
    { ms: p.comp },
    { ms: 2 },
    { ms: p.disp },
    { ms: 5 },
  ];
}
function segIndex(segs, t) {
  let acc = 0;
  for (let i = 0; i < segs.length; i++) {
    acc += segs[i].ms;
    if (t < acc) return i;
  }
  return -1;
}
// El pulso viaja del nodo i al i+1 mientras dura la etapa i.
function pulsePos(segs, t) {
  let acc = 0;
  for (let i = 0; i < segs.length; i++) {
    if (t < acc + segs[i].ms) {
      const k = (t - acc) / segs[i].ms;
      const a0 = NODES[i].ang;
      let a1 = NODES[(i + 1) % NODES.length].ang;
      // Sentido antihorario en pantalla: humano (π) → músculos (0.72π) → … → sentidos (−0.68π) → humano (−π).
      if (a1 > a0) a1 -= Math.PI * 2;
      const ang = a0 + (a1 - a0) * k;
      return { x: CX + Math.cos(ang) * RX, y: CY + Math.sin(ang) * RY };
    }
    acc += segs[i].ms;
  }
  return pos(NODES[0]);
}

function wrap(g, str, x, y, maxW, size, color) {
  g.font = `400 ${size}px Inter, system-ui, sans-serif`;
  const words = str.split(' ');
  let line = '';
  const lines = [];
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (g.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
  }
  lines.push(line);
  g.fillStyle = color;
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  lines.slice(0, 2).forEach((l, i) => g.fillText(l, x, y + i * 17));
}
