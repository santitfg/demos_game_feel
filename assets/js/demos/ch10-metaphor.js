// EX10-1 · Metáfora: el mismo movimiento con cuatro pieles, y lo que cada una hace esperar.
// Con "Tratamiento coherente" la física se ajusta a lo que la piel promete.

import { createDemo, text, roundRect } from '../core/demo.js';
import { audio } from '../core/audio.js';

const GY = 320;
// Física neutra (la misma para todas las pieles) y la que cada metáfora pide.
const NEUTRAL = { acc: 2000, max: 330, drag: 8, jump: 820, grav: 2400, bounce: 0, canJump: true };
const SKINS = {
  1: { name: 'Cuadrado', place: 'abstracto', phys: NEUTRAL, expect: ['Nada en particular: aceptas cualquier regla.'] },
  2: { name: 'Pelota de goma', place: 'icónico', phys: { ...NEUTRAL, bounce: 0.65, drag: 1.2 }, expect: ['Rebota al caer', 'Sigue rodando al soltar', 'Salta con facilidad'] },
  3: { name: 'Yunque', place: 'icónico', phys: { ...NEUTRAL, acc: 600, max: 140, drag: 10, jump: 380, grav: 4200 }, expect: ['Arranca y frena con esfuerzo', 'Apenas despega del suelo', 'Cae a plomo'] },
  4: { name: 'Auto', place: 'realista', phys: { ...NEUTRAL, acc: 500, max: 420, drag: 0.8, canJump: false }, expect: ['No salta', 'Tarda en acelerar', 'Sigue de largo al soltar'] },
};

export function mountMetaphor(mount, { id = 'EX10-1' } = {}) {
  return createDemo({
    mount,
    id,
    title: 'La misma física, cuatro metáforas',
    width: 900,
    height: 400,
    hint: 'Clic aquí · A/D para moverte · Espacio para saltar',
    params: [
      { key: 'coherent', type: 'check', label: 'Tratamiento coherente con la metáfora', value: false, help: 'Apagado: las cuatro pieles usan exactamente la misma física. Encendido: cada una se comporta como promete.' },
    ],
    modes: Object.entries(SKINS).map(([k, v]) => ({ key: k, label: v.name })),
    metrics: [
      { key: 'skin', label: 'Representación' },
      { key: 'phys', label: 'Física' },
      { key: 'match', label: 'Expectativas cumplidas' },
    ],
    foot: `<p><strong>Prueba esto:</strong> con el tratamiento coherente apagado, pasa por las cuatro pieles. En el cuadrado todo parece
      correcto, porque no promete nada. El yunque que da saltos de un metro y el auto que salta se ven <em>mal</em>, aunque la física sea
      la misma que en el cuadrado. Enciende el tratamiento coherente y cada piel se mueve como su metáfora pide. Es la cata a ciegas del
      libro: con la etiqueta a la vista, lo que esperamos cambia lo que percibimos.</p>`,

    setup() {
      return { x: 200, vx: 0, y: GY, vy: 0, ground: true, rot: 0, tried: { jump: false, release: false } };
    },
    update(s, dt, api) {
      const inp = api.input;
      const skin = SKINS[api.mode];
      const ph = api.params.coherent ? skin.phys : NEUTRAL;
      const ax = inp.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']);
      s.vx += ax * ph.acc * dt;
      s.vx *= Math.exp(-(ax ? 0 : ph.drag) * dt);
      s.vx = Math.max(-ph.max, Math.min(ph.max, s.vx));
      if (inp.wasPressed('Space', 'KeyW', 'ArrowUp')) {
        s.tried.jump = true;
        if (s.ground && ph.canJump) { s.vy = -ph.jump; s.ground = false; audio.tone({ freq: api.mode === '3' ? 120 : 380, dur: 0.1, type: 'triangle', gain: 0.15, slide: 1.6 }); }
      }
      if (!ax && Math.abs(s.vx) > 20) s.tried.release = true;
      s.vy += ph.grav * dt;
      s.y += s.vy * dt;
      if (s.y >= GY) {
        s.y = GY;
        if (s.vy > 300 && ph.bounce > 0) { s.vy = -s.vy * ph.bounce; audio.tone({ freq: 300, dur: 0.08, type: 'sine', gain: 0.15, slide: 1.3 }); } else {
          if (!s.ground) audio.thud(api.mode === '3' ? 1 : 0.3, Math.min(1, s.vy / 900));
          s.vy = 0;
          s.ground = true;
        }
      }
      s.x += s.vx * dt;
      if (s.x < 40) { s.x = 40; s.vx = 0; }
      if (s.x > api.w - 40) { s.x = api.w - 40; s.vx = 0; }
      s.rot += (s.vx / 28) * dt;
    },
    render(g, s, api) {
      const c = api.colors;
      const skin = SKINS[api.mode];
      g.fillStyle = c.stage;
      g.fillRect(0, 0, api.w, api.h);
      g.fillStyle = c.surface2;
      g.fillRect(0, GY, api.w, api.h - GY);
      drawSkin(g, api.mode, s, c);

      // Expectativas de la piel frente a lo que hace.
      const coherent = api.params.coherent;
      const ph = coherent ? skin.phys : NEUTRAL;
      const checks = expectationChecks(api.mode, ph);
      roundRect(g, api.w - 300, 16, 284, 30 + checks.length * 20, 8);
      g.fillStyle = c.surface;
      g.fill();
      text(g, `${skin.name} (${skin.place}) hace esperar:`, api.w - 288, 36, { size: 12, weight: 700, color: c.text });
      checks.forEach(([label, ok], i) => text(g, `${ok ? '✓' : '✗'} ${label}`, api.w - 288, 58 + i * 20, { size: 12, color: ok ? c.good : c.bad }));
      const n = checks.filter(([, ok]) => ok).length;
      api.metric('skin', skin.name);
      api.metric('phys', coherent ? 'la de su metáfora' : 'neutra (idéntica)');
      api.metric('match', `${n} de ${checks.length}`);
      api.metricColor('match', n === checks.length ? 'good' : 'bad');
    },
  });
}

