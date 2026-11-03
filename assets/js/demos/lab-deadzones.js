// LAB · Zonas muertas 2D: cómo se filtra un stick analógico antes de llegar al juego.

import { createDemo, text } from '../core/demo.js';
import { deadzone2D, clamp } from '../core/curves.js';

const RAW = { x: 150, y: 190, r: 115 };
const OUT = { x: 420, y: 190, r: 115 };
const ARENA = { x: 590, y: 50, w: 290, h: 280 };

export function mountDeadzones(mount, { id = 'LAB-C3' } = {}) {
  return createDemo({
    mount,
    id,
    title: 'Zonas muertas: filtrar el stick',
    width: 900,
    height: 360,
    hint: 'Arrastra dentro del círculo izquierdo · WASD · gamepad',
    params: [
      { key: 'mode', type: 'select', label: 'Tipo de zona muerta', options: [['none', 'Ninguna'], ['axial', 'Axial (por eje)'], ['radial', 'Radial (sin reescalar)'], ['scaled', 'Radial escalada']], value: 'scaled' },
      { key: 'inner', label: 'Radio interior', min: 0, max: 0.5, step: 0.01, value: 0.2 },
      { key: 'outer', label: 'Radio exterior', min: 0.6, max: 1, step: 0.01, value: 0.95 },
      { heading: 'Stick imperfecto' },
      { key: 'drift', label: 'Deriva en reposo', min: 0, max: 0.3, step: 0.01, value: 0.12, help: 'Los sticks reales no vuelven exactamente al centro. Sin zona muerta, el avatar se arrastra solo.' },
      { key: 'noise', label: 'Ruido', min: 0, max: 0.1, step: 0.005, value: 0.02 },
      { heading: 'Avatar' },
      { key: 'speed', label: 'Velocidad', min: 50, max: 400, step: 10, value: 200, unit: 'px/s' },
    ],
    modes: [
      { key: '1', label: 'Ninguna', values: { mode: 'none' } },
      { key: '2', label: 'Axial', values: { mode: 'axial' } },
      { key: '3', label: 'Radial', values: { mode: 'radial' } },
      { key: '4', label: 'Radial escalada', values: { mode: 'scaled' } },
    ],
    metrics: [
      { key: 'mag', label: 'Magnitud in → out' },
      { key: 'ang', label: 'Desvío angular' },
      { key: 'creep', label: 'Deriva del avatar en reposo' },
    ],
    startMode: '4',
    foot: `<p><strong>Prueba esto:</strong> suelta el stick con <kbd>1</kbd> (sin zona muerta): el avatar se arrastra solo por la deriva.
      Con <kbd>2</kbd> (axial) gira lentamente el stick en círculo: la salida "se pega" a los ejes y las diagonales finas se pierden.
      Con <kbd>3</kbd> (radial) empuja muy despacio desde el centro: la salida salta de 0 a ~0.2 de golpe. <kbd>4</kbd> reescala y elimina ese salto.</p>`,

    setup(api) {
      return {
        driftAngle: Math.random() * Math.PI * 2,
        user: { x: 0, y: 0 },
        raw: { x: 0, y: 0 },
        out: { x: 0, y: 0 },
        trail: [],
        avatar: { x: ARENA.x + ARENA.w / 2, y: ARENA.y + ARENA.h / 2 },
        dragging: false,
        restTime: 0,
        restDist: 0,
      };
    },

    update(s, dt, api) {
      const { input: inp, params: p } = api;
      const m = inp.mouse;
      if (inp.mousePressed && Math.hypot(m.x - RAW.x, m.y - RAW.y) < RAW.r + 20) s.dragging = true;
      if (!m.down) s.dragging = false;

      let ux = 0;
      let uy = 0;
      if (s.dragging) {
        ux = (m.x - RAW.x) / RAW.r;
        uy = (m.y - RAW.y) / RAW.r;
      } else if (inp.pad.connected && Math.hypot(inp.pad.lx, inp.pad.ly) > 0.01) {
        ux = inp.pad.lx;
        uy = inp.pad.ly;
      } else {
        ux = inp.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']);
        uy = inp.axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']);
      }
      const um = Math.hypot(ux, uy);
      if (um > 1) { ux /= um; uy /= um; }
      s.user = { x: ux, y: uy };

      // Deriva + ruido: solo cuando el usuario suelta, el stick "no vuelve" al centro exacto.
      const restWeight = 1 - clamp(um * 3);
      let rx = ux + Math.cos(s.driftAngle) * p.drift * restWeight + (Math.random() * 2 - 1) * p.noise;
      let ry = uy + Math.sin(s.driftAngle) * p.drift * restWeight + (Math.random() * 2 - 1) * p.noise;
      const rm = Math.hypot(rx, ry);
      if (rm > 1) { rx /= rm; ry /= rm; }
      s.raw = { x: rx, y: ry };
      s.out = p.mode === 'none' ? { ...s.raw } : deadzone2D(rx, ry, p.inner, p.outer, p.mode);
      const om = Math.hypot(s.out.x, s.out.y);
      if (om > 1) { s.out.x /= om; s.out.y /= om; }

      s.trail.push([s.raw.x, s.raw.y, s.out.x, s.out.y]);
      if (s.trail.length > 120) s.trail.shift();

      const a = s.avatar;
      const dx = s.out.x * p.speed * dt;
      const dy = s.out.y * p.speed * dt;
      a.x += dx;
      a.y += dy;
      if (a.x < ARENA.x) a.x += ARENA.w;
      if (a.x > ARENA.x + ARENA.w) a.x -= ARENA.w;
      if (a.y < ARENA.y) a.y += ARENA.h;
      if (a.y > ARENA.y + ARENA.h) a.y -= ARENA.h;

      // Mide cuánto se mueve el avatar cuando el usuario no toca nada.
      if (um < 0.01) {
        s.restTime += dt;
        s.restDist += Math.hypot(dx, dy);
      } else {
        s.restTime = 0;
        s.restDist = 0;
      }
    },

    render(g, s, api) {
      const c = api.colors;
      const p = api.params;

      const drawStick = (C, title, vec, trailIdx, showZone) => {
        g.fillStyle = c.surface;
        g.beginPath();
        g.arc(C.x, C.y, C.r, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = c.line;
        g.lineWidth = 1.5;
        g.stroke();
        g.strokeStyle = c.grid;
        g.beginPath();
        g.moveTo(C.x - C.r, C.y); g.lineTo(C.x + C.r, C.y);
        g.moveTo(C.x, C.y - C.r); g.lineTo(C.x, C.y + C.r);
        g.stroke();

        if (showZone && p.mode !== 'none') {
          g.fillStyle = c.bad;
          g.globalAlpha = 0.14;
          const ir = p.inner * C.r;
          if (p.mode === 'axial') {
            g.fillRect(C.x - ir, C.y - C.r, ir * 2, C.r * 2);
            g.fillRect(C.x - C.r, C.y - ir, C.r * 2, ir * 2);
          } else {
            g.beginPath();
            g.arc(C.x, C.y, ir, 0, Math.PI * 2);
            g.fill();
          }
          g.globalAlpha = 1;
          g.strokeStyle = c.warn;
          g.setLineDash([4, 4]);
          g.beginPath();
          g.arc(C.x, C.y, p.outer * C.r, 0, Math.PI * 2);
          g.stroke();
          g.setLineDash([]);
        }

        g.fillStyle = c.accent2;
        s.trail.forEach((t, i) => {
          g.globalAlpha = (i / s.trail.length) * 0.5;
          g.fillRect(C.x + t[trailIdx] * C.r - 1.5, C.y + t[trailIdx + 1] * C.r - 1.5, 3, 3);
        });
        g.globalAlpha = 1;

        g.strokeStyle = c.accent;
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(C.x, C.y);
        g.lineTo(C.x + vec.x * C.r, C.y + vec.y * C.r);
        g.stroke();
        g.fillStyle = c.accent;
        g.beginPath();
        g.arc(C.x + vec.x * C.r, C.y + vec.y * C.r, 9, 0, Math.PI * 2);
        g.fill();
        text(g, title, C.x, C.y - C.r - 14, { align: 'center', size: 13, weight: 600, color: c.text });
      };

      drawStick(RAW, 'Señal cruda del stick', s.raw, 0, true);
      drawStick(OUT, 'Lo que recibe el juego', s.out, 2, false);
      text(g, '→', (RAW.x + OUT.x) / 2, RAW.y + 6, { align: 'center', size: 22 });

      // Arena.
      g.fillStyle = c.surface2;
      g.fillRect(ARENA.x, ARENA.y, ARENA.w, ARENA.h);
      g.strokeStyle = c.line;
      g.strokeRect(ARENA.x + 0.5, ARENA.y + 0.5, ARENA.w, ARENA.h);
      g.fillStyle = c.accent;
      g.beginPath();
      g.arc(s.avatar.x, s.avatar.y, 12, 0, Math.PI * 2);
      g.fill();
      text(g, 'Avatar', ARENA.x + ARENA.w / 2, ARENA.y - 14, { align: 'center', size: 13, weight: 600, color: c.text });

      const mi = Math.hypot(s.raw.x, s.raw.y);
      const mo = Math.hypot(s.out.x, s.out.y);
      api.metric('mag', `${mi.toFixed(2)} → ${mo.toFixed(2)}`);
      if (mi > 0.05 && mo > 0.01) {
        let d = Math.abs(Math.atan2(s.out.y, s.out.x) - Math.atan2(s.raw.y, s.raw.x));
        if (d > Math.PI) d = 2 * Math.PI - d;
        const deg = (d * 180) / Math.PI;
        api.metric('ang', `${deg.toFixed(1)}°`);
        api.metricColor('ang', deg > 10 ? 'bad' : deg > 3 ? 'warn' : 'good');
      } else {
        api.metric('ang', '—');
        api.metricColor('ang', null);
      }
      const creep = s.restTime > 0.3 ? s.restDist / s.restTime : 0;
      api.metric('creep', s.restTime > 0.3 ? `${creep.toFixed(0)} px/s` : 'suelta el stick…');
      api.metricColor('creep', s.restTime > 0.3 ? (creep > 1 ? 'bad' : 'good') : null);
    },
  });
}
