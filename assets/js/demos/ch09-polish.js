// CH09-1 · ¿Se atraviesan o rebotan? Dos bolas que se cruzan; un sonido cambia lo que se ve.
// EX09-1 · El mismo golpe con cada tipo de pulido activable: animación, partículas, sonido, cámara, hitstop.

import { createDemo, text, roundRect } from '../core/demo.js';
import { audio } from '../core/audio.js';
import { reducedMotion } from '../core/theme.js';
import { burst, stepParticles, drawParticles } from './shared/physics2d.js';

// ---------------- CH09-1 ----------------
const CROSS = [
  { key: '1', label: 'Sin sonido' },
  { key: '2', label: 'Con sonido' },
  { key: '3', label: 'Sonido + pausa' },
  { key: '4', label: 'Sonido + deformación' },
];

export function mountBounce(mount, { id = 'CH09-1' } = {}) {
  const votes = Object.fromEntries(CROSS.map((m) => [m.key, { through: 0, bounce: 0 }]));
  const api = createDemo({
    mount,
    id,
    title: '¿Se atraviesan o rebotan?',
    width: 900,
    height: 300,
    hint: 'Mira las bolas y vota con los botones de abajo',
    params: [
      { key: 'period', label: 'Duración de cada pasada', min: 1, max: 4, step: 0.1, value: 2.2, unit: 's' },
    ],
    modes: CROSS,
    metrics: [
      { key: 'mode', label: 'Versión' },
      { key: 'through', label: 'Votos "se atraviesan"' },
      { key: 'bounce', label: 'Votos "rebotan"' },
    ],
    foot: `<p><strong>Prueba esto:</strong> mira varias pasadas en <kbd>1</kbd> y vota. Después pasa a <kbd>2</kbd>: el movimiento es
      idéntico, píxel por píxel, pero con un "ptoing" justo en el cruce la mayoría ve que las bolas chocan y vuelven. Es un efecto conocido de la
      percepción, y Swink lo usa para mostrar cuánto puede un sonido. Las versiones <kbd>3</kbd> y <kbd>4</kbd> agregan una pausa mínima o una
      deformación, otras pistas de choque.</p>`,

    setup() {
      return { t: 0, crossed: false, pause: 0, squash: 0 };
    },
    update(s, dt, a) {
      if (s.pause > 0) { s.pause -= dt; return; }
      const T = a.params.period;
      const before = s.t / T;
      s.t = (s.t + dt) % T;
      const k = s.t / T;
      if (before < 0.5 && k >= 0.5) {
        if (a.mode !== '1') audio.tone({ freq: 520, dur: 0.12, type: 'sine', gain: 0.35, slide: 0.55 });
        if (a.mode === '3') s.pause = 0.07;
        if (a.mode === '4') s.squash = 1;
      }
      s.squash = Math.max(0, s.squash - dt * 6);
    },
    render(g, s, a) {
      const c = a.colors;
      g.fillStyle = c.stage;
      g.fillRect(0, 0, a.w, a.h);
      const k = s.t / a.params.period;
      const x1 = 80 + k * (a.w - 160);
      const x2 = a.w - 80 - k * (a.w - 160);
      const y = a.h / 2;
      for (const x of [x1, x2]) {
        const sq = s.squash;
        g.fillStyle = '#d94a3d';
        g.beginPath();
        g.ellipse(x, y, 26 * (1 - sq * 0.3), 26 * (1 + sq * 0.25), 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.3)';
        g.beginPath();
        g.arc(x - 8, y - 9, 7, 0, Math.PI * 2);
        g.fill();
      }
      const v = votes[a.mode];
      a.metric('mode', CROSS.find((m) => m.key === a.mode).label);
      a.metric('through', String(v.through));
      a.metric('bounce', String(v.bounce));
    },
  });
  const row = document.createElement('div');
  row.className = 'modes';
  row.style.cssText = 'margin: 0; padding: 8px 12px; justify-content: flex-start;';
  for (const [k, label] of [['through', 'Se atraviesan'], ['bounce', 'Rebotan']]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn';
    b.textContent = label;
    b.addEventListener('click', () => { votes[api.mode][k]++; audio.click(); });
    row.append(b);
  }
  api.fig.querySelector('.metrics').before(row);
  return api;
}

// ---------------- EX09-1 ----------------
const ALL = { anim: true, parts: true, sound: true, shake: true, stop: 60, flash: true, knock: true };
const NONE = { anim: false, parts: false, sound: false, shake: false, stop: 0, flash: false, knock: false };

