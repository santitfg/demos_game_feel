// CH07-1 · Cubo ADSR: aceleración, drag y velocidad máxima definen la envolvente de la respuesta.
// CH07-2 · Sensibilidad del input × sensibilidad de la respuesta (cuatro combinaciones).
// EX07-1 · Estados: el mismo botón significa otra cosa en el suelo y en el aire.
// EX07-2 · Gestos: secuencias de input dentro de una ventana de tiempo.

import { createDemo, text, drawGrid, roundRect } from '../core/demo.js';
import { audio } from '../core/audio.js';

// ---------------- CH07-1 ----------------
export function mountAdsrCube(mount, { id = 'CH07-1' } = {}) {
  return createDemo({
    mount,
    id,
    title: 'Cubo ADSR: aceleración, drag y velocidad máxima',
    width: 900,
    height: 260,
    hint: 'Clic aquí · A y D (o ← →) para mover el cubo',
    params: [
      { key: 'accel', label: 'Aceleración', min: 0, max: 40000, step: 50, value: 1600, unit: 'px/s²' },
      { key: 'drag', label: 'Drag', min: 0, max: 60, step: 0.1, value: 3.5, unit: '/s', help: 'Cada paso se resta drag × velocidad. Con 0, el cubo no frena nunca.' },
      { key: 'max', label: 'Velocidad máxima (sustain)', min: 50, max: 1500, step: 10, value: 600, unit: 'px/s' },
    ],
    modes: [
      { key: '1', label: 'Poco responsivo', values: { accel: 300, drag: 0.8, max: 420 } },
      { key: '2', label: 'Responsivo y suelto', values: { accel: 1600, drag: 3.5, max: 600 } },
      { key: '3', label: 'Ajustado', values: { accel: 7000, drag: 14, max: 450 } },
      { key: '4', label: 'Nervioso', values: { accel: 40000, drag: 60, max: 450 } },
      { key: '5', label: 'Sin drag', values: { accel: 1600, drag: 0, max: 450 } },
    ],
    graph: {
      window: 4,
      series: [
        { label: 'velocidad', color: 'accent', min: -1, max: 1 },
        { label: 'input', color: 'muted', width: 1, step: true },
      ],
    },
    metrics: [
      { key: 'first', label: 'Primer movimiento visible' },
      { key: 'attack', label: 'Ataque (hasta el 90 %)' },
      { key: 'sustain', label: 'Sustain' },
      { key: 'release', label: 'Release (hasta el 10 %)' },
    ],
    foot: `<p><strong>Prueba esto:</strong> mueve el cubo a los lados y mira la curva. En <kbd>1</kbd> el cubo empieza a moverse casi sin que se
      note: tarda más de 100 ms en cambiar de forma visible y se siente poco responsivo. En <kbd>2</kbd> el arranque es inmediato, pero la
      velocidad sigue subiendo un buen rato: responsivo y suelto. <kbd>3</kbd> es ajustado y <kbd>4</kbd>, casi sin curva, se siente nervioso.
      Con <kbd>5</kbd> (drag en cero) el cubo no frena. También puedes escribir cualquier valor en las cajas del panel.</p>`,

    setup(api) {
      return { x: api.w / 2, v: 0, dir: 0, pressT: null, relT: null, peak: 0, first: null, attack: null, release: null, sustain: 0 };
    },
    update(s, dt, api) {
      const p = api.params;
      const inp = api.input;
      const dir = inp.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']) || (Math.abs(inp.pad.lx) > 0.3 ? Math.sign(inp.pad.lx) : 0);
      if (dir !== s.dir) {
        if (dir) { s.pressT = api.time; s.first = null; s.attack = null; api.graph.mark(api.time, 'pulsa'); } else { s.relT = api.time; s.release = null; s.peak = Math.abs(s.v); api.graph.mark(api.time, 'suelta'); }
        s.dir = dir;
      }
      if (dir) s.v += dir * p.accel * dt;
      s.v -= s.v * Math.min(1, p.drag * dt);
      s.v = Math.max(-p.max, Math.min(p.max, s.v));
      s.x += s.v * dt;
      if (s.x < 30) { s.x = 30; s.v = 0; }
      if (s.x > api.w - 30) { s.x = api.w - 30; s.v = 0; }
      // Medidas de la envolvente.
      const sp = Math.abs(s.v);
      if (dir) {
        const target = Math.min(p.max, p.drag > 0 ? p.accel / p.drag : p.max);
        if (s.first == null && sp > 30) s.first = api.time - s.pressT;
        if (s.attack == null && sp >= target * 0.9) s.attack = api.time - s.pressT;
        s.sustain = target;
      } else if (s.relT != null && s.release == null && s.peak > 30 && sp <= s.peak * 0.1) {
        s.release = api.time - s.relT;
      }
      api.graph.push(api.time, [s.v / Math.max(1, p.max), dir * 0.6]);
    },
    render(g, s, api) {
      const c = api.colors;
      g.fillStyle = c.stage;
      g.fillRect(0, 0, api.w, api.h);
      drawGrid(g, api.w, api.h, 40);
      roundRect(g, s.x - 26, api.h / 2 - 26, 52, 52, 6);
      g.fillStyle = c.accent;
      g.fill();
      const ms = (v) => (v == null ? '—' : `${Math.round(v * 1000)} ms`);
      api.metric('first', ms(s.first));
      api.metric('attack', ms(s.attack));
      api.metric('sustain', `${Math.round(s.sustain)} px/s`);
      api.metric('release', api.params.drag === 0 ? 'nunca' : ms(s.release));
      api.metricColor('first', s.first != null && s.first > 0.1 ? 'bad' : null);
    },
  });
}

