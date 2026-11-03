// LAB · Lag elegido frente a lag impuesto (cap. 2: el golpe fuerte de Zangief bloquea ~750 ms y no molesta).
// Tres versiones del mismo bloqueo de control: elegido y animado, elegido sin animación, impuesto al azar.

import { createDemo, text, roundRect } from '../core/demo.js';
import { audio } from '../core/audio.js';
import { reducedMotion } from '../core/theme.js';

const GY = 330;
const W = 40;
const H = 64;
const RUN = 330;
const PUNCH_KEYS = ['KeyJ', 'KeyK', 'Space'];
const QUICK = 120; // ms del golpe rápido en el modo 3

export function mountLagChosen(mount, { id = 'LAB-L7' } = {}) {
  return createDemo({
    mount,
    id,
    title: 'Lag elegido frente a lag impuesto',
    width: 900,
    height: 420,
    hint: 'Clic aquí · A/D o ←/→ para moverte · J o Espacio para golpear',
    params: [
      { key: 'lock', label: 'Duración del bloqueo', min: 200, max: 1500, step: 10, value: 750, unit: 'ms' },
      { key: 'every', label: 'Modo 3: un congelamiento cada', min: 1.5, max: 8, step: 0.5, value: 3.5, unit: 's' },
      { key: 'drops', label: 'Peligros por minuto', min: 10, max: 60, step: 1, value: 30 },
    ],
    modes: [
      { key: '1', label: 'Golpe pesado (elegido)' },
      { key: '2', label: 'Golpe sin animación' },
      { key: '3', label: 'Congelamiento impuesto' },
    ],
    onModeChange(key, s, api) { if (s?.crates) api.reset(); },
    metrics: [
      { key: 'crates', label: 'Cajas rotas' },
      { key: 'hits', label: 'Golpes recibidos' },
      { key: 'locked', label: 'Tiempo sin control' },
      { key: 'who', label: 'Quién decidió el bloqueo' },
    ],
    foot: `<p><strong>Prueba esto:</strong> juega un rato con cada modo. En los tres pierdes el control durante el mismo tiempo (750 ms,
      el triple de un ciclo de corrección), pero en <kbd>1</kbd> lo decides tú, lo ves venir y tiene sentido: un golpe enorme que tarda en
      cargarse. En <kbd>2</kbd> el bloqueo es el mismo, pero sin animación que lo explique: se siente como un fallo del juego. En <kbd>3</kbd>
      el golpe es rápido, pero el sistema te congela cuando quiere. Mira cuánto tiempo pasas sin control en cada modo y pregúntate cuál
      <em>te molestó</em>.</p>`,

    setup(api) {
      return {
        x: api.w / 2, face: 1,
        crates: [], drops: [], dropIn: 1.5,
        broken: 0, hits: 0,
        lockLeft: 0, lockTotal: 0, lockKind: null, // 'punch' | 'freeze'
        punchT: -1, punchDur: 0, struck: false,
        freezeIn: nextFreeze(api.params.every),
        lockedTime: 0, playTime: 0,
        shake: 0, hurt: 0, particles: [],
      };
    },

    update(s, dt, api) {
      const p = api.params;
      const inp = api.input;
      const mode = api.mode;
      s.playTime += dt;

      // Congelamientos impuestos (modo 3): sin aviso.
      if (mode === '3') {
        s.freezeIn -= dt;
        if (s.freezeIn <= 0 && s.lockLeft <= 0) {
          s.lockLeft = s.lockTotal = p.lock / 1000;
          s.lockKind = 'freeze';
          s.freezeIn = nextFreeze(p.every);
        }
      }

      if (s.lockLeft > 0) {
        s.lockLeft -= dt;
        s.lockedTime += dt;
      } else {
        s.lockKind = null;
        const ax = inp.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']) + (Math.abs(inp.pad.lx) > 0.25 ? Math.sign(inp.pad.lx) : 0);
        if (ax) s.face = Math.sign(ax);
        s.x = Math.max(W, Math.min(api.w - W, s.x + Math.max(-1, Math.min(1, ax)) * RUN * dt));
        if (inp.wasPressed(...PUNCH_KEYS) || inp.padPressed.has(2) || inp.padPressed.has(0)) {
          const dur = mode === '3' ? QUICK / 1000 : p.lock / 1000;
          s.punchT = 0;
          s.punchDur = dur;
          s.struck = false;
          if (mode !== '3') {
            s.lockLeft = s.lockTotal = dur;
            s.lockKind = 'punch';
          }
          if (mode === '1') audio.tone({ freq: 140, dur: Math.min(0.35, dur * 0.35), type: 'sawtooth', gain: 0.06, slide: 1.6 });
        }
      }

      // Golpe: carga (35 %), impacto, recuperación.
      if (s.punchT >= 0) {
        s.punchT += dt;
        const k = s.punchT / s.punchDur;
        if (!s.struck && k >= (mode === '3' ? 0.3 : 0.35)) {
          s.struck = true;
          // Alcance = lo que se dibuja: brazo + puño + media caja.
          const reach = W / 2 + (mode === '3' ? 60 : 103) + 20;
          const hitCrates = s.crates.filter((cr) => (cr.x - s.x) * s.face > 0 && Math.abs(cr.x - s.x) < reach);
          for (const cr of hitCrates) {
            cr.dead = true;
            s.broken++;
            if (mode !== '2') {
              for (let i = 0; i < 10; i++) s.particles.push({ x: cr.x, y: GY - 20, vx: (Math.random() - 0.3) * 400 * s.face, vy: -200 - Math.random() * 300, life: 0.6 });
            }
          }
          if (mode === '1') {
            s.shake = 1;
            audio.thud(0.9, 1);
          } else if (mode === '2') {
            if (hitCrates.length) audio.blip(500);
          } else {
            audio.thud(0.2, 0.6);
          }
        }
        if (k >= 1) s.punchT = -1;
      }
      s.crates = s.crates.filter((cr) => !cr.dead);
      if (s.crates.length < 2) {
        let x;
        do { x = 60 + Math.random() * (api.w - 120); } while (Math.abs(x - s.x) < 120);
        s.crates.push({ x });
      }

      // Peligros que caen, con sombra de aviso.
      s.dropIn -= dt;
      if (s.dropIn <= 0) {
        s.drops.push({ x: Math.max(30, Math.min(api.w - 30, s.x + (Math.random() - 0.5) * 360)), y: -20, vy: 0, t: 0 });
        s.dropIn = (60 / p.drops) * (0.6 + Math.random() * 0.8);
      }
      for (const d of s.drops) {
        d.t += dt;
        if (d.t > 0.55) {
          d.vy += 1500 * dt;
          d.y += d.vy * dt;
        }
        if (!d.gone && d.y > GY - H && Math.abs(d.x - s.x) < W / 2 + 12) {
          d.gone = true;
          s.hits++;
          s.hurt = 1;
          audio.tone({ freq: 220, dur: 0.15, type: 'square', gain: 0.07, slide: 0.6 });
        }
      }
      s.drops = s.drops.filter((d) => !d.gone && d.y <= GY);

      for (const pt of s.particles) {
        pt.vy += 1400 * dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.life -= dt;
      }
      s.particles = s.particles.filter((pt) => pt.life > 0);
      s.shake = Math.max(0, s.shake - dt * 4);
      s.hurt = Math.max(0, s.hurt - dt * 3);
    },

    render(g, s, api) {
      const c = api.colors;
      const mode = api.mode;
      g.fillStyle = c.stage;
      g.fillRect(0, 0, api.w, api.h);
      g.save();
      if (s.shake > 0 && !reducedMotion()) g.translate((Math.random() - 0.5) * 12 * s.shake, (Math.random() - 0.5) * 8 * s.shake);

      g.fillStyle = c.surface2;
      g.fillRect(-20, GY, api.w + 40, api.h - GY + 20);
      g.fillStyle = c.line;
      g.fillRect(-20, GY, api.w + 40, 2);

      for (const cr of s.crates) {
        g.fillStyle = c.accent3;
        g.fillRect(cr.x - 20, GY - 40, 40, 40);
        g.strokeStyle = c.stage;
        g.lineWidth = 2;
        g.strokeRect(cr.x - 14, GY - 34, 28, 28);
      }
      for (const d of s.drops) {
        // Sombra de aviso que crece mientras cae.
        g.fillStyle = c.text;
        g.globalAlpha = 0.12 + Math.min(0.25, d.y / GY / 3);
        g.beginPath();
        g.ellipse(d.x, GY + 4, 14, 4, 0, 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = 1;
        g.fillStyle = c.bad;
        g.beginPath();
        g.moveTo(d.x, d.y + 14);
        g.lineTo(d.x - 11, d.y - 8);
        g.lineTo(d.x + 11, d.y - 8);
        g.closePath();
        g.fill();
      }

      // Personaje.
      let lean = 0;
      let arm = 0;
      if (s.punchT >= 0 && mode !== '2') {
        const k = s.punchT / s.punchDur;
        const wind = 0.35;
        if (k < wind) { lean = -(k / wind); arm = -0.3 * (k / wind); } else if (k < wind + 0.12) { lean = 0.6; arm = 1; } else { const r = (k - wind - 0.12) / (1 - wind - 0.12); lean = 0.6 * (1 - r); arm = 1 - r; }
        if (mode === '3') arm = Math.max(arm, 0) * 0.7;
      }
      g.save();
      g.translate(s.x, GY);
      g.scale(s.face, 1);
      g.rotate(lean * 0.18);
      roundRect(g, -W / 2, -H, W, H, 8);
      g.fillStyle = s.hurt > 0 ? c.bad : c.accent;
      g.fill();
      g.fillStyle = c.stage;
      g.fillRect(6, -H + 14, 7, 7);
      if (mode !== '2' && s.punchT >= 0) {
        const reach = mode === '3' ? 50 : 80;
        const ex = W / 2 + Math.max(0, arm) * reach + (arm < 0 ? arm * 30 : 0);
        const fist = mode === '1' ? 15 + 8 * Math.max(0, arm) : 10;
        g.strokeStyle = c.accent;
        g.lineWidth = 8;
        g.beginPath();
        g.moveTo(W / 2 - 6, -H * 0.55);
        g.lineTo(ex, -H * 0.55);
        g.stroke();
        g.fillStyle = c.accent2;
        g.beginPath();
        g.arc(ex, -H * 0.55, fist, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();

      for (const pt of s.particles) {
        g.fillStyle = c.accent3;
        g.globalAlpha = Math.max(0, pt.life / 0.6);
        g.fillRect(pt.x - 3, pt.y - 3, 6, 6);
      }
      g.globalAlpha = 1;
      g.restore();

      // Barra de control: solo informativa; en el modo 3 el aviso llega cuando ya te congelaste.
      if (s.lockLeft > 0) {
        const k = Math.max(0, s.lockLeft / s.lockTotal);
        g.fillStyle = s.lockKind === 'freeze' ? c.bad : c.muted;
        g.fillRect(s.x - 30, GY - H - 22, 60 * k, 5);
        if (s.lockKind === 'freeze') text(g, 'sin control', s.x, GY - H - 30, { align: 'center', size: 11, color: c.bad, weight: 600 });
      }

      api.metric('crates', String(s.broken));
      api.metric('hits', String(s.hits));
      api.metric('locked', s.playTime > 0 ? `${Math.round((s.lockedTime / s.playTime) * 100)} %` : '—');
      api.metric('who', mode === '3' ? 'el sistema' : 'tú');
    },
  });
}

const nextFreeze = (every) => every * (0.6 + Math.random() * 0.8);
