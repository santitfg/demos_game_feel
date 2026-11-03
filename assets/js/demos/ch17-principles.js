// CH17-2 · Cuatro sensaciones de control sin contexto: espacio vacío, solo el movimiento.
// EX17-1 · Un interruptor por principio: el mismo mini-escenario con y sin el principio aplicado.

import { createDemo, text, roundRect } from '../core/demo.js';
import { audio } from '../core/audio.js';
import { burst, stepParticles, drawParticles } from './shared/physics2d.js';

const DIRS = [['KeyW', [0, -1]], ['KeyS', [0, 1]], ['KeyA', [-1, 0]], ['KeyD', [1, 0]], ['ArrowUp', [0, -1]], ['ArrowDown', [0, 1]], ['ArrowLeft', [-1, 0]], ['ArrowRight', [1, 0]]];
const axes = (inp) => [inp.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']), inp.axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown'])];
const clampIn = (b, api, m = 18) => {
  if (b.x < m || b.x > api.w - m) { b.vx *= -0.5; b.x = Math.max(m, Math.min(api.w - m, b.x)); }
  if (b.y < m || b.y > api.h - m) { b.vy *= -0.5; b.y = Math.max(m, Math.min(api.h - m, b.y)); }
};
function drawTrail(g, trail, color, width = 2) {
  for (let i = 1; i < trail.length; i++) {
    g.globalAlpha = i / trail.length;
    g.strokeStyle = color;
    g.lineWidth = width;
    g.beginPath();
    g.moveTo(trail[i - 1].x, trail[i - 1].y);
    g.lineTo(trail[i].x, trail[i].y);
    g.stroke();
  }
  g.globalAlpha = 1;
}
function square(g, x, y, size, color, rot = 0) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  roundRect(g, -size / 2, -size / 2, size, size, 4);
  g.fillStyle = color;
  g.fill();
  g.restore();
}

// ---------------- CH17-2 ----------------
const SENS = [
  { key: '1', label: 'Input bajo · reacción baja', note: 'Cuatro direcciones, velocidad fija: vale la última tecla.' },
  { key: '2', label: 'Input bajo · reacción alta', note: 'Teclas que empujan: aceleración, inercia y freno suave.' },
  { key: '3', label: 'Input alto · reacción baja', note: 'El cuadrado es el mouse: copia la posición, sin más.' },
  { key: '4', label: 'Input alto · reacción alta', note: 'El mouse tira de un resorte poco amortiguado.' },
];

