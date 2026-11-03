// LAB · "El movimiento manda" (cap. 1): apariencia, sonido y movimiento por separado.
// Cuando las pistas se contradicen, el jugador cree al movimiento.

import { createDemo } from '../core/demo.js';
import { audio } from '../core/audio.js';
import { reducedMotion } from '../core/theme.js';
import { createBody, grab, stepWorld, VelocityTracker, spawnDust, stepDust, drawDust, Shake, withSquash } from './shared/bodies.js';

const BOUNDS = { x: 10, y: 10, w: 880, h: 400 };
const R = 22;
const MOTION = {
  heavy: { m: 6, rest: 0.08, drag: 0.5 },
  light: { m: 0.05, rest: 0.88, drag: 1.6 },
};
const LABELS = {
  look: { bowling: 'Bola de bolos', pingpong: 'Ping-pong', neutral: 'Círculo neutro' },
  sound: { low: 'Grave', high: 'Agudo', none: 'Sin sonido' },
  motion: { heavy: 'Pesado', light: 'Liviano' },
};

export function mountMotionWins(mount, { id = 'LAB-M3' } = {}) {
  const api = createDemo({
    mount,
    id,
    title: 'Apariencia, sonido o movimiento: ¿quién manda?',
    width: 900,
    height: 420,
    hint: 'Agarra la bola y lánzala contra las latas',
    params: [
      { key: 'look', type: 'select', label: 'Apariencia', options: Object.entries(LABELS.look), value: 'bowling' },
      { key: 'sound', type: 'select', label: 'Sonido', options: Object.entries(LABELS.sound), value: 'low' },
      { key: 'motion', type: 'select', label: 'Movimiento (física)', options: Object.entries(LABELS.motion), value: 'heavy' },
      { heading: 'Pulido' },
      { key: 'shadow', type: 'check', label: 'Sombra', value: true },
      { key: 'squash', type: 'check', label: 'Squash', value: true },
      { key: 'shake', type: 'check', label: 'Temblor de cámara', value: false },
      { key: 'dust', type: 'check', label: 'Polvo', value: true },
      { key: 'massGrab', type: 'check', label: 'El agarre respeta la masa', value: true, help: 'Si lo apagas, la bola es el cursor mientras la arrastras y la masa solo aparece al soltar.' },
    ],
    modes: [
      { key: '1', label: 'Bolos coherente', values: { look: 'bowling', sound: 'low', motion: 'heavy' } },
      { key: '2', label: 'Ping-pong coherente', values: { look: 'pingpong', sound: 'high', motion: 'light' } },
      { key: '3', label: 'Bolos que vuela', values: { look: 'bowling', sound: 'low', motion: 'light' } },
      { key: '4', label: 'Ping-pong que arrasa', values: { look: 'pingpong', sound: 'high', motion: 'heavy' } },
      { key: '5', label: 'Solo movimiento', values: { look: 'neutral', sound: 'none', motion: 'heavy' } },
    ],
    foot: `<p><strong>Prueba esto:</strong> juega con <kbd>3</kbd> y <kbd>4</kbd>, donde las pistas se contradicen, y califica cuánto pesa la bola.
      Al final compara tus respuestas con las columnas: la que mejor las predice suele ser <em>Movimiento</em>.
      <kbd>R</kbd> reacomoda las latas.</p>
      <div class="rating" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:8px">
        <strong style="color:var(--text)">¿Cuánto pesa la bola?</strong>
        <button type="button" class="btn small" data-rate="Liviana">Liviana</button>
        <button type="button" class="btn small" data-rate="Media">Media</button>
        <button type="button" class="btn small" data-rate="Pesada">Pesada</button>
      </div>
      <div class="table-scroll"><table class="ratings" hidden>
        <thead><tr><th>Apariencia</th><th>Sonido</th><th>Movimiento</th><th>Tu respuesta</th></tr></thead><tbody></tbody>
      </table></div>`,

    setup(a) {
      const ball = createBody({ x: 140, y: 210, r: R, ...MOTION[a.params.motion], ball: true, spin: 0 });
      const cans = [];
      for (let row = 0; row < 3; row++) {
        for (let i = 0; i <= row; i++) {
          cans.push(createBody({ x: 700 + row * 30, y: 210 - row * 16 + i * 32, r: 14, m: 0.25, rest: 0.5, drag: 2.2 }));
        }
      }
      return { ball, bodies: [ball, ...cans], held: null, tracker: new VelocityTracker(0.06), dust: [], shake: new Shake(), lastSound: 0 };
    },

    update(s, dt, a) {
      const { input: inp, params: p } = a;
      Object.assign(s.ball, MOTION[p.motion]);
      const m = inp.mouse;
      s.tracker.push(a.time, m.x, m.y);
      const cv = s.tracker.get();
      if (inp.mousePressed && Math.hypot(s.ball.x - m.x, s.ball.y - m.y) < R + 10) s.held = s.ball;
      if (s.held && !m.down) { s.held.rigid = false; s.held = null; }
      if (s.held) {
        const mode = p.massGrab ? 'force' : 'rigid';
        s.held.rigid = mode === 'rigid';
        grab(s.held, m.x, m.y, mode, { k: 600, zeta: 0.85, maxForce: 6000 }, dt, cv);
      }
      stepWorld(s.bodies, BOUNDS, dt, {
        held: s.held,
        onImpact: (x, y, speed, nx, ny) => {
          if (speed < 50) return;
          const involvesBall = x.ball || y?.ball;
          if (involvesBall && p.sound !== 'none' && a.time - s.lastSound > 0.04) {
            const i = Math.min(1, speed / 900);
            if (p.sound === 'low') audio.thud(0.95, i);
            else {
              audio.tone({ freq: 2200, dur: 0.04, type: 'triangle', gain: 0.25 * i });
              audio.noise({ dur: 0.03, gain: 0.12 * i, freq: 5000, type: 'highpass' });
            }
            s.lastSound = a.time;
          } else if (!involvesBall && speed > 80) {
            audio.tone({ freq: 900 + Math.random() * 300, dur: 0.05, type: 'square', gain: 0.04 });
          }
          if (involvesBall && p.shake && !reducedMotion()) s.shake.add(Math.min(0.5, (speed / 2000) * (p.motion === 'heavy' ? 1 : 0.2)));
          if (involvesBall && p.dust && speed > 120) spawnDust(s.dust, x.x - nx * x.r, x.y - ny * x.r, nx, ny, 6, 60 + speed * 0.15);
        },
      });
      s.ball.spin += (Math.hypot(s.ball.vx, s.ball.vy) * dt) / R * Math.sign(s.ball.vx || 1);
      stepDust(s.dust, dt);
      s.shake.step(dt);
    },

    render(g, s, a) {
      const c = a.colors;
      const p = a.params;
      const off = s.shake.offset();
      g.save();
      g.translate(off.x, off.y);
      g.fillStyle = c.surface2;
      g.fillRect(BOUNDS.x, BOUNDS.y, BOUNDS.w, BOUNDS.h);
      g.strokeStyle = c.line;
      g.lineWidth = 2;
      g.strokeRect(BOUNDS.x, BOUNDS.y, BOUNDS.w, BOUNDS.h);
      drawDust(g, s.dust, c.muted);

      for (const b of s.bodies) {
        if (p.shadow) {
          g.fillStyle = 'rgba(0,0,0,0.2)';
          g.beginPath();
          g.ellipse(b.x + 3, b.y + 5, b.r, b.r * 0.85, 0, 0, Math.PI * 2);
          g.fill();
        }
        withSquash(g, b, p.squash, () => (b.ball ? drawBall(g, p.look, s.ball.spin, c) : drawCan(g, b, c)));
      }
      g.restore();
      a.hud(`${LABELS.look[p.look]} · sonido ${LABELS.sound[p.sound].toLowerCase()} · física ${LABELS.motion[p.motion].toLowerCase()}`);
    },
  });

  // Calificaciones del usuario: solo en esta sesión, para comparar columnas.
  const table = api.fig.querySelector('table.ratings');
  api.fig.querySelectorAll('[data-rate]').forEach((btn) => btn.addEventListener('click', () => {
    const p = api.params;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${LABELS.look[p.look]}</td><td>${LABELS.sound[p.sound]}</td><td>${LABELS.motion[p.motion]}</td><td><strong>${btn.dataset.rate}</strong></td>`;
    table.tBodies[0].prepend(tr);
    while (table.tBodies[0].rows.length > 12) table.tBodies[0].lastChild.remove();
    table.hidden = false;
  }));
  return api;
}

function drawBall(g, look, spin, c) {
  if (look === 'bowling') {
    const grd = g.createRadialGradient(-7, -8, 2, 0, 0, R);
    grd.addColorStop(0, '#5b6a8a');
    grd.addColorStop(0.5, '#262c3d');
    grd.addColorStop(1, '#0d0f16');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(0, 0, R, 0, Math.PI * 2);
    g.fill();
    g.rotate(spin);
    g.fillStyle = '#05060a';
    for (const [hx, hy] of [[-4, -8], [4, -8], [0, 2]]) {
      g.beginPath();
      g.arc(hx, hy, 2.6, 0, Math.PI * 2);
      g.fill();
    }
  } else if (look === 'pingpong') {
    const grd = g.createRadialGradient(-7, -8, 2, 0, 0, R);
    grd.addColorStop(0, '#ffffff');
    grd.addColorStop(0.7, '#f3efe4');
    grd.addColorStop(1, '#d8d0bd');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(0, 0, R, 0, Math.PI * 2);
    g.fill();
    g.rotate(spin);
    g.strokeStyle = '#e2531f';
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(0, 0, R * 0.55, -0.6, 0.6);
    g.stroke();
  } else {
    g.fillStyle = c.accent;
    g.beginPath();
    g.arc(0, 0, R, 0, Math.PI * 2);
    g.fill();
  }
}

function drawCan(g, b, c) {
  g.fillStyle = c.muted;
  g.beginPath();
  g.arc(0, 0, b.r, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = c.surface;
  g.lineWidth = 2;
  g.beginPath();
  g.arc(0, 0, b.r * 0.6, 0, Math.PI * 2);
  g.stroke();
}
