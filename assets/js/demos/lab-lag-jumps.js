// LAB · Saltos con lag: un corredor automático y huecos que hay que saltar a tiempo.
// El retraso convierte "salté en el borde" en "salté en el aire": la distancia perdida es velocidad × retraso.

import { createDemo, text } from '../core/demo.js';
import { audio } from '../core/audio.js';
import { Pipeline, FPS_OPTIONS } from './shared/pipeline.js';
import { drawResults, drawPressPair } from './shared/lagviz.js';

const GAME_W = 610;
const CHART = { x: 660, y: 60, w: 220, h: 300 };
const GY = 330; // superficie del suelo
const RUN_X = 170; // posición del corredor en pantalla
const W = 22;
const H = 34;
const G = 2600;
const JV = 820;
const GAPS = 14;
const JUMP_KEYS = ['Space', 'KeyW', 'ArrowUp'];

export function mountLagJumps(mount, { id = 'LAB-L3' } = {}) {
  let pipe = null;
  const results = [];
  return createDemo({
    mount,
    id,
    title: 'Saltos con lag',
    width: 900,
    height: 460,
    hint: 'Clic aquí y pulsa Espacio para empezar',
    params: [
      { key: 'delay', label: 'Retraso del input', min: 0, max: 500, step: 10, value: 0, unit: 'ms' },
      { key: 'fps', type: 'select', label: 'Imagen', options: FPS_OPTIONS, value: '0' },
      { key: 'speed', label: 'Velocidad de carrera', min: 200, max: 520, step: 10, value: 340, unit: 'px/s' },
      { key: 'gapMax', label: 'Hueco máximo', min: 80, max: 200, step: 5, value: 160, unit: 'px', help: 'Con 340 px/s, un salto recorre unos 210 px: los huecos grandes dejan poco margen.' },
      { key: 'marks', type: 'check', label: 'Marcar dónde pulsaste y dónde saltó', value: true },
      { presets: { '0 ms': { delay: 0 }, '100 ms': { delay: 100 }, '200 ms': { delay: 200 }, '300 ms': { delay: 300 } } },
    ],
    metrics: [
      { key: 'gaps', label: 'Huecos superados' },
      { key: 'falls', label: 'Caídas' },
      { key: 'lost', label: 'Distancia perdida por el lag' },
      { key: 'n', label: 'Rondas guardadas' },
    ],
    foot: `<p><strong>Prueba esto:</strong> haz una ronda con 0 ms y otra con 200 ms. Las marcas muestran el costo exacto del lag:
      la raya gris es dónde pulsaste y la naranja, dónde saltó el personaje. Con 200 ms y 340 px/s el personaje despega 68 px más tarde.
      Si el retraso es fijo, puedes aprender a pulsar antes: tu cerebro absorbe un lag <em>constante</em>. Activa el jitter en la demo 1 y verás
      por qué un lag variable es peor: no hay nada que aprender. <kbd>C</kbd> borra los resultados.</p>`,

    setup(api) {
      pipe ||= new Pipeline(api.input);
      return {
        phase: 'ready', // ready | run | done
        course: makeCourse(api.params.gapMax),
        x: 60, y: GY, vy: 0, grounded: true,
        cleared: 0, falls: 0, gapIdx: 0, fallen: false,
        marks: [], // {x, kind: 'raw'|'jump'}
        rawFlash: 0, flash: 0,
        view: { x: 60, y: GY, flash: 0 },
      };
    },

    update(s, dt, api) {
      const p = api.params;
      pipe.configure({ delay: p.delay, fps: p.fps });
      if (api.input.wasPressed('KeyC')) results.length = 0;
      const raw = api.input.wasPressed(...JUMP_KEYS) || api.input.mousePressed || api.input.padPressed.has(0);
      if (raw) s.rawFlash = 1;

      if (s.phase !== 'run') {
        // El clic solo da foco; para empezar hace falta tecla o botón del gamepad.
        if ((api.input.wasPressed(...JUMP_KEYS) || api.input.padPressed.has(0)) && api.time - (s.doneAt ?? -9) > 1) {
          Object.assign(s, { phase: 'run', course: makeCourse(p.gapMax), x: 60, y: GY, vy: 0, grounded: true, cleared: 0, falls: 0, gapIdx: 0, fallen: false, marks: [] });
          pipe.input.flush();
        }
        pipe.step();
        pipe.endStep();
      } else {
        if (raw && s.grounded) s.marks.push({ x: s.x, kind: 'raw' });
        const ok = pipe.step();
        const L = pipe.input;
        const jump = ok && (L.wasPressed(...JUMP_KEYS) || L.mousePressed || L.padPressed.has(0));
        pipe.endStep();

        if (jump && s.grounded) {
          s.vy = -JV;
          s.grounded = false;
          s.flash = 1;
          s.marks.push({ x: s.x, kind: 'jump' });
          audio.tone({ freq: 420, dur: 0.1, type: 'triangle', gain: 0.18, slide: 1.8 });
        }
        s.x += p.speed * dt;
        s.vy += G * dt;
        s.y += s.vy * dt;
        const over = s.course.plats.some(([a, b]) => s.x + W / 2 > a && s.x - W / 2 < b);
        if (s.y >= GY && over && !s.fallen && s.y - s.vy * dt <= GY + 1) {
          if (!s.grounded) audio.thud(0.2, 0.5);
          s.y = GY;
          s.vy = 0;
          s.grounded = true;
        } else if (s.y > GY) {
          s.grounded = false;
          s.fallen = true;
        }

        // ¿Pasamos el siguiente hueco?
        const gap = s.course.gaps[s.gapIdx];
        if (gap && s.grounded && s.x - W / 2 > gap[1]) {
          s.cleared++;
          s.gapIdx++;
        }
        if (s.y > GY + 140) {
          // Caída: reaparece al principio de la plataforma siguiente al hueco.
          s.falls++;
          const g2 = s.course.gaps[s.gapIdx];
          s.x = g2 ? g2[1] + 30 : s.x;
          s.y = GY;
          s.vy = 0;
          s.grounded = true;
          s.fallen = false;
          s.gapIdx++;
          audio.tone({ freq: 160, dur: 0.25, type: 'sawtooth', gain: 0.08, slide: 0.5 });
        }
        if (s.x > s.course.end) {
          s.phase = 'done';
          s.doneAt = api.time; // un segundo para leer el resultado antes de poder reiniciar
          const pct = (s.cleared / GAPS) * 100;
          s.last = pct;
          results.push({ x: p.delay, y: pct });
          if (results.length > 60) results.shift();
        }
        s.marks = s.marks.filter((m) => m.x > s.x - RUN_X - 40);
      }
      s.flash = Math.max(0, s.flash - dt * 3);
      s.rawFlash = Math.max(0, s.rawFlash - dt * 3);
    },

    render(g, s, api) {
      const c = api.colors;
      const p = api.params;
      if (pipe.present()) s.view = { x: s.x, y: s.y, flash: s.flash, vy: s.vy };
      const v = s.view;
      const cam = v.x - RUN_X;

      g.fillStyle = c.stage;
      g.fillRect(0, 0, GAME_W, api.h);
      g.save();
      g.beginPath();
      g.rect(0, 0, GAME_W, api.h);
      g.clip();

      // Plataformas.
      for (const [a, b] of s.course.plats) {
        const x0 = a - cam;
        const x1 = b - cam;
        if (x1 < 0 || x0 > GAME_W) continue;
        g.fillStyle = c.surface2;
        g.fillRect(x0, GY, x1 - x0, api.h - GY);
        g.fillStyle = c.line;
        g.fillRect(x0, GY, x1 - x0, 3);
      }
      // Meta.
      const fx = s.course.end - cam;
      if (fx < GAME_W) {
        g.fillStyle = c.good;
        g.fillRect(fx, GY - 80, 4, 80);
      }

      if (p.marks) {
        for (const m of s.marks) {
          const mx = m.x - cam;
          g.fillStyle = m.kind === 'raw' ? c.muted : c.accent;
          g.fillRect(mx - 1.5, GY - (m.kind === 'raw' ? 26 : 40), 3, m.kind === 'raw' ? 26 : 40);
        }
      }

      // Corredor: se estira al subir y se aplasta al caer.
      const st = v.y < GY ? Math.max(-0.2, Math.min(0.25, -v.vy / 3200)) : 0;
      const w = W * (1 - st * 0.6);
      const h = H * (1 + st);
      g.fillStyle = c.accent;
      g.fillRect(RUN_X - w / 2, v.y - h, w, h);
      g.restore();

      drawPressPair(g, c, 14, 14, { raw: s.rawFlash, game: v.flash });
      text(g, `retraso ${p.delay} ms → despegas ${Math.round((p.speed * p.delay) / 1000)} px tarde`, GAME_W - 12, 30, { align: 'right', size: 12, mono: true, color: c.text });

      if (s.phase !== 'run') {
        g.fillStyle = c.surface;
        g.globalAlpha = 0.85;
        g.fillRect(GAME_W / 2 - 200, 110, 400, 110);
        g.globalAlpha = 1;
        text(g, s.phase === 'done' ? `Superaste ${s.cleared} de ${GAPS} huecos (${Math.round(s.last)} %)` : `${GAPS} huecos. Salta con Espacio, W, ↑, clic o A`, GAME_W / 2, 152, { align: 'center', size: 15, weight: 700, color: c.text });
        text(g, 'Pulsa Espacio para empezar', GAME_W / 2, 182, { align: 'center', size: 13 });
      }

      g.fillStyle = c.surface;
      g.fillRect(GAME_W, 0, api.w - GAME_W, api.h);
      drawResults(g, CHART, c, { points: results, yMax: 100, yLabel: '% de huecos superados', title: 'Éxito según el retraso', now: p.delay, better: 'high', fmtY: (y) => `${Math.round(y)}%` });

      api.metric('gaps', `${s.cleared} / ${GAPS}`);
      api.metric('falls', String(s.falls));
      api.metric('lost', `${Math.round((p.speed * p.delay) / 1000)} px`);
      api.metric('n', String(results.length));
    },
  });
}

function makeCourse(gapMax) {
  const plats = [];
  const gaps = [];
  let x = 0;
  let len = 700;
  for (let i = 0; i < GAPS; i++) {
    plats.push([x, x + len]);
    x += len;
    const gap = 80 + Math.random() * Math.max(0, gapMax - 80);
    gaps.push([x, x + gap]);
    x += gap;
    len = 160 + Math.random() * 260;
  }
  plats.push([x, x + 600]);
  return { plats, gaps, end: x + 300 };
}