export function mountSensations(mount, { id = 'CH17-2' } = {}) {
  return createDemo({
    mount,
    id,
    title: 'Cuatro sensaciones, sin contexto',
    width: 900,
    height: 440,
    hint: 'Clic aquí · modos 1–2 con W A S D · modos 3–4 con el mouse',
    modes: SENS.map((m) => ({ key: m.key, label: m.label })),
    onModeChange(k, s) { if (s?.trail) s.trail.length = 0; },
    metrics: SENS.map((m) => ({ key: 't' + m.key, label: `Tiempo en ${m.key}` })),
    foot: `<p><strong>Prueba esto:</strong> no hay nada que hacer, ningún objetivo ni obstáculo: solo mover. Juega un rato con cada modo y
      mira las métricas al final: el tiempo que pasaste en cada uno es una medida blanda de cuánto te atrae. El libro sostiene que
      <kbd>4</kbd> gana: su movimiento es más complejo, fluido y orgánico, y es divertido de por sí, aun en un espacio vacío.</p>`,

    setup(api) {
      return { x: api.w / 2, y: api.h / 2, vx: 0, vy: 0, last: null, trail: [], spent: { 1: 0, 2: 0, 3: 0, 4: 0 }, moved: 0 };
    },
    update(s, dt, api) {
      const inp = api.input;
      const m = inp.mouse;
      const mode = api.mode;
      const px = s.x;
      const py = s.y;
      if (mode === '1') {
        for (const [code, d] of DIRS) if (inp.wasPressed(code)) s.last = { code, d };
        if (s.last && !inp.isDown(s.last.code)) s.last = null;
        const d = s.last ? s.last.d : [0, 0];
        s.vx = d[0] * 260;
        s.vy = d[1] * 260;
      } else if (mode === '2') {
        const [ax, ay] = axes(inp);
        s.vx += ax * 1100 * dt;
        s.vy += ay * 1100 * dt;
        s.vx *= Math.exp(-1.6 * dt);
        s.vy *= Math.exp(-1.6 * dt);
      } else if (mode === '3') {
        if (m.inside) { s.vx = (m.x - s.x) / dt; s.vy = (m.y - s.y) / dt; s.x = m.x; s.y = m.y; }
      } else if (m.inside) {
        s.vx += ((m.x - s.x) * 14 - s.vx * 1.4) * dt;
        s.vy += ((m.y - s.y) * 14 - s.vy * 1.4) * dt;
      }
      if (mode !== '3') { s.x += s.vx * dt; s.y += s.vy * dt; }
      clampIn(s, api);
      // Solo cuenta el tiempo en que de verdad se está moviendo algo.
      if (Math.hypot(s.x - px, s.y - py) > 0.3) s.moved = 0.4;
      if (s.moved > 0) { s.moved -= dt; s.spent[mode] += dt; }
      s.trail.push({ x: s.x, y: s.y });
      if (s.trail.length > 240) s.trail.shift();
    },
    render(g, s, api) {
      const c = api.colors;
      g.fillStyle = c.stage;
      g.fillRect(0, 0, api.w, api.h);
      drawTrail(g, s.trail, c.accent2, 3);
      const sp = Math.hypot(s.vx, s.vy);
      // Un poco de estiramiento según la velocidad, igual en los cuatro modos.
      g.save();
      g.translate(s.x, s.y);
      g.rotate(Math.atan2(s.vy, s.vx));
      const st = Math.min(0.35, sp / 2400);
      g.scale(1 + st, 1 - st);
      roundRect(g, -16, -16, 32, 32, 5);
      g.fillStyle = c.accent;
      g.fill();
      g.restore();
      const m = SENS.find((x) => x.key === api.mode) || SENS[0];
      text(g, m.note, 14, api.h - 14, { size: 12, color: c.muted });
      for (const k of ['1', '2', '3', '4']) api.metric('t' + k, `${s.spent[k].toFixed(1)} s`);
    },
  });
}

// ---------------- EX17-1 ----------------
const PRINCIPLES = [
  { key: '1', label: 'Predecible', off: 'J y K casi a la vez: el resultado depende de qué llegó primero, por milisegundos.', on: 'J y K dentro de 80 ms son un acorde: siempre "salto largo".' },
  { key: '2', label: 'Instantáneo', off: 'El vehículo espera y luego acelera el giro de a poco.', on: 'Gira ya, más rápido cuanto mayor es la diferencia; el final es largo y suave.' },
  { key: '3', label: 'Fácil pero profundo', off: 'Toca los cinco puntos en orden. Nadie mide nada.', on: 'Toca los cinco puntos en orden: reloj, mejor tiempo y fantasma de tu mejor vuelta.' },
  { key: '4', label: 'Novedad', off: 'Cada golpe es la misma animación enlatada.', on: 'Cada golpe varía: ángulo, fuerza, sonido y una bolsa simulada que nunca se mueve igual.' },
  { key: '5', label: 'Orgánico', off: 'Se fija la posición cada frame: líneas rectas y esquinas.', on: 'Se aplican fuerzas a una velocidad: curvas y arcos.' },
  { key: '6', label: 'Armonía', off: 'Contra la pared, el personaje sigue "corriendo" en el lugar.', on: 'Contra la pared, se apoya: se detiene, levanta polvo y suena el golpe.' },
];
const MOVES = { salto: { dx: 0, h: 110, dur: 0.6, spin: 0 }, 'salto + golpe al suelo': { dx: 0, h: 110, dur: 0.75, spin: 0, slam: true }, 'mortal hacia atrás': { dx: -110, h: 140, dur: 0.8, spin: -Math.PI * 2 }, 'salto largo': { dx: 260, h: 60, dur: 0.7, spin: 0 }, golpe: { dx: 0, h: 0, dur: 0.25, spin: 0, punch: true } };
const CHECKS = [[150, 110], [740, 120], [620, 330], [250, 340], [450, 220]];

