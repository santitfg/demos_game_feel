// CH08-1 · Un auto a "100 mph": sin referencias la velocidad no existe. Se agregan textura, objetos y FOV.
// EX08-1 · La segunda perilla: espaciado del nivel frente a la velocidad del avatar.

import { createDemo, text, roundRect } from '../core/demo.js';
import { audio } from '../core/audio.js';
import { reducedMotion } from '../core/theme.js';
import { mulberry } from './shared/rand.js';

// ---------------- CH08-1 ----------------
const MPH100 = 44.7; // m/s
const CAM_H = 1.4;
const ROAD_W = 4.5;
const SEG = 6; // m por franja
const LOOP = 2000; // m, el paisaje se repite

export function mountSpeed(mount, { id = 'CH08-1' } = {}) {
  const rand = mulberry(11);
  const props = [];
  for (let z = 0; z < LOOP; z += 4 + rand() * 16) {
    const side = rand() < 0.5 ? -1 : 1;
    const kind = rand() < 0.65 ? 'tree' : rand() < 0.6 ? 'cow' : 'house';
    props.push({ z, x: side * (ROAD_W + 3 + rand() * 18), kind });
  }
  for (let z = 0; z < LOOP; z += 25) { props.push({ z, x: -ROAD_W - 0.8, kind: 'post' }); props.push({ z, x: ROAD_W + 0.8, kind: 'post' }); }
  for (const z of [300, 900, 1500]) props.push({ z, x: 0, kind: 'bridge' });
  props.sort((a, b) => a.z - b.z);

  return createDemo({
    mount,
    id,
    title: 'Un auto a 100 mph',
    width: 900,
    height: 420,
    hint: 'Clic aquí · mantén Espacio (o W) para ir a 100 mph · A/D para moverte de carril',
    params: [
      { key: 'mph', label: 'Velocidad según el código', min: 10, max: 250, step: 5, value: 100, unit: 'mph' },
    ],
    modes: [
      { key: '1', label: 'Sin referencias' },
      { key: '2', label: 'Textura del camino' },
      { key: '3', label: '+ árboles, postes, vacas' },
      { key: '4', label: '+ campo de visión dinámico' },
    ],
    metrics: [
      { key: 'code', label: 'Velocidad en el código' },
      { key: 'ms', label: 'En metros por segundo' },
      { key: 'refs', label: 'Referencias en pantalla' },
    ],
    foot: `<p><strong>Prueba esto:</strong> mantén <kbd>Espacio</kbd> en <kbd>1</kbd>. El velocímetro dice 100 mph, pero la cámara sigue al
      auto a la misma velocidad y no hay nada más: no hay movimiento. <kbd>2</kbd> agrega asfalto con franjas y la velocidad aparece de golpe.
      <kbd>3</kbd> agrega cosas al costado que pasan cerca y lejos, y <kbd>4</kbd> abre el campo de visión con la velocidad, como hacen Burnout y
      GTA. El número no cambió en ningún momento.</p>`,

    setup() {
      return { pos: 0, v: 0, x: 0, vx: 0, fov: 0 };
    },
    update(s, dt, api) {
      const inp = api.input;
      const target = inp.isDown('Space', 'KeyW', 'ArrowUp') || inp.pad.rt > 0.2 || inp.pad.buttons[0] ? (api.params.mph / 100) * MPH100 : 0;
      s.v += (target - s.v) * (1 - Math.exp(-dt / 0.6));
      s.pos = (s.pos + s.v * dt) % LOOP;
      const ax = inp.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']) + (Math.abs(inp.pad.lx) > 0.2 ? inp.pad.lx : 0);
      s.vx += (ax * 6 - s.vx) * (1 - Math.exp(-dt / 0.15));
      s.x = Math.max(-ROAD_W + 1, Math.min(ROAD_W - 1, s.x + s.vx * dt));
      s.fov += ((api.mode === '4' ? s.v / MPH100 : 0) - s.fov) * (1 - Math.exp(-dt / 0.4));
    },
    render(g, s, api) {
      const c = api.colors;
      const mode = +api.mode;
      const W = api.w;
      const H = api.h;
      const horizon = 150 - s.fov * 18;
      const D = 420 * (1 - s.fov * 0.38); // distancia focal: menor = más gran angular
      const cx = W / 2;
      let shake = 0;
      if (mode === 4 && !reducedMotion()) shake = (Math.random() - 0.5) * 2.5 * s.fov;
      g.save();
      g.translate(0, shake);
      // Cielo.
      const sky = g.createLinearGradient(0, 0, 0, horizon);
      sky.addColorStop(0, '#7fa8d6');
      sky.addColorStop(1, '#cfe1ef');
      g.fillStyle = sky;
      g.fillRect(0, -5, W, horizon + 5);
      if (mode === 1) {
        g.fillStyle = '#6f8d55';
        g.fillRect(0, horizon, W, H - horizon + 5);
        g.fillStyle = '#585a60';
        g.beginPath();
        g.moveTo(cx - 6, horizon);
        g.lineTo(cx + 6, horizon);
        const k = (H + 5 - horizon) / CAM_H; // escala en el borde inferior: D / z
        g.lineTo(cx + (ROAD_W - s.x) * k, H + 5);
        g.lineTo(cx + (-ROAD_W - s.x) * k, H + 5);
        g.fill();
      } else {
        // Suelo fila por fila: z = altura × focal / (y − horizonte).
        for (let y = Math.floor(horizon) + 1; y < H + 5; y++) {
          const z = (CAM_H * D) / (y - horizon);
          const band = Math.floor((z + s.pos) / SEG) % 2 === 0;
          const sc = D / z;
          const roadL = cx + (-ROAD_W - s.x) * sc;
          const roadR = cx + (ROAD_W - s.x) * sc;
          g.fillStyle = band ? '#6f8d55' : '#64814c';
          g.fillRect(0, y, W, 1);
          g.fillStyle = band ? '#5c5e64' : '#55575d';
          g.fillRect(roadL, y, roadR - roadL, 1);
          const rum = 0.5 * sc;
          g.fillStyle = band ? '#d9d9d9' : '#c4473a';
          g.fillRect(roadL - rum, y, rum, 1);
          g.fillRect(roadR, y, rum, 1);
          if (band) {
            g.fillStyle = '#e8e2c8';
            g.fillRect(cx - s.x * sc - 0.08 * sc, y, 0.16 * sc, 1);
          }
        }
      }
      // Objetos al costado (de lejos a cerca).
      let refs = 0;
      if (mode >= 3) {
        const vis = [];
        for (const p of props) {
          let z = p.z - s.pos;
          if (z < 0) z += LOOP;
          if (z < 1.5 || z > 260) continue;
          vis.push({ ...p, z });
        }
        vis.sort((a, b) => b.z - a.z);
        for (const p of vis) {
          const sc = D / p.z;
          const sx = cx + (p.x - s.x) * sc;
          const sy = horizon + CAM_H * sc;
          if (sx < -200 || sx > W + 200) continue;
          refs++;
          drawProp(g, p.kind, sx, sy, sc, c);
        }
      }
      if (mode === 4 && s.fov > 0.3) {
        g.strokeStyle = 'rgba(255,255,255,0.35)';
        g.lineWidth = 1.5;
        for (let i = 0; i < 18; i++) {
          const a = Math.random() * Math.PI * 2;
          const r0 = 150 + Math.random() * 200;
          g.beginPath();
          g.moveTo(cx + Math.cos(a) * r0, horizon + 60 + Math.sin(a) * r0 * 0.6);
          g.lineTo(cx + Math.cos(a) * (r0 + 60 * s.fov), horizon + 60 + Math.sin(a) * (r0 + 60 * s.fov) * 0.6);
          g.stroke();
        }
      }
      g.restore();
      // Auto (siempre en el mismo lugar: la cámara lo sigue).
      const carW = 120;
      const carY = H - 70;
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.beginPath();
      g.ellipse(cx, carY + 50, carW * 0.6, 10, 0, 0, Math.PI * 2);
      g.fill();
      roundRect(g, cx - carW / 2, carY, carW, 46, 10);
      g.fillStyle = c.accent;
      g.fill();
      roundRect(g, cx - carW / 2 + 18, carY - 26, carW - 36, 30, 8);
      g.fill();
      g.fillStyle = '#2a3440';
      g.fillRect(cx - carW / 2 + 26, carY - 20, carW - 52, 18);
      g.fillStyle = '#f2d16b';
      g.fillRect(cx - carW / 2 + 8, carY + 14, 16, 8);
      g.fillRect(cx + carW / 2 - 24, carY + 14, 16, 8);
      g.fillStyle = '#111';
      g.fillRect(cx - carW / 2 + 6, carY + 40, 20, 12);
      g.fillRect(cx + carW / 2 - 26, carY + 40, 20, 12);
      // Velocímetro.
      const mph = (s.v / MPH100) * 100;
      roundRect(g, 16, H - 70, 150, 54, 8);
      g.fillStyle = 'rgba(0,0,0,0.55)';
      g.fill();
      text(g, `${Math.round(mph)} mph`, 30, H - 34, { size: 26, weight: 700, mono: true, color: '#fff' });
      api.metric('code', `${Math.round(mph)} mph`);
      api.metric('ms', `${s.v.toFixed(1)} m/s`);
      api.metric('refs', String(refs + (mode >= 2 ? 1 : 0)));
    },
  });
}

