// LAB · Lag en vivo: el mismo control con retraso, jitter, tope de fps y tirones.
// Todo el input pasa por una Pipeline; la imagen se congela según el tope de fps y los tirones.

import { createDemo, text, drawGrid, roundRect } from '../core/demo.js';
import { lagBand } from '../core/lag.js';
import { audio } from '../core/audio.js';
import { Pipeline, FPS_OPTIONS } from './shared/pipeline.js';
import { drawLagScale, drawPressPair } from './shared/lagviz.js';

const ARENA_H = 372;
const SIZE = 34;
const KEY_SPEED = 420;
const BASE = { delay: 0, jitter: 0, fps: '0', hitchRate: 0, hitchMs: 300, predict: false };

export function mountLagLive(mount, { id = 'LAB-L1' } = {}) {
  let pipe = null;
  return createDemo({
    mount,
    id,
    title: 'Retraso, jitter y fps: el mismo control, tarde',
    width: 900,
    height: 460,
    hint: 'Mueve el mouse sobre el área · flechas o WASD · Espacio',
    params: [
      { heading: 'Respuesta' },
      { key: 'delay', label: 'Retraso del input', min: 0, max: 500, step: 5, value: 0, unit: 'ms' },
      { key: 'jitter', label: 'Jitter (variación)', min: 0, max: 200, step: 5, value: 0, unit: 'ms', help: 'Cada evento llega con un retraso extra al azar entre 0 y este valor.' },
      { heading: 'Continuidad' },
      { key: 'fps', type: 'select', label: 'Imagen', options: FPS_OPTIONS, value: '0' },
      { key: 'hitchRate', label: 'Tirones cada 10 s', min: 0, max: 10, step: 0.5, value: 0, help: 'Congelamientos al azar: el juego no lee input ni dibuja.' },
      { key: 'hitchMs', label: 'Duración del tirón', min: 50, max: 1000, step: 10, value: 300, unit: 'ms' },
      { heading: 'Ayudas' },
      { key: 'ghost', type: 'check', label: 'Mostrar tu mano (el cursor sin lag)', value: true },
      { key: 'predict', type: 'check', label: 'Predicción lineal (extrapolar la velocidad)', value: false, help: 'Dibuja el cuadrado donde estaría si siguiera igual durante el retraso. Gana en las rectas y se pasa en las frenadas.' },
    ],
    modes: [
      { key: '1', label: '0 ms', values: { ...BASE } },
      { key: '2', label: '50 ms', values: { ...BASE, delay: 50 } },
      { key: '3', label: '100 ms', values: { ...BASE, delay: 100 } },
      { key: '4', label: '200 ms', values: { ...BASE, delay: 200 } },
      { key: '5', label: '300 ms', values: { ...BASE, delay: 300 } },
      { key: '6', label: '10 fps', values: { ...BASE, fps: '10' } },
      { key: '7', label: 'Jitter', values: { ...BASE, delay: 40, jitter: 120 } },
      { key: '8', label: 'Tirones', values: { ...BASE, hitchRate: 5, hitchMs: 300 } },
    ],
    graph: {
      window: 3,
      series: [
        { label: 'mano x', color: 'muted', min: 0, max: 1, width: 1.5 },
        { label: 'en pantalla x', color: 'accent', step: true },
      ],
    },
    metrics: [
      { key: 'inj', label: 'Input → juego (medido)' },
      { key: 'screen', label: 'Input → imagen (medido)' },
      { key: 'fps', label: 'Frames nuevos por segundo' },
      { key: 'band', label: 'Banda (cap. 2)' },
    ],
    foot: `<p><strong>Prueba esto:</strong> dibuja círculos con el mouse y recorre los modos <kbd>1</kbd>…<kbd>5</kbd>. Entre 0 y 50 ms el
      cuadrado parece pegado a tu mano. Con 100 ms ya se arrastra, pero lo sigues controlando. Con 200 ms y 300 ms empiezas a <em>esperarlo</em>:
      mueves la mano, miras y corriges, que es la señal de que el ciclo de corrección se rompió. Pulsa <kbd>Espacio</kbd> y compara las dos teclas
      de arriba a la izquierda. Luego prueba <kbd>6</kbd> (10 fps, sin retraso) y <kbd>8</kbd> (tirones): son fallas de <em>continuidad</em>,
      no de respuesta, y se sienten distinto.</p>`,

    setup(api) {
      pipe ||= new Pipeline(api.input);
      const c = { x: api.w / 2, y: ARENA_H / 2 };
      return {
        p: { ...c }, prev: { ...c }, v: { x: 0, y: 0 }, sim: { ...c },
        view: { x: c.x, y: c.y, flash: 0 },
        flash: 0, rawFlash: 0,
      };
    },

    update(s, dt, api) {
      const p = api.params;
      pipe.configure(p);
      if (pipe.step()) {
        const L = pipe.input;
        if ((L.mouse.dx || L.mouse.dy) && L.mouse.inside) {
          s.p.x = L.mouse.x;
          s.p.y = Math.min(ARENA_H - SIZE / 2, L.mouse.y);
        }
        const ax = L.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']);
        const ay = L.axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']);
        s.p.x = Math.max(SIZE / 2, Math.min(api.w - SIZE / 2, s.p.x + ax * KEY_SPEED * dt));
        s.p.y = Math.max(SIZE / 2, Math.min(ARENA_H - SIZE / 2, s.p.y + ay * KEY_SPEED * dt));
        if (L.wasPressed('Space')) {
          s.flash = 1;
          audio.blip(880);
        }
      }
      pipe.endStep();
      if (api.input.wasPressed('Space')) s.rawFlash = 1;
      s.flash = Math.max(0, s.flash - dt * 3);
      s.rawFlash = Math.max(0, s.rawFlash - dt * 3);

      // Velocidad de lo que el juego ya sabe, para la predicción.
      const a = 1 - Math.exp(-dt / 0.05);
      s.v.x += ((s.p.x - s.prev.x) / dt - s.v.x) * a;
      s.v.y += ((s.p.y - s.prev.y) / dt - s.v.y) * a;
      s.prev = { ...s.p };
      const ahead = p.predict ? (p.delay + p.jitter / 2) / 1000 : 0;
      s.sim = {
        x: Math.max(SIZE / 2, Math.min(api.w - SIZE / 2, s.p.x + s.v.x * ahead)),
        y: Math.max(SIZE / 2, Math.min(ARENA_H - SIZE / 2, s.p.y + s.v.y * ahead)),
      };
      api.graph.push(api.time, [api.input.mouse.x / api.w, s.view.x / api.w]);
    },

    render(g, s, api) {
      const c = api.colors;
      const p = api.params;
      if (pipe.present()) s.view = { ...s.sim, flash: s.flash };
      const v = s.view;

      g.fillStyle = c.stage;
      g.fillRect(0, 0, api.w, ARENA_H);
      drawGrid(g, api.w, ARENA_H, 40);

      const hand = api.input.mouse;
      if (p.ghost && hand.inside) {
        g.strokeStyle = c.muted;
        g.setLineDash([4, 4]);
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(hand.x, hand.y);
        g.lineTo(v.x, v.y);
        g.stroke();
        g.setLineDash([]);
        g.lineWidth = 2;
        g.beginPath();
        g.arc(hand.x, hand.y, 9, 0, Math.PI * 2);
        g.stroke();
        text(g, 'tu mano', hand.x + 13, hand.y - 10, { size: 11 });
      }

      const sz = SIZE * (1 + v.flash * 0.45);
      if (v.flash > 0) {
        g.fillStyle = c.accent2;
        g.globalAlpha = v.flash * 0.35;
        g.beginPath();
        g.arc(v.x, v.y, sz * 1.1, 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = 1;
      }
      roundRect(g, v.x - sz / 2, v.y - sz / 2, sz, sz, 6);
      g.fillStyle = c.accent;
      g.fill();

      drawPressPair(g, c, 14, 14, { raw: s.rawFlash, game: v.flash });

      // Escala de bandas con la latencia medida hasta la imagen (relleno) y la nominal (hueco).
      g.fillStyle = c.surface;
      g.fillRect(0, ARENA_H, api.w, api.h - ARENA_H);
      const measured = pipe.avgScreen || null;
      const nominal = p.delay + p.jitter / 2;
      const band = lagBand(measured ?? nominal);
      drawLagScale(g, { x: 24, y: ARENA_H + 34, w: api.w - 48, h: 18 }, c, { ms: measured, nominal });
      text(g, `${band.label}.`, 24, ARENA_H + 20, { size: 13, weight: 700, color: c[band.color] });
      text(g, band.note, 24 + g.measureText(`${band.label}. `).width + 6, ARENA_H + 20, { size: 12 });
      text(g, '▲ medido hasta la imagen   △ retraso nominal   (más lo que ya suman tu monitor y tu mouse)', api.w - 24, ARENA_H + 82, { size: 10, align: 'right' });

      api.metric('inj', pipe.input.measured.length ? `${Math.round(pipe.avgInjected)} ms` : '—');
      api.metric('screen', measured ? `${Math.round(measured)} ms` : '—');
      api.metric('fps', String(pipe.shownFps));
      api.metric('band', band.label);
      api.metricColor('band', band.color);
    },
  });
}