export function mountHitPolish(mount, { id = 'EX09-1' } = {}) {
  return createDemo({
    mount,
    id,
    title: 'Un golpe, capa por capa',
    width: 900,
    height: 360,
    hint: 'Clic aquí · J o Espacio para golpear',
    params: [
      { key: 'anim', type: 'check', label: 'Animación (anticipación y estiramiento)', value: true },
      { key: 'parts', type: 'check', label: 'Partículas', value: true },
      { key: 'sound', type: 'check', label: 'Sonido', value: true },
      { key: 'shake', type: 'check', label: 'Temblor de cámara', value: true },
      { key: 'flash', type: 'check', label: 'Destello del golpeado', value: true },
      { key: 'knock', type: 'check', label: 'Retroceso del golpeado', value: true },
      { key: 'stop', label: 'Hitstop (congelar al impactar)', min: 0, max: 200, step: 5, value: 60, unit: 'ms' },
    ],
    modes: [
      { key: '1', label: 'Nada', values: NONE },
      { key: '2', label: 'Solo sonido', values: { ...NONE, sound: true } },
      { key: '3', label: 'Solo imagen', values: { ...ALL, sound: false, stop: 0 } },
      { key: '4', label: 'Todo', values: ALL },
      { key: '5', label: 'Exagerado', values: { ...ALL, stop: 160 } },
    ],
    startMode: '4',
    metrics: [
      { key: 'layers', label: 'Capas de pulido activas' },
      { key: 'hits', label: 'Golpes' },
    ],
    foot: `<p><strong>Prueba esto:</strong> golpea con <kbd>J</kbd> en <kbd>1</kbd> (nada) y en <kbd>4</kbd> (todo). La simulación es la misma:
      el puño avanza, toca y vuelve. Después enciende las capas de a una para ver cuánto aporta cada una. El hitstop congela el juego unos
      milisegundos al impactar, un recurso típico de los juegos de pelea. Con 200 ms ya no se percibe como impacto, sino como un tirón.</p>`,

    setup() {
      return { t: -1, hit: false, stopLeft: 0, shake: 0, flash: 0, bagX: 0, bagV: 0, parts: [], hits: 0 };
    },
    update(s, dt, api) {
      const p = api.params;
      if (s.stopLeft > 0) { s.stopLeft -= dt; return; }
      if (api.input.wasPressed('KeyJ', 'Space', 'KeyK') || api.input.padPressed.has(2) || api.input.padPressed.has(0)) {
        if (s.t < 0 || s.t > 0.35) { s.t = 0; s.hit = false; }
      }
      if (s.t >= 0) {
        s.t += dt;
        if (!s.hit && s.t >= 0.12) {
          s.hit = true;
          s.hits++;
          if (p.sound) audio.thud(0.7, 1);
          if (p.parts) burst(s.parts, 560 + s.bagX, 170, { n: 18, speed: 380, life: 0.45, color: 'warn', size: 5, dir: 0, spread: Math.PI * 0.9 });
          if (p.shake) s.shake = 1;
          if (p.flash) s.flash = 1;
          if (p.knock) s.bagV = 420;
          s.stopLeft = p.stop / 1000;
        }
        if (s.t > 0.45) s.t = -1;
      }
      s.bagV += (-60 * s.bagX - 6 * s.bagV) * dt;
      s.bagX += s.bagV * dt;
      stepParticles(s.parts, dt);
      s.shake = Math.max(0, s.shake - dt * 5);
      s.flash = Math.max(0, s.flash - dt * 8);
    },
    render(g, s, api) {
      const c = api.colors;
      const p = api.params;
      g.fillStyle = c.stage;
      g.fillRect(0, 0, api.w, api.h);
      g.save();
      if (s.shake > 0 && !reducedMotion()) g.translate((Math.random() - 0.5) * 16 * s.shake, (Math.random() - 0.5) * 10 * s.shake);
      g.fillStyle = c.surface2;
      g.fillRect(-20, 290, api.w + 40, 90);
      // Saco de boxeo colgando.
      const bx = 600 + s.bagX;
      g.strokeStyle = c.muted;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(600, 0);
      g.lineTo(bx, 80);
      g.stroke();
      roundRect(g, bx - 40, 80, 80, 180, 30);
      g.fillStyle = s.flash > 0 ? '#ffffff' : c.accent3;
      g.fill();
      // Personaje y puño.
      const k = s.t < 0 ? -1 : s.t;
      let ext = 0;
      let lean = 0;
      if (k >= 0) {
        if (k < 0.12) { ext = p.anim ? -0.25 + (k / 0.12) * 1.25 : k / 0.12; lean = p.anim ? -0.1 + k : 0; } else { ext = Math.max(0, 1 - (k - 0.12) / 0.33); lean = p.anim ? 0.12 * ext : 0; }
      }
      g.save();
      g.translate(380, 290);
      g.rotate(lean);
      roundRect(g, -30, -150, 60, 150, 12);
      g.fillStyle = c.accent;
      g.fill();
      const fx = 30 + Math.max(-20, ext * 150);
      const stretch = p.anim && k >= 0 && k < 0.2 ? 1.35 : 1;
      g.strokeStyle = c.accent;
      g.lineWidth = 14;
      g.beginPath();
      g.moveTo(20, -100);
      g.lineTo(fx, -100);
      g.stroke();
      g.fillStyle = c.accent2;
      g.beginPath();
      g.ellipse(fx, -100, 20 * stretch, 20 / stretch, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
      drawParticles(g, s.parts, c);
      g.restore();
      const n = ['anim', 'parts', 'sound', 'shake', 'flash', 'knock'].filter((q) => p[q]).length + (p.stop > 0 ? 1 : 0);
      api.metric('layers', `${n} de 7`);
      api.metric('hits', String(s.hits));
    },
  });
}
