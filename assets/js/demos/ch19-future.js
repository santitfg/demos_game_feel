// EX19-1 · Háptica: el "agitador de bastón" de los aviones, como señal continua o como efecto especial.
// EX19-2 · Inclinación: el dispositivo como control (DeviceOrientation), con mouse o teclado de respaldo.

import { createDemo, text, roundRect } from '../core/demo.js';
import { audio } from '../core/audio.js';
import { reducedMotion } from '../core/theme.js';
import { mulberry } from './shared/rand.js';

const DEG = Math.PI / 180;
const STALL = 15 * DEG;
const WARN = 9 * DEG;

// Salida háptica: gamepad (Haptics API) y vibración del teléfono, si existen. Devuelve qué canal se usó.
function rumble(pad, strong, weak, ms) {
  const act = pad?.raw?.vibrationActuator;
  if (act?.playEffect) {
    act.playEffect('dual-rumble', { startDelay: 0, duration: ms, strongMagnitude: Math.min(1, strong), weakMagnitude: Math.min(1, weak) }).catch(() => {});
    return 'gamepad';
  }
  return null;
}
const canVibrate = () => typeof navigator !== 'undefined' && 'vibrate' in navigator && matchMedia('(pointer: coarse)').matches;

export function mountStall(mount, { id = 'EX19-1' } = {}) {
  const rand = mulberry(19);
  const clouds = Array.from({ length: 24 }, () => ({ x: rand() * 3000, y: 40 + rand() * 900, w: 60 + rand() * 120, d: 0.3 + rand() * 0.6 }));
  const hum = audio.drone({ type: 'square', filter: 180 });
  return createDemo({
    mount,
    id,
    title: 'Aviso de pérdida: vibración graduada o efecto especial',
    width: 900,
    height: 440,
    hint: 'Clic aquí · W/S o ↑/↓ para cabecear · arrastrar arriba/abajo en táctil',
    modes: [
      { key: '1', label: 'Sin aviso' },
      { key: '2', label: 'Vibración graduada' },
      { key: '3', label: 'Efecto especial' },
    ],
    params: [
      { key: 'sound', type: 'check', label: 'Representar la vibración también con sonido', value: true, help: 'Útil sin gamepad: un zumbido grave cuya intensidad sigue a la del motor de vibración.' },
      { key: 'pitchRate', label: 'Velocidad de cabeceo', min: 10, max: 90, step: 1, value: 35, unit: '°/s' },
      { key: 'thrust', label: 'Empuje', min: 2, max: 12, step: 0.5, value: 7, unit: 'm/s²' },
    ],
    metrics: [
      { key: 'aoa', label: 'Ángulo de ataque' },
      { key: 'alt', label: 'Altura máxima' },
      { key: 'stalls', label: 'Pérdidas' },
      { key: 'out', label: 'Vibración por' },
    ],
    foot: `<p><strong>Prueba esto:</strong> sube lo más alto que puedas sin entrar en pérdida. Al levantar la nariz, el avión trepa pero pierde
      velocidad, y el ángulo de ataque crece. En <kbd>1</kbd> no hay aviso: la pérdida llega de golpe. En <kbd>2</kbd> la vibración crece de a
      poco desde los 9°, como el agitador de bastón de los aviones: es información continua, igual que el tono del motor de un auto. En
      <kbd>3</kbd> solo hay una sacudida fuerte cuando ya es tarde: la vibración usada como efecto especial. Con un gamepad conectado
      (Chrome, Edge) se siente en las manos; si no, el ícono del control y el zumbido muestran lo que haría.</p>`,

    setup() {
      return { x: 0, y: 300, v: 60, gamma: 0, theta: 0.07, stalled: false, stalls: 0, maxY: 300, buzz: 0, jolt: 0, lastFx: 0, vibT: 0, drag: null, out: '—' };
    },
    update(s, dt, api) {
      const p = api.params;
      const inp = api.input;
      let pin = inp.axis(['KeyS', 'ArrowDown'], ['KeyW', 'ArrowUp']);
      if (inp.pad.connected && Math.abs(inp.pad.ly) > 0.1) pin = inp.pad.ly; // tirar hacia atrás = nariz arriba, como un avión
      if (inp.mouse.down) {
        if (!s.drag) s.drag = inp.mouse.y;
        pin = Math.max(-1, Math.min(1, (s.drag - inp.mouse.y) / 80));
      } else s.drag = null;
      if (!s.stalled) s.theta += pin * p.pitchRate * DEG * dt;
      const alpha = s.theta - s.gamma;
      // Sustentación lineal hasta la pérdida; después cae y la nariz baja sola.
      const cl = alpha < STALL ? 5 * alpha : 5 * STALL * 0.35;
      if (alpha >= STALL && !s.stalled) {
        s.stalled = true;
        s.stalls++;
        s.jolt = 1;
        audio.thud(0.9, 1);
      }
      if (s.stalled) {
        // La nariz cae sola por debajo de la trayectoria hasta que el ala vuelve a sustentar.
        s.theta += (s.gamma - 0.12 - s.theta) * (1 - Math.exp(-3 * dt));
        if (alpha < 4 * DEG) s.stalled = false;
      }
      const lift = 0.0078 * s.v * s.v * cl;
      const drag = (0.0004 + 0.006 * cl * cl) * s.v * s.v;
      s.v += (p.thrust - drag - 9.8 * Math.sin(s.gamma)) * dt;
      s.v = Math.max(15, s.v);
      s.gamma += ((lift - 9.8 * Math.cos(s.gamma)) / s.v) * dt;
      s.x += Math.cos(s.gamma) * s.v * dt;
      s.y += Math.sin(s.gamma) * s.v * dt;
      if (s.y < 20) { s.y = 20; s.gamma = Math.max(0, s.gamma); s.theta = Math.max(s.theta, s.gamma); }
      s.maxY = Math.max(s.maxY, s.y);
      s.alpha = alpha;

      // Intensidad de la vibración según el modo.
      const graded = Math.max(0, Math.min(1, (alpha - WARN) / (STALL - WARN)));
      s.jolt = Math.max(0, s.jolt - dt * 2.5);
      s.buzz = api.mode === '2' ? (s.stalled ? 1 : graded) : api.mode === '3' ? s.jolt : 0;
      // Envío al hardware cada ~60 ms (los efectos son cortos y se encadenan).
      if (api.time - s.lastFx > 0.06) {
        s.lastFx = api.time;
        const ch = s.buzz > 0.02 ? rumble(inp.pad, s.buzz, s.buzz * 0.6, 90) : null;
        if (ch) s.out = 'gamepad';
        else if (canVibrate()) {
          // El teléfono solo vibra o no: la intensidad se traduce en pulsos más seguidos.
          s.vibT -= 0.06;
          if (s.buzz > 0.02 && s.vibT <= 0) { navigator.vibrate(25); s.vibT = 0.45 - s.buzz * 0.38; }
          s.out = 'teléfono';
        } else s.out = inp.pad.connected ? 'gamepad sin vibración' : 'sin hardware háptico';
      }
    },
    render(g, s, api) {
      const c = api.colors;
      const p = api.params;
      // Cámara: el avión en el tercio izquierdo; el cielo se oscurece con la altura.
      const camX = s.x - 260;
      const camY = s.y - 220;
      const sky = Math.min(1, s.y / 1500);
      g.fillStyle = `rgb(${Math.round(150 - sky * 90)},${Math.round(195 - sky * 100)},${Math.round(235 - sky * 60)})`;
      g.fillRect(0, 0, api.w, api.h);
      for (const cl of clouds) {
        const x = ((cl.x - camX * cl.d) % 3000 + 3000) % 3000 - 200;
        const y = api.h - (cl.y - camY * cl.d);
        if (y < -40 || y > api.h + 40) continue;
        g.fillStyle = 'rgba(255,255,255,0.75)';
        roundRect(g, x, y, cl.w, cl.w * 0.35, 20);
        g.fill();
      }
      const gy = api.h - (0 - camY);
      if (gy < api.h) { g.fillStyle = '#6f8f4f'; g.fillRect(0, gy, api.w, api.h - gy); }
      // Avión
      const px = s.x - camX;
      const py = api.h - (s.y - camY);
      g.save();
      g.translate(px, py);
      g.rotate(-s.theta);
      g.fillStyle = s.stalled ? c.bad : '#f4f4f4';
      roundRect(g, -34, -6, 68, 12, 6);
      g.fill();
      g.fillStyle = '#2d3a3f';
      g.fillRect(-6, -2, 20, 4);
      g.beginPath();
      g.moveTo(-34, -6); g.lineTo(-44, -20); g.lineTo(-26, -6);
      g.fill();
      g.restore();
      // Vector de velocidad (trayectoria) frente a la nariz: la diferencia es el ángulo de ataque.
      g.strokeStyle = 'rgba(0,0,0,0.5)';
      g.setLineDash([4, 4]);
      g.beginPath();
      g.moveTo(px, py);
      g.lineTo(px + Math.cos(s.gamma) * 90, py - Math.sin(s.gamma) * 90);
      g.stroke();
      g.setLineDash([]);

      // Indicador de ángulo de ataque con la banda de aviso y la de pérdida.
      const gx = 20;
      const gyT = 20;
      const gh = 160;
      g.fillStyle = c.surface;
      g.globalAlpha = 0.9;
      roundRect(g, gx - 8, gyT - 8, 70, gh + 40, 6);
      g.fill();
      g.globalAlpha = 1;
      const yOf = (a) => gyT + gh - ((a / DEG + 5) / 25) * gh;
      g.fillStyle = c.warn;
      g.fillRect(gx, yOf(STALL), 14, yOf(WARN) - yOf(STALL));
      g.fillStyle = c.bad;
      g.fillRect(gx, yOf(20 * DEG), 14, yOf(STALL) - yOf(20 * DEG));
      g.fillStyle = c.line;
      g.fillRect(gx, yOf(WARN), 14, yOf(-5 * DEG) - yOf(WARN));
      g.fillStyle = c.text;
      const ay = yOf(Math.max(-5 * DEG, Math.min(20 * DEG, s.alpha || 0)));
      g.fillRect(gx - 4, ay - 2, 22, 4);
      text(g, 'α', gx + 7, gyT + gh + 22, { align: 'center', size: 12, color: c.text, weight: 700 });
      text(g, '15°', gx + 20, yOf(STALL) + 4, { size: 10 });
      text(g, '9°', gx + 20, yOf(WARN) + 4, { size: 10 });

      // Ícono del control que tiembla con la intensidad (con movimiento reducido, solo cambia de color).
      const b = s.buzz;
      const rx = api.w - 130;
      const ry = 26;
      const jit = reducedMotion() ? 0 : b * 5;
      g.save();
      g.translate(rx + (Math.random() - 0.5) * jit, ry + (Math.random() - 0.5) * jit);
      g.fillStyle = b > 0.02 ? `rgba(230,80,60,${0.4 + b * 0.6})` : c.surface2;
      roundRect(g, 0, 0, 110, 50, 22);
      g.fill();
      g.fillStyle = c.text;
      g.beginPath(); g.arc(30, 25, 7, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(80, 25, 7, 0, Math.PI * 2); g.fill();
      g.restore();
      text(g, `vibración ${Math.round(b * 100)} %`, rx + 55, ry + 68, { align: 'center', size: 11, color: c.text, mono: true });
      if (s.stalled) text(g, 'PÉRDIDA', api.w / 2, 40, { align: 'center', size: 22, weight: 700, color: c.bad });

      const focused = document.activeElement === api.stage;
      hum.set({ freq: 45 + b * 25, gain: p.sound && focused ? b * 0.25 : 0 });
      api.metric('aoa', `${((s.alpha || 0) / DEG).toFixed(1)}°`);
      api.metricColor('aoa', s.alpha > STALL ? 'bad' : s.alpha > WARN ? 'warn' : '');
      api.metric('alt', `${Math.round(s.maxY)} m`);
      api.metric('stalls', String(s.stalls));
      api.metric('out', s.out);
    },
  });
}

// ---------------- EX19-2 ----------------
const HOLES = [[260, 120], [420, 300], [600, 140], [700, 330], [300, 330], [520, 230]];
export function mountTilt(mount, { id = 'EX19-2' } = {}) {
  const orient = { has: false, beta: 0, gamma: 0, b0: null, g0: null };
  const onOrient = (e) => {
    if (e.beta == null) return;
    orient.has = true;
    orient.beta = e.beta;
    orient.gamma = e.gamma;
    if (orient.b0 == null) { orient.b0 = e.beta; orient.g0 = e.gamma; }
  };
  const listen = () => window.addEventListener('deviceorientation', onOrient);
  // iOS pide permiso con un gesto del usuario; en el resto alcanza con escuchar.
  const needsPermission = typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function';
  if (!needsPermission) listen();

  const rand = mulberry(192);
  const layers = [0.15, 0.4, 0.8, 1.3].map((depth, li) => ({ depth, items: Array.from({ length: 8 + li * 3 }, () => ({ x: rand() * 1100 - 100, y: rand() * 520 - 40, r: 15 + rand() * (20 + li * 15) })) }));
  // Estrellas en una capa lejana, cada una tapada (en reposo) por un disco de una capa cercana.
  const hidden = [[180, 300], [520, 120], [760, 330]].map(([x, y]) => ({ x, y, found: false }));
  for (const h of hidden) layers[2].items.push({ x: h.x, y: h.y, r: 58 });
  const STAR_D = 0.4;
  const starPos = (h, s) => [h.x - s.tx * 260 * STAR_D, h.y - s.ty * 160 * STAR_D];
  const covered = (x, y, s) => layers.slice(2).some((L) => L.items.some((it) => Math.hypot(x - (it.x - s.tx * 260 * L.depth), y - (it.y - s.ty * 160 * L.depth)) < it.r + 4));

  const demo = createDemo({
    mount,
    id,
    title: 'Inclinación: el aparato es el control',
    width: 900,
    height: 440,
    hint: needsPermission ? 'Toca aquí para dar permiso al sensor · o usa el mouse / flechas' : 'Clic aquí · inclina el teléfono, o usa el mouse / flechas',
    modes: [
      { key: '1', label: 'Bandeja' },
      { key: '2', label: 'Ventana al mundo' },
    ],
    params: [
      { key: 'source', type: 'select', label: 'Fuente de la inclinación', options: [['auto', 'Automática'], ['sensor', 'Sensor del aparato'], ['mouse', 'Posición del mouse'], ['keys', 'Flechas / W A S D']], value: 'auto' },
      { key: 'gain', label: 'Ganancia', min: 0.2, max: 3, step: 0.1, value: 1, help: 'Cuánto se inclina el mundo por cada grado del aparato (la relación control-display).' },
    ],
    metrics: [
      { key: 'src', label: 'Fuente' },
      { key: 'tilt', label: 'Inclinación' },
      { key: 'score', label: 'Resultado' },
    ],
    foot: `<p><strong>Prueba esto:</strong> en un teléfono, toca el área y luego inclínalo (<kbd>C</kbd> o un toque recalibra el "plano").
      En <kbd>1</kbd> lleva la bolita al círculo verde sin caer en los agujeros: el mapeo es natural, la bandeja se inclina como el aparato.
      En <kbd>2</kbd> el aparato es una ventana: al inclinarlo, las capas cercanas se mueven más que las lejanas y aparecen cosas escondidas
      detrás. En la computadora, la posición del mouse respecto del centro hace de inclinación.</p>`,

    setup(api) {
      hidden.forEach((h) => { h.found = false; });
      return { bx: 120, by: 220, vx: 0, vy: 0, tx: 0, ty: 0, falls: 0, wins: 0, t: 0, best: null, kx: 0, ky: 0 };
    },
    update(s, dt, api) {
      const p = api.params;
      const inp = api.input;
      if (inp.mousePressed || inp.wasPressed('KeyC')) {
        if (needsPermission && !orient.has) DeviceOrientationEvent.requestPermission().then((r) => { if (r === 'granted') listen(); }).catch(() => {});
        orient.b0 = orient.beta;
        orient.g0 = orient.gamma;
      }
      let src = p.source;
      if (src === 'auto') src = orient.has ? 'sensor' : inp.isDown('ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyA', 'KeyS', 'KeyD') ? 'keys' : s.lastSrc === 'keys' ? 'keys' : 'mouse';
      if (src === 'mouse' && !inp.mouse.inside && s.lastSrc === 'keys') src = 'keys';
      s.lastSrc = src;
      let tx = 0;
      let ty = 0;
      if (src === 'sensor') {
        // gamma: izquierda/derecha; beta: adelante/atrás. Relativos a la posición calibrada.
        tx = ((orient.gamma - (orient.g0 ?? 0)) / 30) * p.gain;
        ty = ((orient.beta - (orient.b0 ?? 0)) / 30) * p.gain;
      } else if (src === 'mouse') {
        tx = ((inp.mouse.x - api.w / 2) / (api.w / 2)) * p.gain;
        ty = ((inp.mouse.y - api.h / 2) / (api.h / 2)) * p.gain;
      } else {
        s.kx += (inp.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']) * p.gain - s.kx) * (1 - Math.exp(-4 * dt));
        s.ky += (inp.axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']) * p.gain - s.ky) * (1 - Math.exp(-4 * dt));
        tx = s.kx;
        ty = s.ky;
      }
      s.tx = Math.max(-1.5, Math.min(1.5, tx));
      s.ty = Math.max(-1.5, Math.min(1.5, ty));
      s.src = src;
      if (api.mode === '1') {
        s.t += dt;
        s.vx += s.tx * 500 * dt;
        s.vy += s.ty * 500 * dt;
        s.vx *= Math.exp(-0.6 * dt);
        s.vy *= Math.exp(-0.6 * dt);
        s.bx += s.vx * dt;
        s.by += s.vy * dt;
        if (s.bx < 40 || s.bx > api.w - 40) { s.vx *= -0.4; s.bx = Math.max(40, Math.min(api.w - 40, s.bx)); audio.click(); }
        if (s.by < 40 || s.by > api.h - 40) { s.vy *= -0.4; s.by = Math.max(40, Math.min(api.h - 40, s.by)); audio.click(); }
        for (const [hx, hy] of HOLES) {
          if (Math.hypot(s.bx - hx, s.by - hy) < 18) { s.falls++; audio.thud(0.3, 0.6); Object.assign(s, { bx: 120, by: 220, vx: 0, vy: 0, t: 0 }); }
        }
        if (Math.hypot(s.bx - 800, s.by - 220) < 24) {
          s.wins++;
          s.best = s.best == null ? s.t : Math.min(s.best, s.t);
          audio.blip(990);
          Object.assign(s, { bx: 120, by: 220, vx: 0, vy: 0, t: 0 });
        }
      } else {
        // Una estrella cuenta como vista cuando ninguna capa cercana la tapa y está dentro de la ventana.
        for (const h of hidden) {
          const [x, y] = starPos(h, s);
          if (!h.found && x > 20 && x < api.w - 20 && y > 20 && y < api.h - 20 && !covered(x, y, s)) { h.found = true; audio.blip(880); }
        }
      }
    },
    render(g, s, api) {
      const c = api.colors;
      g.fillStyle = c.stage;
      g.fillRect(0, 0, api.w, api.h);
      if (api.mode === '1') {
        // Bandeja con sombra desplazada según la inclinación (pulido barato que vende la tercera dimensión).
        g.fillStyle = c.surface2;
        roundRect(g, 24, 24, api.w - 48, api.h - 48, 14);
        g.fill();
        g.fillStyle = c.good;
        g.globalAlpha = 0.35;
        g.beginPath(); g.arc(800, 220, 30, 0, Math.PI * 2); g.fill();
        g.globalAlpha = 1;
        for (const [hx, hy] of HOLES) { g.fillStyle = '#000'; g.beginPath(); g.arc(hx, hy, 20, 0, Math.PI * 2); g.fill(); }
        g.fillStyle = 'rgba(0,0,0,0.25)';
        g.beginPath(); g.arc(s.bx - s.tx * 6, s.by - s.ty * 6 + 4, 15, 0, Math.PI * 2); g.fill();
        g.fillStyle = c.accent;
        g.beginPath(); g.arc(s.bx, s.by, 14, 0, Math.PI * 2); g.fill();
        api.metric('score', `${s.wins} llegadas · ${s.falls} caídas${s.best != null ? ` · mejor ${s.best.toFixed(1)} s` : ''}`);
      } else {
        // Capas con paralaje: las cercanas se desplazan más.
        for (const [li, L] of layers.entries()) {
          g.fillStyle = [c.line, c.surface2, c.muted, c.accent2][li];
          g.globalAlpha = [0.6, 0.7, 1, 1][li];
          for (const it of L.items) {
            const x = it.x - s.tx * 260 * L.depth;
            const y = it.y - s.ty * 160 * L.depth;
            g.beginPath(); g.arc(x, y, it.r, 0, Math.PI * 2); g.fill();
          }
          if (li === 1) {
            g.globalAlpha = 1;
            for (const h of hidden) {
              const [x, y] = starPos(h, s);
              g.fillStyle = h.found ? c.good : c.warn;
              g.beginPath();
              for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2 - Math.PI / 2; const r = k % 2 ? 7 : 16; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
              g.fill();
            }
          }
        }
        g.globalAlpha = 1;
        // Marco de ventana.
        g.strokeStyle = c.text;
        g.lineWidth = 10;
        g.strokeRect(5, 5, api.w - 10, api.h - 10);
        g.lineWidth = 1;
        api.metric('score', `${hidden.filter((h) => h.found).length} / ${hidden.length} estrellas a la vista`);
      }
      const label = { sensor: 'sensor del aparato', mouse: 'mouse', keys: 'teclado' }[s.src] || '—';
      api.metric('src', label);
      api.metric('tilt', `${(s.tx * 30).toFixed(0)}° · ${(s.ty * 30).toFixed(0)}°`);
    },
  });
  return demo;
}
