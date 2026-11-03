// LAB · Mitigaciones: el lag sigue ahí, pero algo responde ya.
// Sonido e indicador al pulsar, animación de anticipación que "cubre" el retraso y buffer de input.

import { createDemo, text, roundRect } from '../core/demo.js';
import { audio } from '../core/audio.js';
import { Pipeline } from './shared/pipeline.js';

const GY = 320;
const W = 30;
const H = 44;
const G = 2800;
const JV = 900;
const RUN = 300;
const BR = 17;
const JUMP_KEYS = ['Space', 'KeyW', 'ArrowUp'];
const OFF = { sound: false, indicator: false, anticip: false, buffer: 0 };

export function mountLagMitigation(mount, { id = 'LAB-L6' } = {}) {
  let pipe = null;
  return createDemo({
    mount,
    id,
    title: 'Mitigaciones: que algo responda ya',
    width: 900,
    height: 420,
    hint: 'Clic aquí · A/D o ←/→ para moverte · Espacio para saltar',
    params: [
      { key: 'delay', label: 'Retraso del input', min: 0, max: 400, step: 10, value: 150, unit: 'ms' },
      { key: 'rate', label: 'Barriles por minuto', min: 10, max: 60, step: 1, value: 32 },
      { heading: 'Mitigaciones' },
      { key: 'sound', type: 'check', label: 'Sonido al pulsar (sin esperar al juego)', value: false },
      { key: 'indicator', type: 'check', label: 'Indicador del botón en pantalla', value: false },
      { key: 'anticip', type: 'check', label: 'Animación de anticipación (se agacha al instante)', value: false, help: 'El salto sigue llegando tarde, pero la animación empieza ya y "ocupa" el retraso.' },
      { key: 'buffer', label: 'Buffer de salto', min: 0, max: 300, step: 10, value: 0, unit: 'ms', help: 'Un salto pulsado en el aire se guarda y se ejecuta al tocar el suelo, si no pasó este tiempo.' },
    ],
    modes: [
      { key: '1', label: 'Sin mitigar', values: { ...OFF } },
      { key: '2', label: 'Sonido + botón', values: { ...OFF, sound: true, indicator: true } },
      { key: '3', label: 'Anticipación', values: { ...OFF, anticip: true } },
      { key: '4', label: 'Buffer', values: { ...OFF, buffer: 180 } },
      { key: '5', label: 'Todo', values: { sound: true, indicator: true, anticip: true, buffer: 180 } },
    ],
    metrics: [
      { key: 'dodged', label: 'Barriles esquivados' },
      { key: 'hits', label: 'Golpes' },
      { key: 'lost', label: 'Saltos perdidos' },
      { key: 'buffered', label: 'Saltos rescatados por el buffer' },
    ],
    foot: `<p><strong>Prueba esto:</strong> con 150 ms, juega un minuto en <kbd>1</kbd> y otro en <kbd>3</kbd>. Las cifras de esquivados
      apenas cambian, porque el salto llega igual de tarde, pero la sensación sí cambia: con anticipación el personaje responde en el mismo ciclo
      perceptivo en que pulsas. Muchos juegos hacen esto a propósito: una animación de preparación disimula el tiempo de procesamiento o de red.
      El buffer <kbd>4</kbd> no quita lag. Evita que se pierdan las pulsaciones que haces antes de tiempo para compensarlo: salta en
      cadena y mira cómo sube "rescatados".</p>`,

    setup(api) {
      pipe ||= new Pipeline(api.input);
      return {
        x: 260, y: GY, vy: 0, grounded: true, face: 1,
        barrels: [], spawnIn: 1.2,
        dodged: 0, hits: 0, lost: 0, buffered: 0,
        pending: null, // instante (s) de un salto guardado en el buffer
        crouch: 0, // 0..1 anticipación
        rawPress: 0, landT: 0, hurt: 0,
      };
    },

    update(s, dt, api) {
      const p = api.params;
      pipe.configure({ delay: p.delay });
      const inp = api.input;

      // Respuesta inmediata: todo lo que no necesita saber el resultado.
      if (inp.wasPressed(...JUMP_KEYS) || inp.padPressed.has(0)) {
        s.rawPress = 1;
        if (p.sound) audio.tone({ freq: 520, dur: 0.06, type: 'triangle', gain: 0.18 });
        if (p.anticip && s.grounded) s.crouch = 1;
      }

      const ok = pipe.step();
      const L = pipe.input;
      const jump = ok && (L.wasPressed(...JUMP_KEYS) || L.padPressed.has(0));
      const ax = ok ? L.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']) + (Math.abs(L.pad.lx) > 0.25 ? Math.sign(L.pad.lx) : 0) : 0;
      pipe.endStep();

      if (ax) s.face = Math.sign(ax);
      s.x = Math.max(W, Math.min(api.w - W, s.x + Math.max(-1, Math.min(1, ax)) * RUN * dt));

      const doJump = () => {
        s.vy = -JV;
        s.grounded = false;
        s.crouch = 0;
        if (!p.sound) audio.tone({ freq: 520, dur: 0.06, type: 'triangle', gain: 0.18 });
        audio.tone({ freq: 360, dur: 0.12, type: 'sine', gain: 0.15, slide: 1.8 });
      };
      if (jump) {
        if (s.grounded) doJump();
        else if (p.buffer > 0) s.pending = api.time;
        else s.lost++;
      }

      s.vy += G * dt;
      s.y += s.vy * dt;
      if (s.y >= GY) {
        if (!s.grounded) {
          s.landT = 1;
          s.grounded = true;
          if (s.pending != null) {
            if ((api.time - s.pending) * 1000 <= p.buffer) {
              s.buffered++;
              s.pending = null;
              s.y = GY;
              doJump();
            } else {
              s.lost++;
              s.pending = null;
            }
          }
        }
        if (s.grounded) { s.y = GY; s.vy = 0; }
      }
      // Si la anticipación terminó y el salto nunca llegó (p. ej. se pulsó en el aire), se recupera sola.
      if (s.crouch > 0 && s.grounded) s.crouch = Math.max(0, s.crouch - dt / Math.max(0.12, (p.delay + 80) / 1000));

      // Barriles.
      s.spawnIn -= dt;
      if (s.spawnIn <= 0) {
        const fromLeft = Math.random() < 0.3;
        s.barrels.push({ x: fromLeft ? -BR : api.w + BR, v: (fromLeft ? 1 : -1) * (240 + Math.random() * 140), rot: 0, hit: false });
        s.spawnIn = (60 / p.rate) * (0.6 + Math.random() * 0.8);
      }
      for (const b of s.barrels) {
        b.x += b.v * dt;
        b.rot += (b.v / BR) * dt;
        const by = GY - BR;
        const top = s.y - H;
        if (!b.hit && Math.abs(b.x - s.x) < W / 2 + BR - 4 && by + BR > top && by - BR < s.y) {
          b.hit = true;
          s.hits++;
          s.hurt = 1;
          audio.thud(0.5, 0.8);
        }
      }
      s.barrels = s.barrels.filter((b) => {
        const out = b.x < -BR * 2 || b.x > api.w + BR * 2;
        if (out && !b.hit) s.dodged++;
        return !out;
      });

      s.rawPress = Math.max(0, s.rawPress - dt * 4);
      s.landT = Math.max(0, s.landT - dt * 6);
      s.hurt = Math.max(0, s.hurt - dt * 2.5);
    },

    render(g, s, api) {
      const c = api.colors;
      const p = api.params;
      g.fillStyle = c.stage;
      g.fillRect(0, 0, api.w, api.h);
      g.fillStyle = c.surface2;
      g.fillRect(0, GY, api.w, api.h - GY);
      g.fillStyle = c.line;
      g.fillRect(0, GY, api.w, 2);

      for (const b of s.barrels) {
        g.save();
        g.translate(b.x, GY - BR);
        g.rotate(b.rot);
        g.fillStyle = b.hit ? c.muted : c.accent3;
        g.beginPath();
        g.arc(0, 0, BR, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = c.stage;
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(-BR + 3, 0);
        g.lineTo(BR - 3, 0);
        g.stroke();
        g.restore();
      }

      // Personaje: anticipación (se agacha), estirado al subir, aplastado al aterrizar.
      let sx = 1;
      let sy = 1;
      if (s.crouch > 0) { sy = 1 - 0.35 * s.crouch; sx = 1 + 0.25 * s.crouch; }
      if (!s.grounded) { const k = Math.min(0.3, Math.max(-0.15, -s.vy / 3000)); sy = 1 + k; sx = 1 - k * 0.6; }
      if (s.landT > 0) { sy *= 1 - 0.2 * s.landT; sx *= 1 + 0.15 * s.landT; }
      const w = W * sx;
      const h = H * sy;
      roundRect(g, s.x - w / 2, s.y - h, w, h, 6);
      g.fillStyle = s.hurt > 0 ? c.bad : c.accent;
      g.fill();
      g.fillStyle = c.stage;
      g.fillRect(s.x + s.face * w * 0.18 - 3, s.y - h * 0.72, 6, 6);

      if (p.indicator) {
        const bx = api.w - 70;
        const by = 50;
        g.fillStyle = s.rawPress > 0 ? c.accent2 : c.surface;
        g.beginPath();
        g.arc(bx, by, 22 + 4 * s.rawPress, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = c.line;
        g.lineWidth = 1.5;
        g.stroke();
        text(g, 'A', bx, by + 6, { align: 'center', size: 18, weight: 700, color: c.text });
        text(g, 'botón', bx, by + 42, { align: 'center', size: 10 });
      }
      text(g, `retraso ${p.delay} ms`, 14, 26, { size: 12, mono: true, color: c.text });
      const on = [p.sound && 'sonido', p.indicator && 'indicador', p.anticip && 'anticipación', p.buffer > 0 && `buffer ${p.buffer} ms`].filter(Boolean);
      text(g, on.length ? `mitigaciones: ${on.join(' · ')}` : 'sin mitigaciones', 14, 46, { size: 12 });

      api.metric('dodged', String(s.dodged));
      api.metric('hits', String(s.hits));
      api.metric('lost', String(s.lost));
      api.metric('buffered', String(s.buffered));
    },
  });
}