function expectationChecks(mode, ph) {
  if (mode === '1') return [['Nada en particular: cualquier regla vale', true]];
  if (mode === '2') return [['Rebota al caer', ph.bounce > 0], ['Sigue rodando al soltar', ph.drag < 3], ['Salta con facilidad', ph.jump > 600]];
  if (mode === '3') return [['Arranca y frena con esfuerzo', ph.acc < 1000], ['Apenas despega del suelo', ph.jump < 500], ['Cae a plomo', ph.grav > 3000]];
  return [['No salta', !ph.canJump], ['Tarda en acelerar', ph.acc < 1000], ['Sigue de largo al soltar', ph.drag < 3]];
}

function drawSkin(g, mode, s, c) {
  const x = s.x;
  const y = s.y;
  if (mode === '1') {
    g.fillStyle = c.accent;
    g.fillRect(x - 22, y - 44, 44, 44);
  } else if (mode === '2') {
    g.save();
    g.translate(x, y - 24);
    g.rotate(s.rot);
    g.fillStyle = '#d94a3d';
    g.beginPath();
    g.arc(0, 0, 24, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#f2d16b';
    g.lineWidth = 4;
    g.beginPath();
    g.arc(0, 0, 16, 0.3, 2.4);
    g.stroke();
    g.restore();
  } else if (mode === '3') {
    g.fillStyle = '#4a4f57';
    g.beginPath();
    g.moveTo(x - 46, y - 44);
    g.lineTo(x + 30, y - 44);
    g.quadraticCurveTo(x + 52, y - 40, x + 54, y - 30);
    g.lineTo(x + 18, y - 28);
    g.lineTo(x + 14, y - 14);
    g.lineTo(x + 26, y);
    g.lineTo(x - 30, y);
    g.lineTo(x - 18, y - 14);
    g.lineTo(x - 22, y - 30);
    g.lineTo(x - 46, y - 34);
    g.closePath();
    g.fill();
    g.fillStyle = '#6b717b';
    g.fillRect(x - 46, y - 44, 76, 4);
  } else {
    const dir = s.vx < -5 ? -1 : 1;
    g.save();
    g.translate(x, y);
    g.scale(dir, 1);
    g.fillStyle = c.accent;
    roundRect(g, -60, -34, 120, 24, 8);
    g.fill();
    roundRect(g, -30, -54, 56, 24, 8);
    g.fill();
    g.fillStyle = '#2a3440';
    g.fillRect(-22, -49, 18, 15);
    g.fillRect(2, -49, 18, 15);
    g.fillStyle = '#111';
    for (const wx of [-36, 36]) {
      g.beginPath();
      g.arc(wx, -10, 12, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }
}
