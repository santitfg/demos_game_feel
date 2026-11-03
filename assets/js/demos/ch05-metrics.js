// CH05-1 · Teclado o stick analógico: el mismo objeto recorriendo una pista sinuosa.
// CH05-2 · El mismo sistema con cinco sets de pulido distintos.

import { createDemo, text, drawGrid, roundRect } from '../core/demo.js';
import { audio } from '../core/audio.js';
import { reducedMotion } from '../core/theme.js';
import { burst, stepParticles, drawParticles } from './shared/physics2d.js';

// ---------------- CH05-1 ----------------
const TRACK_W = 56;
const TRACK = (() => {
  const pts = [];
  for (let i = 0; i < 480; i++) {
    const t = (i / 480) * Math.PI * 2;
    pts.push({ x: 430 + Math.cos(t) * 300 + Math.cos(3 * t) * 50, y: 220 + Math.sin(t) * 150 + Math.sin(2 * t) * 45 });
  }
  return pts;
})();
const STICK = { x: 820, y: 380, r: 52 };

export function mountInputCompare(mount, { id = 'CH05-1' } = {}) {
  return createDemo({
    mount,
    id,
    title: 'Teclado o stick analógico',
    width: 900,
    height: 460,
    hint: 'Clic aquí · teclado: W A S D · analógico: stick del gamepad o arrastrar el mouse',
    params: [
      { key: 'speed', label: 'Velocidad máxima', min: 80, max: 500, step: 10, value: 260, unit: 'px/s' },
    ],
    modes: [
      { key: '1', label: 'Teclado (digital)' },
      { key: '2', label: 'Stick (analógico)' },
    ],
    onModeChange(k, s) { if (s?.dirs) { s.dirs.clear(); s.speeds.clear(); s.onT = 0; s.total = 0; } },
    metrics: [
      { key: 'on', label: 'Tiempo dentro de la pista' },
      { key: 'laps', label: 'Vueltas' },
      { key: 'dirs', label: 'Direcciones usadas' },
      { key: 'speeds', label: 'Velocidades usadas' },
    ],
    foot: `<p><strong>Prueba esto:</strong> da una vuelta en <kbd>1</kbd> y otra en <kbd>2</kbd>. Con teclado solo existen 8 direcciones y
      dos velocidades (parado o a fondo): las curvas se toman en escalones. Con el stick, o arrastrando el mouse como si fuera uno, hay cientos de
      direcciones y velocidades, y la pista se recorre en una línea continua. El sistema es el mismo; lo que cambió es la
      <em>sensibilidad del input</em>.</p>`,

    setup() {
      return { x: TRACK[0].x, y: TRACK[0].y, vx: 0, vy: 0, idx: 0, laps: 0, prog: 0, onT: 0, total: 0, dirs: new Set(), speeds: new Set(), trail: [], drag: null, stick: { x: 0, y: 0 } };
    },
    update(s, dt, api) {
      const inp = api.input;
      let ix = 0;
      let iy = 0;
      if (api.mode === '1') {
        ix = inp.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']);
        iy = inp.axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']);
        const l = Math.hypot(ix, iy);
        if (l > 1) { ix /= l; iy /= l; }
      } else if (inp.pad.connected && Math.hypot(inp.pad.lx, inp.pad.ly) > 0.12) {
        ix = inp.pad.lx;
        iy = inp.pad.ly;
      } else if (inp.mouse.down) {
        // Stick virtual: el punto donde se apretó es el centro.
        if (!s.drag) s.drag = { x: inp.mouse.x, y: inp.mouse.y };
        ix = (inp.mouse.x - s.drag.x) / STICK.r;
        iy = (inp.mouse.y - s.drag.y) / STICK.r;
        const l = Math.hypot(ix, iy);
        if (l > 1) { ix /= l; iy /= l; }
      }
      if (!inp.mouse.down) s.drag = null;
      s.stick = { x: ix, y: iy };
      const k = 1 - Math.exp(-dt / 0.05);
      s.vx += (ix * api.params.speed - s.vx) * k;
      s.vy += (iy * api.params.speed - s.vy) * k;
      s.x = Math.max(0, Math.min(api.w, s.x + s.vx * dt));
      s.y = Math.max(0, Math.min(api.h, s.y + s.vy * dt));

      // Distancia a la pista y avance por los puntos.
      let best = Infinity;
      let bi = s.idx;
      for (let o = -30; o <= 30; o++) {
        const i = (s.idx + o + TRACK.length) % TRACK.length;
        const d = Math.hypot(TRACK[i].x - s.x, TRACK[i].y - s.y);
        if (d < best) { best = d; bi = i; }
      }
      if (best < TRACK_W) {
        const step = (bi - s.idx + TRACK.length) % TRACK.length;
        if (step > 0 && step < 40) s.prog += step;
        s.idx = bi;
        if (s.prog >= TRACK.length) { s.prog -= TRACK.length; s.laps++; audio.blip(1100); }
      }
      const mag = Math.hypot(ix, iy);
      if (mag > 0.1) {
        s.total += dt;
        if (best < TRACK_W / 2) s.onT += dt;
        s.dirs.add(Math.round(((Math.atan2(iy, ix) + Math.PI) / (Math.PI * 2)) * 72));
        s.speeds.add(Math.round(mag * 20));
      }
      s.trail.push({ x: s.x, y: s.y });
      if (s.trail.length > 360) s.trail.shift();
      s.best = best;
    },
    render(g, s, api) {
      const c = api.colors;
      g.fillStyle = c.stage;
      g.fillRect(0, 0, api.w, api.h);
      g.lineJoin = 'round';
      g.strokeStyle = c.surface2;
      g.lineWidth = TRACK_W;
      g.beginPath();
      TRACK.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
      g.closePath();
      g.stroke();
      g.strokeStyle = c.grid;
      g.lineWidth = 1;
      g.setLineDash([6, 8]);
      g.stroke();
      g.setLineDash([]);
      // Estela.
      g.strokeStyle = c.accent2;
      g.lineWidth = 2;
      g.beginPath();
      s.trail.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
      g.stroke();
      g.fillStyle = s.best < TRACK_W / 2 ? c.accent : c.bad;
      g.beginPath();
      g.arc(s.x, s.y, 11, 0, Math.PI * 2);
      g.fill();

      // Indicador del input.
      g.fillStyle = c.surface;
      g.beginPath();
      g.arc(STICK.x, STICK.y, STICK.r + 8, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = c.line;
      g.lineWidth = 1;
      if (api.mode === '1') {
        g.strokeRect(STICK.x - STICK.r, STICK.y - STICK.r, STICK.r * 2, STICK.r * 2);
        for (let a = 0; a < 8; a++) {
          g.fillStyle = c.grid;
          g.beginPath();
          g.arc(STICK.x + Math.cos((a * Math.PI) / 4) * STICK.r * 0.8, STICK.y + Math.sin((a * Math.PI) / 4) * STICK.r * 0.8, 3, 0, Math.PI * 2);
          g.fill();
        }
      } else {
        g.beginPath();
        g.arc(STICK.x, STICK.y, STICK.r, 0, Math.PI * 2);
        g.stroke();
      }
      g.fillStyle = c.accent;
      g.beginPath();
      g.arc(STICK.x + s.stick.x * STICK.r, STICK.y + s.stick.y * STICK.r, 9, 0, Math.PI * 2);
      g.fill();
      text(g, api.mode === '1' ? '8 direcciones × 2 estados' : 'continuo', STICK.x, STICK.y - STICK.r - 14, { size: 11, align: 'center' });

      api.metric('on', s.total ? `${Math.round((s.onT / s.total) * 100)} %` : '—');
      api.metric('laps', String(s.laps));
      api.metric('dirs', String(s.dirs.size));
      api.metric('speeds', String(s.speeds.size));
    },
  });
}

// ---------------- CH05-2 ----------------
const GY = 340;
const PLATS = [{ x: 180, y: 250, w: 140 }, { x: 420, y: 190, w: 120 }, { x: 640, y: 260, w: 160 }];
const SETS = [
  { key: '1', label: 'Sin pulido' },
  { key: '2', label: 'Dibujo animado' },
  { key: '3', label: 'Pesado' },
  { key: '4', label: 'Gelatina' },
  { key: '5', label: 'Ciencia ficción' },
];

export function mountPolishSets(mount, { id = 'CH05-2' } = {}) {
  return createDemo({
    mount,
    id,
    title: 'El mismo sistema, cinco pulidos',
    width: 900,
    height: 420,
    hint: 'Clic aquí · A/D o ←/→ para moverte · Espacio o W para saltar',
    modes: SETS,
    metrics: [
      { key: 'phys', label: 'Física' },
      { key: 'vx', label: 'Velocidad horizontal' },
      { key: 'vy', label: 'Velocidad vertical' },
    ],
    foot: `<p><strong>Prueba esto:</strong> salta sobre las plataformas con cada set, <kbd>1</kbd> a <kbd>5</kbd>. Los números de abajo son
      idénticos: la misma aceleración, gravedad y altura de salto. Pero en <kbd>3</kbd> el bloque parece pesar el triple que en <kbd>2</kbd>,
      y en <kbd>4</kbd> parece blando. Nada de eso está en la simulación: lo agrega el pulido.</p>`,

    setup() {
      return { x: 80, y: GY, vx: 0, vy: 0, ground: true, sq: 0, sqv: 0, parts: [], shake: 0, trail: [], t: 0, glow: 0 };
    },
    update(s, dt, api) {
      const inp = api.input;
      const set = api.mode;
      const ax = inp.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']) + (Math.abs(inp.pad.lx) > 0.2 ? inp.pad.lx : 0);
      s.t += dt;
      s.vx += ax * 2200 * dt;
      s.vx *= Math.exp(-(ax ? 2 : 9) * dt);
      s.vx = Math.max(-340, Math.min(340, s.vx));
      if ((inp.wasPressed('Space', 'KeyW', 'ArrowUp') || inp.padPressed.has(0)) && s.ground) {
        s.vy = -820;
        s.ground = false;
        if (set === '2') { s.sqv = 14; audio.tone({ freq: 300, dur: 0.18, type: 'sine', gain: 0.25, slide: 2.2 }); }
        if (set === '3') { audio.noise({ dur: 0.08, gain: 0.25, freq: 300 }); burst(s.parts, s.x, s.y, { n: 8, speed: 120, life: 0.5, color: 'muted', size: 6, dir: -Math.PI / 2, spread: Math.PI }); }
        if (set === '4') { s.sqv = 10; audio.tone({ freq: 220, dur: 0.22, type: 'triangle', gain: 0.2, slide: 0.6 }); }
        if (set === '5') { audio.tone({ freq: 880, dur: 0.06, type: 'square', gain: 0.08 }); audio.tone({ freq: 1320, dur: 0.08, type: 'square', gain: 0.06 }); s.glow = 1; }
      }
      s.vy += 2400 * dt;
      const prevY = s.y;
      s.x = Math.max(20, Math.min(api.w - 20, s.x + s.vx * dt));
      s.y += s.vy * dt;
      let landed = false;
      const floors = [{ x: 0, y: GY, w: api.w }, ...PLATS];
      for (const f of floors) {
        if (s.vy >= 0 && prevY <= f.y && s.y >= f.y && s.x > f.x - 14 && s.x < f.x + f.w + 14) { s.y = f.y; landed = true; }
      }
      if (landed) {
        const impact = s.vy;
        s.vy = 0;
        if (!s.ground && impact > 200) {
          const k = Math.min(1, impact / 1000);
          if (set === '2') { s.sqv = -16 * k; audio.tone({ freq: 500, dur: 0.1, type: 'sine', gain: 0.2 * k, slide: 0.5 }); burst(s.parts, s.x, s.y, { n: 6, speed: 160, life: 0.4, color: 'warn', size: 5, dir: -Math.PI / 2, spread: Math.PI }); }
          if (set === '3') { audio.thud(1, k); s.shake = k; burst(s.parts, s.x, s.y, { n: 16, speed: 200, life: 0.7, color: 'muted', size: 8, dir: -Math.PI / 2, spread: Math.PI * 0.9 }); }
          if (set === '4') { s.sqv = -22 * k; audio.noise({ dur: 0.18, gain: 0.2 * k, freq: 500, type: 'lowpass' }); burst(s.parts, s.x, s.y, { n: 8, speed: 140, life: 0.6, color: 'accent3', size: 5, gravity: 900, dir: -Math.PI / 2, spread: Math.PI }); }
          if (set === '5') { audio.tone({ freq: 660, dur: 0.05, type: 'square', gain: 0.07 }); burst(s.parts, s.x, s.y, { n: 12, speed: 260, life: 0.3, color: 'accent2', size: 3, dir: -Math.PI / 2, spread: Math.PI }); s.glow = 1; }
        }
        s.ground = true;
      } else if (s.vy > 0) s.ground = false;
      // Resorte de deformación (dibujo animado y gelatina).
      const kSpring = set === '4' ? 120 : 260;
      const damp = set === '4' ? 5 : 14;
      s.sqv += (-kSpring * s.sq - damp * s.sqv) * dt;
      s.sq += s.sqv * dt;
      stepParticles(s.parts, dt);
      s.shake = Math.max(0, s.shake - dt * 4);
      s.glow = Math.max(0, s.glow - dt * 3);
      if (set === '5') { s.trail.push({ x: s.x, y: s.y }); if (s.trail.length > 10) s.trail.shift(); } else s.trail.length = 0;
    },
    render(g, s, api) {
      const c = api.colors;
      const set = api.mode;
      g.fillStyle = c.stage;
      g.fillRect(0, 0, api.w, api.h);
      g.save();
      if (s.shake > 0 && !reducedMotion()) g.translate(0, (Math.random() - 0.5) * 14 * s.shake);
      if (set !== '1') drawGrid(g, api.w, GY, 40);
      g.fillStyle = c.surface2;
      g.fillRect(0, GY, api.w, api.h - GY);
      for (const p of PLATS) g.fillRect(p.x, p.y, p.w, 12);

      const color = { 1: c.muted, 2: c.accent, 3: c.text, 4: c.accent3, 5: c.accent2 }[set];
      for (const [i, t] of s.trail.entries()) {
        g.globalAlpha = (i / s.trail.length) * 0.35;
        g.fillStyle = color;
        g.fillRect(t.x - 16, t.y - 36, 32, 36);
      }
      g.globalAlpha = 1;
      let sx = 1;
      let sy = 1;
      if (set === '2' || set === '4') {
        const st = Math.max(-0.45, Math.min(0.5, s.sq * 0.04 + (s.ground ? 0 : -s.vy / 4000)));
        sy = 1 + st;
        sx = 1 - st * 0.7;
        if (set === '4') { sx += Math.sin(s.t * 18) * 0.03 * Math.min(1, Math.abs(s.sq) * 0.1 + Math.abs(s.vx) / 600); }
      }
      const w = 32 * sx;
      const h = (set === '3' ? 38 : 36) * sy;
      if (set === '3' || set === '2') {
        const air = Math.max(0, GY - s.y);
        g.fillStyle = 'rgba(0,0,0,0.25)';
        g.beginPath();
        g.ellipse(s.x, GY + 3, 18 * Math.max(0.4, 1 - air / 300), 4, 0, 0, Math.PI * 2);
        g.fill();
      }
      if (set === '5' && s.glow > 0) {
        g.fillStyle = c.accent2;
        g.globalAlpha = s.glow * 0.35;
        g.beginPath();
        g.arc(s.x, s.y - 18, 34, 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = 1;
      }
      roundRect(g, s.x - w / 2, s.y - h, w, h, set === '4' ? 14 : set === '2' ? 10 : set === '3' ? 2 : 4);
      g.fillStyle = color;
      g.fill();
      if (set === '3') { g.strokeStyle = c.line; g.lineWidth = 3; g.stroke(); }
      if (set === '2') {
        g.fillStyle = c.bg;
        g.fillRect(s.x + 2, s.y - h * 0.72, 5, 7);
        g.fillRect(s.x + 10, s.y - h * 0.72, 5, 7);
      }
      drawParticles(g, s.parts, c);
      g.restore();

      api.metric('phys', 'idéntica en los 5');
      api.metric('vx', `${Math.round(s.vx)} px/s`);
      api.metric('vy', `${Math.round(s.vy)} px/s`);
    },
  });
}