export function mountPrinciples(mount, { id = 'EX17-1' } = {}) {
  const scenes = {
    // 1 · Ambigüedad de control (el ejemplo de Mick West con dos botones).
    1: {
      init: () => ({ x: 300, y: 330, move: null, mt: 0, pending: null, log: [] }),
      update(s, dt, api, on) {
        const inp = api.input;
        const t = api.time;
        const J = inp.wasPressed('KeyJ', 'Space');
        const K = inp.wasPressed('KeyK');
        const start = (name, gap) => {
          s.move = name;
          s.mt = 0;
          s.ox = s.x;
          s.log.unshift({ name, gap });
          if (s.log.length > 8) s.log.pop();
          audio.blip({ salto: 520, 'salto + golpe al suelo': 300, 'mortal hacia atrás': 700, 'salto largo': 880, golpe: 200 }[name]);
        };
        for (const [btn, pressed] of [['J', J], ['K', K]]) {
          if (!pressed) continue;
          const p = s.pending;
          if (p && p.btn !== btn && t - p.t < (on ? 0.08 : 0.12)) {
            const gap = Math.round((t - p.t) * 1000);
            // Sin el principio, el orden decide; con él, el par es un acorde con resultado fijo.
            const name = on ? 'salto largo' : p.btn === 'J' ? 'salto + golpe al suelo' : 'mortal hacia atrás';
            s.pending = null;
            start(name, gap);
          } else {
            s.pending = { btn, t };
            start(btn === 'J' ? 'salto' : 'golpe', null);
          }
        }
        if (s.pending && t - s.pending.t > 0.12) s.pending = null;
        if (s.move) {
          s.mt += dt;
          const m = MOVES[s.move];
          const k = Math.min(1, s.mt / m.dur);
          s.x = s.ox + m.dx * k;
          if (k >= 1) { s.move = null; if (s.x > 760 || s.x < 120) s.x = 300; }
        }
      },
      render(g, s, api) {
        const c = api.colors;
        g.fillStyle = c.line;
        g.fillRect(0, 346, api.w, 4);
        let y = s.y;
        let rot = 0;
        if (s.move) {
          const m = MOVES[s.move];
          const k = Math.min(1, s.mt / m.dur);
          y = s.y - (m.slam ? (k < 0.55 ? Math.sin((k / 0.55) * Math.PI * 0.5) * m.h : m.h * (1 - (k - 0.55) / 0.45)) : Math.sin(k * Math.PI) * m.h);
          rot = m.spin * k;
          if (m.punch) { g.fillStyle = c.accent2; g.fillRect(s.x + 16, y - 6, 30 * Math.sin(k * Math.PI), 12); }
        }
        square(g, s.x, y, 32, c.accent, rot);
        text(g, 'Últimas acciones (ms entre J y K):', 560, 40, { size: 12, color: c.text, weight: 600 });
        s.log.forEach((e, i) => text(g, `${e.name}${e.gap != null ? `  · ${e.gap} ms` : ''}`, 560, 64 + i * 20, { size: 12, mono: true, color: e.gap != null ? c.text : c.muted }));
        const chords = s.log.filter((e) => e.gap != null);
        if (chords.length) {
          const counts = {};
          chords.forEach((e) => { counts[e.name] = (counts[e.name] || 0) + 1; });
          api.metric('a', `${Math.round((Math.max(...Object.values(counts)) / chords.length) * 100)} % iguales`);
        } else api.metric('a', '—');
        api.metric('b', s.log[0]?.name || '—');
      },
    },
    // 2 · Respuesta instantánea (el vehículo de Halo que el libro analiza: giro suelto pero inmediato).
    2: {
      init: (api) => ({ x: api.w / 2, y: api.h / 2, h: 0, w: 0, trail: [], lastWant: 0, t0: null, h0: 0, lat: null, delayQ: [] }),
      update(s, dt, api, on) {
        const m = api.input.mouse;
        const want = m.inside ? Math.atan2(m.y - s.y, m.x - s.x) : s.h;
        let diff = Math.atan2(Math.sin(want - s.h), Math.cos(want - s.h));
        // Detecta un cambio grande de dirección pedida y mide cuánto tarda el giro visible.
        if (Math.abs(Math.atan2(Math.sin(want - s.lastWant), Math.cos(want - s.lastWant))) > 0.6 && s.t0 == null && Math.abs(diff) > 0.6) { s.t0 = api.time; s.h0 = s.h; s.dir0 = Math.sign(diff); }
        s.lastWant = want;
        if (on) {
          s.w = diff * 5; // proporcional: lo más grande pasa primero
        } else {
          s.delayQ.push({ t: api.time, diff });
          while (s.delayQ.length && api.time - s.delayQ[0].t > 0.18) s.delayQ.shift();
          diff = s.delayQ[0]?.diff ?? 0;
          const target = Math.sign(diff) * Math.min(3, Math.abs(diff) * 5);
          s.w += (target - s.w) * (1 - Math.exp(-2.5 * dt)); // ataque lento
        }
        s.h += s.w * dt;
        if (s.t0 != null && Math.atan2(Math.sin(s.h - s.h0), Math.cos(s.h - s.h0)) * s.dir0 > 0.1) { s.lat = (api.time - s.t0) * 1000; s.t0 = null; }
        if (s.t0 != null && api.time - s.t0 > 1.5) s.t0 = null;
        s.x += Math.cos(s.h) * 150 * dt;
        s.y += Math.sin(s.h) * 150 * dt;
        if (s.x < 0) s.x += api.w; if (s.x > api.w) s.x -= api.w;
        if (s.y < 0) s.y += api.h; if (s.y > api.h) s.y -= api.h;
        const last = s.trail[s.trail.length - 1];
        if (last && Math.hypot(last.x - s.x, last.y - s.y) > 100) s.trail.length = 0; // dio la vuelta por el borde
        s.trail.push({ x: s.x, y: s.y });
        if (s.trail.length > 200) s.trail.shift();
      },
      render(g, s, api) {
        const c = api.colors;
        drawTrail(g, s.trail, c.accent2, 3);
        g.save();
        g.translate(s.x, s.y);
        g.rotate(s.h);
        roundRect(g, -20, -12, 40, 24, 5);
        g.fillStyle = c.accent;
        g.fill();
        g.fillStyle = c.text;
        g.fillRect(10, -4, 8, 8);
        g.restore();
        const m = api.input.mouse;
        if (m.inside) { g.strokeStyle = c.muted; g.beginPath(); g.arc(m.x, m.y, 8, 0, Math.PI * 2); g.stroke(); }
        api.metric('a', s.lat == null ? '—' : s.lat < 10 ? '< 10 ms' : `${Math.round(s.lat)} ms`);
        api.metric('b', `${Math.round(Math.abs(s.w) * 57.3)} °/s`);
      },
    },
    // 3 · Fácil pero profundo: el mismo control, con una regla que mide.
    3: {
      init: (api) => ({ x: 80, y: api.h - 60, vx: 0, vy: 0, next: 0, t: 0, run: [], best: null, bestRun: null, started: false, done: false }),
      update(s, dt, api, on) {
        const [ax, ay] = axes(api.input);
        if ((ax || ay) && !s.started && !s.done) { s.started = true; s.t = 0; s.run = []; }
        if (s.done && (ax || ay) && api.time - s.doneT > 0.8) { Object.assign(s, { next: 0, done: false, started: true, t: 0, run: [] }); }
        s.vx += ax * 1100 * dt;
        s.vy += ay * 1100 * dt;
        s.vx *= Math.exp(-1.6 * dt);
        s.vy *= Math.exp(-1.6 * dt);
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        clampIn(s, api);
        if (!s.started || s.done) return;
        s.t += dt;
        s.run.push([s.x, s.y]);
        const [cx, cy] = CHECKS[s.next];
        if (Math.hypot(s.x - cx, s.y - cy) < 30) {
          s.next++;
          audio.blip(500 + s.next * 120);
          if (s.next === CHECKS.length) {
            s.done = true;
            s.doneT = api.time;
            if (s.best == null || s.t < s.best) { s.best = s.t; s.bestRun = s.run; }
          }
        }
      },
      render(g, s, api, on) {
        const c = api.colors;
        CHECKS.forEach(([x, y], i) => {
          g.beginPath();
          g.arc(x, y, 22, 0, Math.PI * 2);
          g.fillStyle = i < s.next ? c.good : i === s.next ? c.accent2 : c.line;
          g.fill();
          text(g, String(i + 1), x, y + 1, { align: 'center', baseline: 'middle', color: c.bg, weight: 700, size: 14 });
        });
        if (on && s.bestRun && s.started && !s.done) {
          const i = Math.min(s.bestRun.length - 1, s.run.length);
          g.globalAlpha = 0.35;
          square(g, s.bestRun[i][0], s.bestRun[i][1], 30, c.muted);
          g.globalAlpha = 1;
        }
        square(g, s.x, s.y, 30, c.accent);
        if (on) {
          text(g, s.started ? `${s.t.toFixed(2)} s` : 'muévete para empezar', api.w - 16, 30, { align: 'right', size: 18, mono: true, color: c.text, weight: 700 });
          if (s.best != null) text(g, `mejor: ${s.best.toFixed(2)} s`, api.w - 16, 54, { align: 'right', size: 13, mono: true });
        } else if (s.done) text(g, '¡Listo!', api.w - 16, 30, { align: 'right', size: 18, color: c.text, weight: 700 });
        api.metric('a', on ? (s.best != null ? `${s.best.toFixed(2)} s` : '—') : 'sin medir');
        api.metric('b', `${s.next} / ${CHECKS.length}`);
      },
    },
    // 4 · Novedad: el golpe enlatado frente al golpe que nunca sale igual.
    4: {
      init: () => ({ punch: -1, var: null, a: 0, w: 0, parts: [], count: 0, lastT: -9 }),
      update(s, dt, api, on) {
        if (api.input.wasPressed('KeyJ', 'KeyK', 'Space') && api.time - s.punch > 0.18) {
          s.count++;
          s.punch = api.time;
          const rest = Math.min(1, (api.time - s.lastT) / 1.2);
          s.lastT = api.time;
          s.var = on ? { ang: (Math.random() - 0.5) * 0.5, pow: 0.6 + rest * 0.5 + Math.random() * 0.2, pitch: 0.85 + Math.random() * 0.3 } : { ang: 0, pow: 1, pitch: 1 };
          audio.thud(0.6, 0.8);
          audio.tone({ freq: 140 * s.var.pitch, dur: 0.1, gain: 0.3, slide: 0.6 });
          if (on) { s.w += 1.5 * s.var.pow * Math.cos(s.var.ang) + (Math.random() - 0.5) * 0.4; }
          burst(s.parts, 545, 296 + s.var.ang * 80, { n: on ? 8 + Math.floor(Math.random() * 8) : 10, speed: on ? 180 + Math.random() * 160 : 260, life: 0.4, color: 'accent2', spread: on ? 1.2 + Math.random() : 1.4, dir: Math.PI });
        }
        if (on) {
          // Bolsa como péndulo simulado: cada golpe se suma a lo que ya venía.
          s.w += (-9 * Math.sin(s.a) - 1.1 * s.w) * dt;
          s.w = Math.max(-4, Math.min(4, s.w));
          s.a += s.w * dt;
        } else {
          const k = (api.time - s.punch) / 0.9;
          s.a = k >= 0 && k < 1 ? Math.sin(k * Math.PI * 2) * 0.45 * (1 - k) : 0;
        }
        stepParticles(s.parts, dt);
      },
      render(g, s, api, on) {
        const c = api.colors;
        const px = 560;
        const py = 40;
        const L = 170;
        const bx = px + Math.sin(s.a) * L;
        const by = py + Math.cos(s.a) * L;
        g.strokeStyle = c.muted;
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(px, py);
        g.lineTo(bx, by);
        g.stroke();
        g.save();
        g.translate(bx, by);
        g.rotate(-s.a);
        roundRect(g, -26, -10, 52, 110, 14);
        g.fillStyle = c.bad;
        g.fill();
        g.restore();
        const k = (api.time - s.punch) / 0.22;
        const v = s.var || { ang: 0, pow: 1 };
        const ext = k >= 0 && k < 1 ? Math.sin(k * Math.PI) : 0;
        square(g, 380, 306, 44, c.accent);
        g.save();
        g.translate(400, 296);
        g.rotate(v.ang);
        g.fillStyle = c.accent;
        roundRect(g, 0, -8, 30 + ext * 110 * v.pow, 16, 6);
        g.fill();
        g.restore();
        g.fillStyle = c.line;
        g.fillRect(0, 330, api.w, 4);
        drawParticles(g, s.parts, c);
        api.metric('a', String(s.count));
        api.metric('b', on ? 'cada golpe distinto' : 'siempre igual');
      },
    },
    // 5 · Movimiento orgánico: fijar posición frente a aplicar fuerzas.
    5: {
      init: (api) => ({ x: api.w / 2, y: api.h / 2, vx: 0, vy: 0, trail: [] }),
      update(s, dt, api, on) {
        const [ax, ay] = axes(api.input);
        const n = Math.hypot(ax, ay) || 1;
        if (on) {
          s.vx += (ax / n) * 1500 * dt;
          s.vy += (ay / n) * 1500 * dt;
          s.vx *= Math.exp(-3 * dt);
          s.vy *= Math.exp(-3 * dt);
        } else {
          s.vx = (ax / n) * 280;
          s.vy = (ay / n) * 280;
        }
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        clampIn(s, api);
        s.trail.push({ x: s.x, y: s.y });
        if (s.trail.length > 300) s.trail.shift();
      },
      render(g, s, api) {
        const c = api.colors;
        drawTrail(g, s.trail, c.accent2, 3);
        square(g, s.x, s.y, 30, c.accent);
        api.metric('a', `${Math.round(Math.hypot(s.vx, s.vy))} px/s`);
        api.metric('b', '—');
      },
    },
    // 6 · Armonía: correr contra una pared.
    6: {
      init: () => ({ x: 200, vx: 0, phase: 0, pressed: 0, parts: [], face: 1, hitT: -9 }),
      update(s, dt, api, on) {
        const ax = api.input.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']);
        if (ax) s.face = ax;
        s.vx = ax * 240;
        const wallL = 120;
        const wallR = 720;
        const before = s.x;
        s.x = Math.max(wallL + 14, Math.min(wallR - 14, s.x + s.vx * dt));
        const blocked = ax !== 0 && Math.abs(s.x - before) < 0.01;
        if (blocked && s.pressed === 0 && on) {
          audio.thud(0.5, 0.6);
          burst(s.parts, s.x + s.face * 14, 330, { n: 8, speed: 120, life: 0.35, color: 'muted', spread: 1.4, dir: -Math.PI / 2 - s.face * 0.8, gravity: 300 });
        }
        s.pressed = blocked ? s.pressed + dt : 0;
        // Sin el principio, la animación de carrera depende solo del input; con él, del movimiento real.
        const running = on ? Math.abs(s.x - before) > 0.01 : ax !== 0;
        if (running) {
          const prev = s.phase;
          s.phase += dt * 12;
          if (Math.floor(prev / Math.PI) !== Math.floor(s.phase / Math.PI)) audio.tone({ freq: 180, dur: 0.04, gain: 0.08, type: 'triangle' });
        } else s.phase = 0;
        stepParticles(s.parts, dt);
      },
      render(g, s, api, on) {
        const c = api.colors;
        g.fillStyle = c.line;
        g.fillRect(0, 346, api.w, 4);
        g.fillStyle = c.muted;
        g.fillRect(100, 150, 20, 196);
        g.fillRect(720, 150, 20, 196);
        const lean = on && s.pressed > 0 ? s.face * 0.25 : 0;
        g.save();
        g.translate(s.x, 346);
        g.rotate(lean);
        // Piernas
        g.strokeStyle = c.text;
        g.lineWidth = 4;
        const sw = Math.sin(s.phase) * 12;
        g.beginPath();
        g.moveTo(-4, -26); g.lineTo(-4 + sw, 0);
        g.moveTo(4, -26); g.lineTo(4 - sw, 0);
        g.stroke();
        roundRect(g, -12, -70, 24, 46, 6);
        g.fillStyle = c.accent;
        g.fill();
        g.beginPath();
        g.arc(0, -82, 11, 0, Math.PI * 2);
        g.fill();
        if (on && s.pressed > 0) { g.strokeStyle = c.text; g.beginPath(); g.moveTo(0, -60); g.lineTo(s.face * 20, -66); g.stroke(); }
        g.restore();
        drawParticles(g, s.parts, c);
        api.metric('a', s.pressed > 0 ? 'contra la pared' : s.vx ? 'corriendo' : 'quieto');
        api.metric('b', `${s.pressed.toFixed(1)} s`);
      },
    },
  };
  const LABELS = {
    1: ['Consistencia del acorde', 'Última acción'],
    2: ['Primer giro visible', 'Velocidad de giro'],
    3: ['Mejor tiempo', 'Puntos'],
    4: ['Golpes', 'Variación'],
    5: ['Velocidad', '—'],
    6: ['Estado', 'Tiempo contra la pared'],
  };

  return createDemo({
    mount,
    id,
    title: 'Un interruptor por principio',
    width: 900,
    height: 440,
    hint: 'Clic aquí · P activa o quita el principio',
    modes: PRINCIPLES.map((p) => ({ key: p.key, label: p.label })),
    params: [
      { key: 'on', type: 'check', label: 'Aplicar el principio (P)', value: false },
    ],
    panelWidth: 220,
    onModeChange(k, s, api) {
      if (!s) return;
      s.sc = scenes[k].init(api);
      api.fig.querySelectorAll('.metric .k').forEach((el, i) => { if (i < 2) el.textContent = LABELS[k][i]; });
    },
    metrics: [
      { key: 'a', label: '—' },
      { key: 'b', label: '—' },
      { key: 'on', label: 'Principio' },
    ],
    foot: `<p><strong>Prueba esto:</strong> en cada modo juega primero con el principio desactivado y después pulsa <kbd>P</kbd>.
      <kbd>1</kbd>: pulsa <kbd>J</kbd> y <kbd>K</kbd> a la vez diez veces y mira la consistencia. <kbd>2</kbd>: mueve el mouse de golpe al otro
      lado del vehículo y mira cuánto tarda en notarse el giro. <kbd>3</kbd>: con reloj y fantasma, la misma tarea pide otra vuelta, y otra.
      <kbd>4</kbd>: golpea muchas veces seguidas. <kbd>5</kbd>: dibuja un ocho con las flechas. <kbd>6</kbd>: corre contra una pared.</p>`,

    setup(api) {
      return { sc: scenes[api.mode || '1'].init(api), on: api.params.on };
    },
    update(s, dt, api) {
      if (api.input.wasPressed('KeyP')) api.paramsApi.set('on', !api.params.on);
      // Cada lado del interruptor empieza de cero, para que las métricas no se mezclen.
      if (s.on !== api.params.on) { s.on = api.params.on; s.sc = scenes[api.mode].init(api); }
      scenes[api.mode].update(s.sc, dt, api, api.params.on);
    },
    render(g, s, api) {
      const c = api.colors;
      const on = api.params.on;
      const pr = PRINCIPLES.find((p) => p.key === api.mode);
      g.fillStyle = c.stage;
      g.fillRect(0, 0, api.w, api.h);
      scenes[api.mode].render(g, s.sc, api, on);
      g.fillStyle = on ? c.good : c.surface2;
      roundRect(g, 12, 12, 150, 26, 6);
      g.fill();
      text(g, on ? 'principio: SÍ' : 'principio: NO', 87, 26, { align: 'center', baseline: 'middle', size: 12, weight: 700, color: on ? c.bg : c.text });
      text(g, on ? pr.on : pr.off, 14, api.h - 14, { size: 12, color: c.text });
      api.metric('on', on ? 'aplicado' : 'sin aplicar');
      api.metricColor('on', on ? 'good' : '');
    },
  });
}