// ---------------- CH07-2 ----------------
const SENS = [
  { key: '1', label: 'Input bajo · respuesta baja', note: 'Cuatro botones de dos estados, y la respuesta también tiene dos estados: quieto o a fondo. Rígido, como Pac-Man.' },
  { key: '2', label: 'Input bajo · respuesta alta', note: 'Los mismos cuatro botones agregan fuerzas: aceleración e inercia. Líneas curvas y orgánicas.' },
  { key: '3', label: 'Input alto · respuesta baja', note: 'El mouse es el cubo: un cursor grande. Natural y preciso, pero sin masa ni nada que dominar.' },
  { key: '4', label: 'Input alto · respuesta alta', note: 'El mouse tira del cubo con un resorte: hay que aprender a frenarlo. Expresivo, y pide maestría.' },
];

export function mountSensitivity(mount, { id = 'CH07-2' } = {}) {
  return createDemo({
    mount,
    id,
    title: 'Sensibilidad del input y de la respuesta',
    width: 900,
    height: 440,
    hint: 'Clic aquí · modos 1–2 con W A S D · modos 3–4 con el mouse',
    modes: SENS.map((m) => ({ key: m.key, label: m.label })),
    onModeChange(k, s) { if (s?.trail) { s.trail.length = 0; s.hits = 0; s.t0 = null; } },
    metrics: [
      { key: 'hits', label: 'Puntos rojos' },
      { key: 'rate', label: 'Por minuto' },
      { key: 'speed', label: 'Velocidad' },
    ],
    foot: `<p><strong>Prueba esto:</strong> en cada modo, toca los puntos rojos con el cubo y mira la estela. Las combinaciones <kbd>1</kbd> y
      <kbd>3</kbd> son fáciles y aburridas por razones opuestas: una no deja expresar casi nada y la otra no te hace aprender nada. En
      <kbd>4</kbd> el cubo se puede revolear, frenar y hacerle dar ochos: es la combinación con más para dominar.</p>`,

    setup(api) {
      return { x: api.w / 2, y: api.h / 2, vx: 0, vy: 0, last: null, trail: [], dot: newDot(api), hits: 0, t0: null };
    },
    update(s, dt, api) {
      const inp = api.input;
      const m = inp.mouse;
      const mode = api.mode;
      if (mode === '1') {
        // Cuatro direcciones, todo o nada: vale la última tecla apretada.
        for (const [code, d] of [['KeyW', [0, -1]], ['KeyS', [0, 1]], ['KeyA', [-1, 0]], ['KeyD', [1, 0]], ['ArrowUp', [0, -1]], ['ArrowDown', [0, 1]], ['ArrowLeft', [-1, 0]], ['ArrowRight', [1, 0]]]) {
          if (inp.wasPressed(code)) s.last = { code, d };
        }
        if (s.last && !inp.isDown(s.last.code)) s.last = null;
        const d = s.last ? s.last.d : [0, 0];
        s.vx = d[0] * 260;
        s.vy = d[1] * 260;
      } else if (mode === '2') {
        const ax = inp.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']);
        const ay = inp.axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']);
        s.vx += ax * 1100 * dt;
        s.vy += ay * 1100 * dt;
        s.vx *= Math.exp(-1.6 * dt);
        s.vy *= Math.exp(-1.6 * dt);
      } else if (mode === '3') {
        if (m.inside) { s.vx = (m.x - s.x) / dt; s.vy = (m.y - s.y) / dt; s.x = m.x; s.y = m.y; }
      } else if (m.inside) {
        // Resorte poco amortiguado hacia el mouse.
        s.vx += ((m.x - s.x) * 14 - s.vx * 1.4) * dt;
        s.vy += ((m.y - s.y) * 14 - s.vy * 1.4) * dt;
      }
      if (mode !== '3') {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
      }
      if (s.x < 20 || s.x > api.w - 20) { s.vx *= -0.5; s.x = Math.max(20, Math.min(api.w - 20, s.x)); }
      if (s.y < 20 || s.y > api.h - 20) { s.vy *= -0.5; s.y = Math.max(20, Math.min(api.h - 20, s.y)); }
      s.trail.push({ x: s.x, y: s.y });
      if (s.trail.length > 360) s.trail.shift();
      if (Math.hypot(s.x - s.dot.x, s.y - s.dot.y) < 30) {
        s.hits++;
        if (s.t0 == null) s.t0 = api.time;
        audio.blip(1000);
        s.dot = newDot(api);
      }
    },
    render(g, s, api) {
      const c = api.colors;
      const m = SENS.find((x) => x.key === api.mode) || SENS[0];
      g.fillStyle = c.stage;
      g.fillRect(0, 0, api.w, api.h);
      drawGrid(g, api.w, api.h, 40);
      g.strokeStyle = c.accent2;
      g.lineWidth = 2;
      g.beginPath();
      s.trail.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
      g.stroke();
      g.fillStyle = c.bad;
      g.beginPath();
      g.arc(s.dot.x, s.dot.y, 10, 0, Math.PI * 2);
      g.fill();
      roundRect(g, s.x - 16, s.y - 16, 32, 32, 4);
      g.fillStyle = c.accent;
      g.fill();
      text(g, m.note, 14, api.h - 14, { size: 12, color: c.text, weight: 600 });
      const mins = s.t0 != null ? (api.time - s.t0) / 60 : 0;
      api.metric('hits', String(s.hits));
      api.metric('rate', mins > 0.05 ? Math.round((s.hits - 1) / mins).toString() : '—');
      api.metric('speed', `${Math.round(Math.hypot(s.vx, s.vy))} px/s`);
    },
  });
}
const newDot = (api) => ({ x: 60 + Math.random() * (api.w - 120), y: 50 + Math.random() * (api.h - 120) });

