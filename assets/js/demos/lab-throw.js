// LAB · Agarrar y lanzar: la masa se revela al arrastrar (si el agarre la respeta)
// y, sobre todo, al soltar y chocar. Tarea: llevar cada objeto a la zona marcada.

import { createDemo, text } from '../core/demo.js';
import { audio } from '../core/audio.js';
import { reducedMotion } from '../core/theme.js';
import { createBody, grab, stepWorld, VelocityTracker, spawnDust, stepDust, drawDust, Shake, withSquash } from './shared/bodies.js';

const BOUNDS = { x: 10, y: 10, w: 880, h: 440 };
const KINDS = [
  { key: 'ball', label: 'Pelota', m: 0.15, r: 16, rest: 0.85, drag: 0.6, color: 'accent2' },
  { key: 'box', label: 'Caja', m: 1, r: 24, rest: 0.45, drag: 1.2, color: 'accent' },
  { key: 'anvil', label: 'Yunque', m: 6, r: 34, rest: 0.08, drag: 2.5, color: 'accent3' },
];

export function mountThrow(mount, { id = 'LAB-M2' } = {}) {
  return createDemo({
    mount,
    id,
    title: 'Agarrar y lanzar',
    width: 900,
    height: 460,
    hint: 'Arrastra un objeto y suéltalo en movimiento',
    params: [
      { key: 'mode', type: 'select', label: 'Agarre', options: [['rigid', 'Rígido (el objeto es el cursor)'], ['spring', 'Resorte (la masa retrasa)'], ['force', 'Fuerza limitada (tu brazo)']], value: 'spring' },
      { key: 'k', label: 'Rigidez del agarre', min: 20, max: 1500, step: 10, value: 500 },
      { key: 'zeta', label: 'Amortiguación (ζ)', min: 0.1, max: 2, step: 0.01, value: 0.8 },
      { key: 'maxForce', label: 'Fuerza máxima del brazo', min: 300, max: 20000, step: 100, value: 2500, unit: 'N' },
      { key: 'friction', label: 'Rozamiento', min: 0, max: 4, step: 0.05, value: 1, unit: '×' },
      { heading: 'Pulido' },
      { key: 'sound', type: 'check', label: 'Sonido de impacto', value: true },
      { key: 'shake', type: 'check', label: 'Temblor de cámara', value: true },
      { key: 'dust', type: 'check', label: 'Polvo', value: true },
      { key: 'squash', type: 'check', label: 'Squash al chocar', value: true },
    ],
    modes: [
      { key: '1', label: 'Agarre rígido', values: { mode: 'rigid' } },
      { key: '2', label: 'Resorte', values: { mode: 'spring' } },
      { key: '3', label: 'Fuerza limitada', values: { mode: 'force' } },
    ],
    startMode: '2',
    metrics: KINDS.map((k) => ({ key: k.key, label: `${k.label} (${k.m} kg) a la zona` })),
    foot: `<p><strong>Prueba esto:</strong> con <kbd>1</kbd> (rígido) los tres objetos se arrastran igual: la masa solo aparece cuando chocan.
      Con <kbd>2</kbd> y <kbd>3</kbd> el yunque se queda atrás y cuesta frenarlo: necesitas más <em>correcciones</em> (cambios bruscos de dirección)
      para dejarlo en la zona. Cada corrección consume un ciclo de percepción-acción de ~240 ms.</p>`,

    setup(api) {
      const bodies = KINDS.map((k, i) => createBody({ x: 150 + i * 160, y: 320, r: k.r, m: k.m, rest: k.rest, drag: k.drag, kind: k }));
      return {
        bodies,
        held: null,
        tracker: new VelocityTracker(0.06),
        zone: newZone(),
        dust: [],
        shake: new Shake(),
        attempt: null,
        results: {},
        lastDir: null,
        lastSound: 0,
      };
    },

    update(s, dt, api) {
      const { input: inp, params: p } = api;
      const m = inp.mouse;
      s.tracker.push(api.time, m.x, m.y);
      const cv = s.tracker.get();

      if (inp.mousePressed) {
        const b = s.bodies.find((o) => Math.hypot(o.x - m.x, o.y - m.y) < o.r + 8);
        if (b) {
          s.held = b;
          s.attempt = { body: b, start: api.time, corrections: 0, released: false };
          s.lastDir = null;
        }
      }
      if (s.held && !m.down) {
        s.held.rigid = false;
        if (s.attempt) s.attempt.released = true;
        s.held = null;
      }
      if (s.held) {
        s.held.rigid = p.mode === 'rigid';
        grab(s.held, m.x, m.y, p.mode, p, dt, cv);
        // Correcciones: inversiones bruscas de la dirección del cursor mientras arrastras.
        const sp = Math.hypot(cv.vx, cv.vy);
        if (sp > 90) {
          const dir = { x: cv.vx / sp, y: cv.vy / sp };
          if (s.lastDir && dir.x * s.lastDir.x + dir.y * s.lastDir.y < -0.3) s.attempt.corrections++;
          s.lastDir = dir;
        }
      }

      stepWorld(s.bodies, BOUNDS, dt, {
        friction: p.friction,
        held: s.held,
        onImpact: (a, b, speed, nx, ny) => {
          if (speed < 60) return;
          const mass = b ? Math.max(a.m, b.m) : a.m;
          const mNorm = Math.min(1, Math.log10(1 + mass * 1.5) / Math.log10(10));
          if (p.sound && api.time - s.lastSound > 0.05) {
            audio.thud(mNorm, Math.min(1, speed / 900));
            s.lastSound = api.time;
          }
          if (p.shake && !reducedMotion()) s.shake.add(Math.min(0.6, (speed / 2500) * mass * 0.5));
          if (p.dust && speed > 120) spawnDust(s.dust, a.x - nx * a.r, a.y - ny * a.r, nx, ny, Math.round(3 + mass * 2), 80 + speed * 0.15);
        },
      });
      stepDust(s.dust, dt);
      s.shake.step(dt);

      // ¿Terminó el intento? El objeto soltado reposa dentro de la zona.
      const at = s.attempt;
      if (at && at.released) {
        const b = at.body;
        const still = Math.hypot(b.vx, b.vy) < 15;
        if (still) {
          if (inZone(b, s.zone)) {
            s.results[b.kind.key] = { time: api.time - at.start, corrections: at.corrections };
            s.zone = newZone(s.zone);
            if (p.sound) audio.blip(880);
          }
          s.attempt = null;
        }
      }
    },

    render(g, s, api) {
      const c = api.colors;
      const p = api.params;
      const off = s.shake.offset();
      g.save();
      g.translate(off.x, off.y);

      g.fillStyle = c.surface2;
      g.fillRect(BOUNDS.x, BOUNDS.y, BOUNDS.w, BOUNDS.h);
      g.strokeStyle = c.line;
      g.lineWidth = 2;
      g.strokeRect(BOUNDS.x, BOUNDS.y, BOUNDS.w, BOUNDS.h);

      // Zona objetivo.
      const z = s.zone;
      g.fillStyle = c.good;
      g.globalAlpha = 0.1;
      g.fillRect(z.x, z.y, z.w, z.h);
      g.globalAlpha = 1;
      g.strokeStyle = c.good;
      g.setLineDash([6, 6]);
      g.strokeRect(z.x + 0.5, z.y + 0.5, z.w, z.h);
      g.setLineDash([]);
      text(g, 'zona objetivo', z.x + 6, z.y + 16, { size: 11, mono: true, color: c.good });

      drawDust(g, s.dust, c.muted);

      for (const b of s.bodies) {
        g.fillStyle = 'rgba(0,0,0,0.18)';
        g.beginPath();
        g.ellipse(b.x + 4, b.y + 6, b.r, b.r * 0.9, 0, 0, Math.PI * 2);
        g.fill();
        withSquash(g, b, p.squash, () => {
          g.fillStyle = c[b.kind.color];
          g.beginPath();
          if (b.kind.key === 'box') g.rect(-b.r * 0.85, -b.r * 0.85, b.r * 1.7, b.r * 1.7);
          else g.arc(0, 0, b.r, 0, Math.PI * 2);
          g.fill();
        });
        text(g, `${b.kind.label} · ${b.m} kg`, b.x, b.y + b.r + 15, { align: 'center', size: 11, mono: true });
      }

      if (s.held) {
        const m = api.input.mouse;
        g.strokeStyle = c.text;
        g.lineWidth = 1.5;
        g.setLineDash([3, 3]);
        g.beginPath();
        g.moveTo(m.x, m.y);
        g.lineTo(s.held.x, s.held.y);
        g.stroke();
        g.setLineDash([]);
        g.beginPath();
        g.arc(m.x, m.y, 4, 0, Math.PI * 2);
        g.fillStyle = c.text;
        g.fill();
      }
      g.restore();

      if (s.attempt) api.hud(`${s.attempt.body.kind.label}: ${(api.time - s.attempt.start).toFixed(1)} s · ${s.attempt.corrections} correcciones`);
      else api.hud('');
      for (const k of KINDS) {
        const r = s.results[k.key];
        api.metric(k.key, r ? `${r.time.toFixed(1)} s · ${r.corrections} corr.` : '—');
      }
    },
  });
}

function newZone(prev) {
  const w = 150;
  const h = 120;
  let z;
  do {
    z = { x: 40 + Math.random() * (BOUNDS.w - w - 60), y: 30 + Math.random() * (BOUNDS.h - h - 50), w, h };
  } while (prev && Math.hypot(z.x - prev.x, z.y - prev.y) < 250);
  return z;
}
const inZone = (b, z) => b.x > z.x && b.x < z.x + z.w && b.y > z.y && b.y < z.y + z.h;