function drawProp(g, kind, x, y, sc, c) {
  if (kind === 'tree') {
    g.fillStyle = '#6b4a2e';
    g.fillRect(x - 0.25 * sc, y - 2 * sc, 0.5 * sc, 2 * sc);
    g.fillStyle = '#2f6b3a';
    g.beginPath();
    g.moveTo(x, y - 7 * sc);
    g.lineTo(x - 2 * sc, y - 1.5 * sc);
    g.lineTo(x + 2 * sc, y - 1.5 * sc);
    g.fill();
  } else if (kind === 'post') {
    g.fillStyle = '#eeeeee';
    g.fillRect(x - 0.1 * sc, y - 1.1 * sc, 0.2 * sc, 1.1 * sc);
    g.fillStyle = '#c4473a';
    g.fillRect(x - 0.1 * sc, y - 1.1 * sc, 0.2 * sc, 0.25 * sc);
  } else if (kind === 'cow') {
    g.fillStyle = '#f4f1ea';
    g.fillRect(x - 1 * sc, y - 1.3 * sc, 2 * sc, 0.9 * sc);
    g.fillStyle = '#2b2b2b';
    g.fillRect(x - 0.4 * sc, y - 1.2 * sc, 0.6 * sc, 0.4 * sc);
    g.fillRect(x - 0.9 * sc, y - 0.4 * sc, 0.2 * sc, 0.4 * sc);
    g.fillRect(x + 0.7 * sc, y - 0.4 * sc, 0.2 * sc, 0.4 * sc);
  } else if (kind === 'house') {
    g.fillStyle = '#d8c6a3';
    g.fillRect(x - 3 * sc, y - 3.5 * sc, 6 * sc, 3.5 * sc);
    g.fillStyle = '#9b4a37';
    g.beginPath();
    g.moveTo(x - 3.5 * sc, y - 3.5 * sc);
    g.lineTo(x, y - 6 * sc);
    g.lineTo(x + 3.5 * sc, y - 3.5 * sc);
    g.fill();
  } else if (kind === 'bridge') {
    g.fillStyle = '#8a8f98';
    g.fillRect(x - 9 * sc, y - 6 * sc, 18 * sc, 1.2 * sc);
    g.fillRect(x - 9 * sc, y - 6 * sc, 1 * sc, 6 * sc);
    g.fillRect(x + 8 * sc, y - 6 * sc, 1 * sc, 6 * sc);
  }
}