// ---------------- EX07-1 ----------------
const GY = 300;

export function mountStates(mount, { id = 'EX07-1' } = {}) {
  return createDemo({
    mount,
    id,
    title: 'Estados: suelo y aire',
    width: 900,
    height: 380,
    hint: 'Clic aquí · A/D para moverte · Espacio para saltar (mantén para saltar más alto)',
    params: [
      { key: 'air', label: 'Control aéreo', min: 0, max: 1.5, step: 0.05, value: 0.45, unit: '×', help: 'Cuánto empujan A/D en el aire, comparado con el suelo.' },
      { key: 'hold', type: 'check', label: 'Altura variable (mantener el botón)', value: true },
    ],
    modes: [
      { key: '1', label: 'Aire reducido', values: { air: 0.45, hold: true } },
      { key: '2', label: 'Sin control aéreo', values: { air: 0, hold: false } },
      { key: '3', label: 'Aire = suelo', values: { air: 1, hold: true } },
      { key: '4', label: 'Arco predeterminado', values: { air: 0.45, hold: false } },
    ],
    metrics: [
      { key: 'state', label: 'Estado' },
      { key: 'meaning', label: 'A / D significa' },
      { key: 'jumps', label: 'Saltos' },
    ],
    foot: `<p><strong>Prueba esto:</strong> corre y salta un rato en cada modo, mirando la traza de posición. Con <kbd>1</kbd> los mismos botones
      empujan menos en el aire que en el suelo: dos respuestas para un solo input, y por eso hay más expresividad. <kbd>2</kbd> compromete cada
      salto como en los primeros plataformeros. <kbd>4</kbd> reproduce un arco fijo, una lista de posiciones predeterminadas en lugar de una
      simulación: se siente más nítido y menos maleable.</p>`,

    setup() {
      return { x: 120, y: GY, vx: 0, vy: 0, ground: true, jumps: 0, jt: 0, trace: [] };
    },
    update(s, dt, api) {
      const p = api.params;
      const inp = api.input;
      const ax = inp.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']) + (Math.abs(inp.pad.lx) > 0.25 ? inp.pad.lx : 0);
      const hold = inp.isDown('Space', 'KeyW', 'ArrowUp') || !!inp.pad.buttons[0];
      const k = s.ground ? 1 : p.air;
      s.vx += ax * 1800 * k * dt;
      s.vx *= Math.exp(-(s.ground ? (ax ? 1.5 : 8) : 0.4) * dt);
      s.vx = Math.max(-360, Math.min(360, s.vx));
      if ((inp.wasPressed('Space', 'KeyW', 'ArrowUp') || inp.padPressed.has(0)) && s.ground) {
        s.ground = false;
        s.jumps++;
        s.jt = 0;
        s.vy = -800;
        audio.tone({ freq: 380, dur: 0.1, type: 'triangle', gain: 0.15, slide: 1.8 });
      }
      if (!s.ground) {
        s.jt += dt;
        if (api.mode === '4') {
          // Arco fijo: posición vertical tomada de una tabla (parábola), sin importar nada más.
          const T = 0.66;
          const h = 160;
          const u = Math.min(1, s.jt / T);
          s.y = GY - 4 * h * u * (1 - u);
          if (u >= 1) { s.y = GY; s.ground = true; }
        } else {
          const g = p.hold && hold && s.vy < 0 ? 1300 : 2900;
          s.vy += g * dt;
          s.y += s.vy * dt;
          if (s.y >= GY) { s.y = GY; s.vy = 0; s.ground = true; audio.thud(0.2, 0.3); }
        }
      }
      s.x += s.vx * dt;
      if (s.x < 20) { s.x = 20; s.vx = 0; }
      if (s.x > api.w - 20) { s.x = api.w - 20; s.vx = 0; }
      s.trace.push({ x: s.x, y: s.y });
      if (s.trace.length > 600) s.trace.shift();
    },
    render(g, s, api) {
      const c = api.colors;
      g.fillStyle = c.stage;
      g.fillRect(0, 0, api.w, api.h);
      g.fillStyle = c.surface2;
      g.fillRect(0, GY, api.w, api.h - GY);
      g.strokeStyle = c.accent2;
      g.lineWidth = 1.5;
      g.beginPath();
      s.trace.forEach((p, i) => (i ? g.lineTo(p.x, p.y - 17) : g.moveTo(p.x, p.y - 17)));
      g.stroke();
      roundRect(g, s.x - 15, s.y - 34, 30, 34, 4);
      g.fillStyle = c.accent;
      g.fill();
      // Diagrama de estados.
      const box = (x, label, on) => {
        roundRect(g, x, 20, 90, 34, 8);
        g.fillStyle = on ? c.accent : c.surface;
        g.fill();
        g.strokeStyle = c.line;
        g.lineWidth = 1;
        g.stroke();
        text(g, label, x + 45, 42, { size: 13, weight: 700, align: 'center', color: on ? c.bg : c.text });
      };
      box(api.w - 230, 'Suelo', s.ground);
      box(api.w - 110, 'Aire', !s.ground);
      text(g, 'saltar →', api.w - 132, 16, { size: 10, align: 'center' });
      text(g, '← aterrizar', api.w - 132, 68, { size: 10, align: 'center' });
      const p = api.params;
      api.metric('state', s.ground ? 'suelo' : 'aire');
      api.metric('meaning', s.ground ? 'empujar a fondo' : p.air === 0 ? 'nada' : `empujar ×${p.air.toFixed(2)}`);
      api.metric('jumps', String(s.jumps));
    },
  });
}