// ---------------- EX08-1 ----------------
export function mountSpacing(mount, { id = 'EX08-1' } = {}) {
  return createDemo({
    mount,
    id,
    title: 'Espaciado frente a velocidad',
    width: 900,
    height: 440,
    hint: 'Clic aquí · A/D o ←/→ para esquivar',
    params: [
      { key: 'speed', label: 'Velocidad de avance', min: 100, max: 900, step: 10, value: 320, unit: 'px/s' },
      { key: 'spacing', label: 'Distancia entre filas', min: 60, max: 800, step: 10, value: 380, unit: 'px' },
      { key: 'side', label: 'Velocidad lateral', min: 100, max: 900, step: 10, value: 420, unit: 'px/s' },
      { key: 'gap', label: 'Ancho del hueco', min: 50, max: 300, step: 5, value: 120, unit: 'px' },
    ],
    modes: [
      { key: '1', label: 'Holgado', values: { speed: 320, spacing: 380 } },
      { key: '2', label: 'Exigente', values: { speed: 520, spacing: 240 } },
      { key: '3', label: 'Imposible', values: { speed: 720, spacing: 120 } },
      { key: '4', label: 'Aburrido', values: { speed: 200, spacing: 720 } },
    ],
    onModeChange(k, s) { if (s?.rows) { s.passed = 0; s.hits = 0; } },
    metrics: [
      { key: 'dec', label: 'Tiempo entre decisiones' },
      { key: 'passed', label: 'Filas superadas' },
      { key: 'hits', label: 'Choques' },
      { key: 'verdict', label: 'Frente al ciclo de 240 ms' },
    ],
    foot: `<p><strong>Prueba esto:</strong> esquiva las filas en cada modo. La perilla que importa no es la velocidad ni la distancia por
      separado, sino su cociente: <em>cuánto tiempo hay entre una decisión y la siguiente</em>. Por debajo de un ciclo de corrección (unos 240 ms)
      ya no se puede corregir sobre la marcha, como pasa en <kbd>3</kbd>. Muy por encima, como en <kbd>4</kbd>, sobra tiempo y no hay
      tensión. Cambia los dos valores juntos y verás que la sensación se mantiene mientras el cociente no cambie.</p>`,

    setup(api) {
      return { x: api.w / 2, vx: 0, rows: [], next: 0, passed: 0, hits: 0, hurt: 0 };
    },
    update(s, dt, api) {
      const p = api.params;
      const inp = api.input;
      const ax = inp.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']) + (Math.abs(inp.pad.lx) > 0.2 ? inp.pad.lx : 0);
      s.vx += (ax * p.side - s.vx) * (1 - Math.exp(-dt / 0.06));
      s.x = Math.max(20, Math.min(api.w - 20, s.x + s.vx * dt));
      s.next -= p.speed * dt;
      if (s.next <= 0) {
        s.rows.push({ y: -20, gx: 60 + Math.random() * (api.w - 120), hit: false });
        s.next += p.spacing;
      }
      const py = api.h - 60;
      for (const r of s.rows) {
        r.y += p.speed * dt;
        if (!r.done && r.y > py - 12 && r.y < py + 12) {
          const inside = s.x - 14 > r.gx - p.gap / 2 && s.x + 14 < r.gx + p.gap / 2;
          if (!inside && !r.hit) { r.hit = true; s.hits++; s.hurt = 1; audio.thud(0.4, 0.5); }
        }
        if (!r.done && r.y > py + 12) { r.done = true; if (!r.hit) { s.passed++; } }
      }
      s.rows = s.rows.filter((r) => r.y < api.h + 30);
      s.hurt = Math.max(0, s.hurt - dt * 3);
    },
    render(g, s, api) {
      const c = api.colors;
      const p = api.params;
      g.fillStyle = c.stage;
      g.fillRect(0, 0, api.w, api.h);
      for (const r of s.rows) {
        g.fillStyle = r.hit ? c.bad : c.surface2;
        g.fillRect(0, r.y - 8, r.gx - p.gap / 2, 16);
        g.fillRect(r.gx + p.gap / 2, r.y - 8, api.w - (r.gx + p.gap / 2), 16);
      }
      const py = api.h - 60;
      roundRect(g, s.x - 14, py - 18, 28, 36, 6);
      g.fillStyle = s.hurt > 0 ? c.bad : c.accent;
      g.fill();
      const dec = (p.spacing / p.speed) * 1000;
      api.metric('dec', `${Math.round(dec)} ms`);
      api.metric('passed', String(s.passed));
      api.metric('hits', String(s.hits));
      api.metric('verdict', dec < 240 ? 'por debajo: imposible' : dec < 600 ? 'exigente' : dec < 1500 ? 'cómodo' : 'sobra tiempo');
      api.metricColor('verdict', dec < 240 ? 'bad' : dec < 600 ? 'warn' : 'good');
      // Barra de tiempo entre decisiones frente a 240 ms.
      const bx = 16;
      const bw = 220;
      g.fillStyle = c.surface;
      g.fillRect(bx, 14, bw, 10);
      g.fillStyle = dec < 240 ? c.bad : c.accent;
      g.fillRect(bx, 14, Math.min(bw, (dec / 2000) * bw), 10);
      g.fillStyle = c.text;
      g.fillRect(bx + (240 / 2000) * bw, 10, 2, 18);
      text(g, `${Math.round(dec)} ms entre filas · línea = 240 ms`, bx, 42, { size: 11, mono: true, color: c.text });
    },
  });
}