// ---------------- EX07-2 ----------------
const MOVES = [
  { name: 'Proyectil', seq: ['↓', '↘', '→', 'J'], desc: '↓ ↘ → + J' },
  { name: 'Embestida', seq: ['→', '→'], desc: '→ →' },
  { name: 'Retroceso', seq: ['←', '←'], desc: '← ←' },
  { name: 'Uppercut', seq: ['→', '↓', '↘', 'J'], desc: '→ ↓ ↘ + J' },
];

export function mountGestures(mount, { id = 'EX07-2' } = {}) {
  return createDemo({
    mount,
    id,
    title: 'Gestos: secuencias de input',
    width: 900,
    height: 340,
    hint: 'Clic aquí · flechas (o WASD) y J',
    params: [
      { key: 'win', label: 'Ventana entre entradas', min: 60, max: 600, step: 10, value: 250, unit: 'ms', help: 'Tiempo máximo entre una entrada y la siguiente para que cuenten como gesto.' },
    ],
    metrics: [
      { key: 'last', label: 'Último gesto' },
      { key: 'count', label: 'Gestos reconocidos' },
      { key: 'gap', label: 'Mayor pausa del último gesto' },
    ],
    foot: `<p><strong>Prueba esto:</strong> haz ↓ ↘ → y J, como en un juego de pelea (↘ es ↓ y → a la vez), o toca dos veces → para embestir.
      La línea de tiempo muestra cada entrada. Con la ventana en 600 ms los gestos salen solos, incluso sin querer; con 80 ms hay que ser
      muy preciso. Un gesto convierte unos pocos botones en muchas acciones: es otra forma de subir la sensibilidad del input.</p>`,

    setup() {
      return { hist: [], held: new Set(), x: 200, vx: 0, fx: [], last: null, count: 0, gap: 0, flash: 0 };
    },
    update(s, dt, api) {
      const inp = api.input;
      const now = api.time;
      const d = inp.isDown('ArrowDown', 'KeyS');
      const r = inp.isDown('ArrowRight', 'KeyD');
      const l = inp.isDown('ArrowLeft', 'KeyA');
      const dir = d && r ? '↘' : d && l ? '↙' : d ? '↓' : r ? '→' : l ? '←' : null;
      if (dir && dir !== s.dir) s.hist.push({ k: dir, t: now });
      s.dir = dir;
      if (inp.wasPressed('KeyJ')) s.hist.push({ k: 'J', t: now });
      s.hist = s.hist.filter((h) => h.t > now - 3);
      // ¿El final del historial coincide con algún gesto, con pausas menores que la ventana?
      const win = api.params.win / 1000;
      for (const mv of [...MOVES].sort((a, b) => b.seq.length - a.seq.length)) {
        const n = mv.seq.length;
        const tail = s.hist.slice(-n);
        if (tail.length < n || tail.some((h, i) => h.k !== mv.seq[i]) || tail[n - 1].used) continue;
        const gaps = tail.slice(1).map((h, i) => h.t - tail[i].t);
        if (gaps.every((gp) => gp <= win) && now - tail[n - 1].t < 0.02) {
          tail.forEach((h) => { h.used = true; });
          s.last = mv.name;
          s.count++;
          s.gap = Math.max(0, ...gaps);
          s.flash = 1;
          if (mv.name === 'Proyectil') s.fx.push({ x: s.x + 30, v: 520 });
          if (mv.name === 'Embestida') s.vx = 900;
          if (mv.name === 'Retroceso') s.vx = -700;
          if (mv.name === 'Uppercut') s.up = 1;
          audio.tone({ freq: 660, dur: 0.12, type: 'square', gain: 0.08, slide: 1.5 });
          break;
        }
      }
      s.x += s.vx * dt;
      s.vx *= Math.exp(-6 * dt);
      s.x = Math.max(40, Math.min(api.w - 40, s.x));
      for (const f of s.fx) f.x += f.v * dt;
      s.fx = s.fx.filter((f) => f.x < api.w + 20);
      s.flash = Math.max(0, s.flash - dt * 2);
      s.up = Math.max(0, (s.up || 0) - dt * 3);
    },
    render(g, s, api) {
      const c = api.colors;
      const now = api.time;
      g.fillStyle = c.stage;
      g.fillRect(0, 0, api.w, api.h);
      // Escenario.
      const gy = 160;
      g.fillStyle = c.surface2;
      g.fillRect(0, gy, api.w, 8);
      const lift = Math.sin(Math.min(1, s.up || 0) * Math.PI) * 50;
      roundRect(g, s.x - 16, gy - 44 - lift, 32, 44, 5);
      g.fillStyle = c.accent;
      g.fill();
      for (const f of s.fx) {
        g.fillStyle = c.accent2;
        g.beginPath();
        g.arc(f.x, gy - 26, 10, 0, Math.PI * 2);
        g.fill();
      }
      if (s.last && s.flash > 0) text(g, s.last, s.x, gy - 60 - lift, { size: 15, weight: 700, align: 'center', color: c.accent2 });
      // Lista de gestos.
      MOVES.forEach((mv, i) => text(g, `${mv.name}: ${mv.desc}`, api.w - 20, 28 + i * 20, { size: 12, align: 'right', mono: true, color: mv.name === s.last && s.flash > 0 ? c.accent2 : c.muted }));
      // Línea de tiempo de los últimos 3 s.
      const ty = 230;
      g.strokeStyle = c.line;
      g.beginPath();
      g.moveTo(20, ty); g.lineTo(api.w - 20, ty);
      g.stroke();
      for (let k = 0; k <= 3; k++) text(g, `-${3 - k} s`, 20 + ((api.w - 40) * k) / 3, ty + 52, { size: 10, align: 'center', mono: true });
      for (const h of s.hist) {
        const x = 20 + ((h.t - (now - 3)) / 3) * (api.w - 40);
        roundRect(g, x - 13, ty - 13, 26, 26, 5);
        g.fillStyle = h.used ? c.accent2 : c.surface;
        g.fill();
        g.strokeStyle = c.line;
        g.stroke();
        text(g, h.k, x, ty + 5, { size: 13, align: 'center', weight: 700, color: h.used ? c.bg : c.text });
      }
      const winPx = ((api.params.win / 1000) / 3) * (api.w - 40);
      g.fillStyle = c.warn;
      g.globalAlpha = 0.25;
      g.fillRect(api.w - 20 - winPx, ty + 20, winPx, 6);
      g.globalAlpha = 1;
      text(g, 'ventana', api.w - 20 - winPx / 2, ty + 38, { size: 10, align: 'center', color: c.warn });

      api.metric('last', s.last || '—');
      api.metric('count', String(s.count));
      api.metric('gap', s.last ? `${Math.round(s.gap * 1000)} ms` : '—');
    },
  });
}
