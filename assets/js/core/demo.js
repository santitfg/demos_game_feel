// Componente de demo jugable.
//
// createDemo({
//   mount: '#demo-ch07-1',          // elemento a reemplazar
//   id: 'CH07-1', title: 'Cubo ADSR',
//   width: 800, height: 400,        // coordenadas lógicas del canvas
//   params: [...schema],            // ver params.js (opcional)
//   modes: [{ key: '1', label: 'Rígido', values: {...}, select(state, api) {} }],
//   graph: { window: 3, series: [...] },   // ver graph.js (opcional)
//   metrics: [{ key: 'lag', label: 'Retraso' }],
//   hint: 'Clic y usa A/D',
//   foot: '<p>Prueba esto…</p>',
//   setup(api) { return state },
//   update(state, dt, api) {},
//   render(g, state, api) {},
// })
//
// `api` expone: input, params (valores), time, w, h, graph, metric(k, v), hud(text),
// colors (tema), loop, mode (clave del modo activo), reset().

import { Input } from './input.js';
import { createLoop } from './loop.js';
import { createParams } from './params.js';
import { createGraph } from './graph.js';
import { colors } from './theme.js';
import { audio } from './audio.js';
import { DEMOS, DEVICE_LABEL, demoAnchor } from '../chapters.js';

export function createDemo(opts) {
  const {
    mount, id = '', title = '', width = 800, height = 400,
    params: schema = null, modes = [], graph: graphOpts = null, metrics = [],
    hint = 'Haz clic aquí para controlar', foot = '', pointerLock = false,
    setup = () => ({}), update = () => {}, render = () => {}, hz = 120,
    panelWidth = null, onModeChange = null, startMode = null, noResetKey = false,
  } = opts;
  const meta = DEMOS[id] || {};
  const controls = opts.controls || meta.controls || [];
  const devices = opts.devices || meta.devices || [];

  const host = typeof mount === 'string' ? document.querySelector(mount) : mount;
  if (!host) throw new Error(`createDemo: no existe ${mount}`);

  const fig = document.createElement('figure');
  fig.className = 'demo';
  if (id) fig.id = demoAnchor(id);
  fig.innerHTML = `
    <div class="demo-head">
      ${id ? `<span class="demo-id">${id}</span>` : ''}
      <h3>${title}</h3>
      <div class="modes"></div>
    </div>
    ${controlsStrip(controls, devices, modes, noResetKey)}
    <div class="demo-body ${schema ? '' : 'no-panel'}">
      <div class="demo-stage" tabindex="0" aria-label="${title}: área interactiva">
        <canvas></canvas>
        <div class="demo-hud"></div>
        <div class="demo-hint">${hint}</div>
      </div>
      ${touchPad(controls, devices)}
      ${schema ? '<aside class="demo-panel" aria-label="Parámetros"></aside>' : ''}
    </div>
    ${graphOpts ? '<div class="demo-graph-wrap"><canvas></canvas></div>' : ''}
    ${metrics.length ? '<div class="metrics"></div>' : ''}
    ${foot ? `<figcaption class="demo-foot">${foot}</figcaption>` : ''}`;
  host.replaceWith(fig);
  if (panelWidth) fig.querySelector('.demo-body').style.gridTemplateColumns = `minmax(0,1fr) ${panelWidth}px`;

  const stage = fig.querySelector('.demo-stage');
  const canvas = stage.querySelector('canvas');
  const g = canvas.getContext('2d');
  const hudEl = stage.querySelector('.demo-hud');
  canvas.style.aspectRatio = `${width} / ${height}`;
  canvas.style.setProperty('--ar', String(width / height));

  // Escalado: el canvas se dibuja siempre en coordenadas lógicas width×height.
  let scale = 1;
  const panelEl = fig.querySelector('.demo-panel');
  const stacked = matchMedia('(max-width: 880px)');
  function resize() {
    const r = canvas.getBoundingClientRect();
    // En escritorio el panel no supera la altura del canvas (hace scroll); apilado, crece libre.
    if (panelEl) panelEl.style.maxHeight = stacked.matches ? 'none' : `${Math.max(r.height, 260)}px`;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    scale = canvas.width / width;
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  const toLocal = (cx, cy) => {
    const r = canvas.getBoundingClientRect();
    return { x: ((cx - r.left) / r.width) * width, y: ((cy - r.top) / r.height) * height };
  };
  const input = new Input(stage, { toLocal, pointerLock });
  stage.addEventListener('focus', () => stage.classList.add('active'));
  // Botonera táctil: cada botón emite la tecla equivalente, como si viniera del teclado.
  for (const b of fig.querySelectorAll('.touch-pad button')) {
    const code = b.dataset.code;
    const down = (e) => { e.preventDefault(); stage.focus({ preventScroll: true }); b.classList.add('on'); input.emit({ type: 'keydown', code, key: code }); };
    const up = () => { if (!b.classList.contains('on')) return; b.classList.remove('on'); input.emit({ type: 'keyup', code, key: code }); };
    b.addEventListener('pointerdown', down);
    for (const t of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(t, up);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  stage.addEventListener('blur', () => stage.classList.remove('active'));

  // Panel de parámetros.
  const params = schema ? createParams(fig.querySelector('.demo-panel'), schema) : { values: {}, set() {}, setMany() {}, onChange() {} };

  // Métricas.
  const metricEls = {};
  if (metrics.length) {
    const box = fig.querySelector('.metrics');
    for (const m of metrics) {
      const d = document.createElement('div');
      d.className = 'metric';
      d.innerHTML = `<div class="k">${m.label}</div><div class="v">—</div>`;
      box.append(d);
      metricEls[m.key] = d.querySelector('.v');
    }
  }

  const graph = graphOpts ? createGraph(fig.querySelector('.demo-graph-wrap canvas'), graphOpts) : null;

  const api = {
    fig, stage, canvas, input, graph,
    params: params.values,
    paramsApi: params,
    w: width, h: height,
    time: 0,
    mode: null,
    get colors() { return colors(); },
    metric(k, v) { if (metricEls[k] && metricEls[k].textContent !== String(v)) metricEls[k].textContent = v; },
    metricColor(k, c) { if (metricEls[k]) metricEls[k].style.color = c ? (colors()[c] || c) : ''; },
    hud(text) { if (hudEl.textContent !== text) hudEl.textContent = text; },
    reset() { state = setup(api) || {}; graph?.clear(); },
    setMode,
  };

  // Modos (teclas 1..N, como en los ejemplos del libro).
  const modeBox = fig.querySelector('.modes');
  const modeBtns = {};
  function setMode(key) {
    const m = modes.find((x) => x.key === key);
    if (!m) return;
    api.mode = key;
    if (m.values) params.setMany(m.values);
    m.select?.(state, api);
    for (const [k, b] of Object.entries(modeBtns)) b.setAttribute('aria-pressed', String(k === key));
    onModeChange?.(key, state, api);
  }
  for (const m of modes) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn';
    b.innerHTML = `<kbd>${m.key}</kbd>${m.label}`;
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => { setMode(m.key); stage.focus({ preventScroll: true }); });
    modeBox.append(b);
    modeBtns[m.key] = b;
  }
  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'btn';
  resetBtn.innerHTML = '<kbd>R</kbd>Reiniciar';
  resetBtn.addEventListener('click', () => { api.reset(); stage.focus({ preventScroll: true }); });
  modeBox.append(resetBtn);

  // Sonido de esta demo (se recuerda por demo) y pantalla completa.
  const soundKey = id || title;
  const tools = document.createElement('div');
  tools.className = 'demo-tools';
  const muteBtn = document.createElement('button');
  muteBtn.type = 'button';
  muteBtn.className = 'btn icon';
  const paintMute = () => {
    const m = audio.isMuted(soundKey);
    muteBtn.innerHTML = m ? ICONS.off : ICONS.on;
    muteBtn.setAttribute('aria-pressed', String(m));
    muteBtn.setAttribute('aria-label', m ? 'Activar el sonido de esta demo' : 'Silenciar esta demo');
    muteBtn.title = m ? 'Sonido apagado (M)' : 'Sonido encendido (M)';
  };
  const toggleMute = () => { audio.setMuted(soundKey, !audio.isMuted(soundKey)); paintMute(); };
  muteBtn.addEventListener('click', () => { toggleMute(); stage.focus({ preventScroll: true }); });
  paintMute();
  const fsBtn = document.createElement('button');
  fsBtn.type = 'button';
  fsBtn.className = 'btn icon';
  const isFs = () => document.fullscreenElement === fig || document.webkitFullscreenElement === fig || fig.classList.contains('pseudo-fs');
  const paintFs = () => {
    const on = isFs();
    fsBtn.innerHTML = on ? ICONS.exitFs : ICONS.fs;
    fsBtn.setAttribute('aria-pressed', String(on));
    fsBtn.setAttribute('aria-label', on ? 'Salir de pantalla completa' : 'Pantalla completa');
    fsBtn.title = on ? 'Salir de pantalla completa (F · Esc)' : 'Pantalla completa (F)';
  };
  const toggleFs = () => {
    if (isFs()) {
      if (fig.classList.contains('pseudo-fs')) { fig.classList.remove('pseudo-fs'); document.documentElement.classList.remove('has-pseudo-fs'); }
      else (document.exitFullscreen || document.webkitExitFullscreen).call(document)?.catch?.(() => {});
    } else if (fig.requestFullscreen || fig.webkitRequestFullscreen) {
      const r = (fig.requestFullscreen || fig.webkitRequestFullscreen).call(fig);
      r?.catch?.(() => { fig.classList.add('pseudo-fs'); paintFs(); });
    } else {
      // iPhone no permite pantalla completa en elementos que no son video: se ocupa toda la ventana.
      fig.classList.add('pseudo-fs');
      document.documentElement.classList.add('has-pseudo-fs');
    }
    paintFs();
    stage.focus({ preventScroll: true });
  };
  fsBtn.addEventListener('click', toggleFs);
  for (const ev of ['fullscreenchange', 'webkitfullscreenchange']) document.addEventListener(ev, () => { paintFs(); resize(); });
  paintFs();
  tools.append(muteBtn, fsBtn);
  modeBox.append(tools);
  // La demo que recibe input o corre su bucle es la "dueña" de los sonidos que se disparen.
  for (const ev of ['pointerdown', 'keydown', 'click']) fig.addEventListener(ev, () => { audio.scope = soundKey; }, true);

  input.onEvent((ev) => {
    if (ev.type !== 'keydown') return;
    if (ev.code === 'KeyR' && !noResetKey) api.reset();
    if (ev.code === 'KeyM') toggleMute();
    if (ev.code === 'KeyF') toggleFs();
    if (ev.code === 'Escape' && fig.classList.contains('pseudo-fs')) toggleFs();
    const digit = ev.code.startsWith('Digit') ? ev.code.slice(5) : null;
    if (digit && modeBtns[digit]) setMode(digit);
  });

  let state = setup(api) || {};

  const loop = createLoop({
    hz,
    observe: fig,
    update(dt) {
      audio.scope = soundKey;
      input.pollGamepad();
      api.time += dt;
      update(state, dt, api);
      input.clearEdges();
    },
    render(alpha, stats) {
      audio.scope = soundKey;
      api.fps = stats.fps;
      g.setTransform(scale, 0, 0, scale, 0, 0);
      g.clearRect(0, 0, width, height);
      render(g, state, api);
      graph?.draw();
    },
  });
  api.loop = loop;

  if (startMode) setMode(startMode);
  else if (modes.length) setMode(modes[0].key);
  loop.start();
  return api;
}

// Franja "Controles": dispositivos + lista de acciones. Los modos y R se agregan solos.
const svg = (d) => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICONS = {
  on: svg('<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 9a4 4 0 0 1 0 6"/><path d="M18.5 6.5a8 8 0 0 1 0 11"/>'),
  off: svg('<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9l5 6M22 9l-5 6"/>'),
  fs: svg('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  exitFs: svg('<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>'),
};

function controlsStrip(controls, devices, modes, noResetKey) {
  const rows = [...controls];
  if (modes.length) rows.push([modes.length > 1 ? `1–${modes.length}` : '1', 'cambiar de modo / preset (también con los botones)']);
  if (!noResetKey && !controls.some(([k]) => k === 'R')) rows.push(['R', 'reiniciar']);
  rows.push(['M · F', 'silenciar esta demo · pantalla completa (Esc para salir)']);
  if (!rows.length) return '';
  const dev = devices.map((d) => `<span class="dev">${DEVICE_LABEL[d] || d}</span>`).join('');
  const items = rows.map(([k, v]) => `<li><span class="ctl-k">${k}</span><span class="ctl-v">${v}</span></li>`).join('');
  // Abierta en escritorio; plegada en móvil para no empujar el canvas fuera de la vista.
  const open = matchMedia('(max-width: 560px)').matches ? '' : ' open';
  return `<details class="demo-controls"${open}>
      <summary><span>Controles</span>${dev}</summary>
      <ul>${items}</ul>
    </details>`;
}

// Botonera táctil para demos de teclado: solo en pantallas táctiles (pointer: coarse).
// Los botones salen de la lista de controles: flechas si hay movimiento, y las teclas de acción que se mencionen.
function touchPad(controls, devices) {
  if (!devices.includes('teclado') || !matchMedia('(pointer: coarse)').matches) return '';
  const keys = controls.map(([k]) => k).join(' | ');
  const arrows = /flechas|W A S D|A \/ D|A · D|←|→|↑|↓|W \/ S|W · S|W · ↑/.test(keys);
  const extra = [
    [/Espacio/, 'Space', 'Espacio'], [/\bJ\b/, 'KeyJ', 'J'], [/\bK\b/, 'KeyK', 'K'], [/Shift/, 'ShiftLeft', 'Shift'],
    [/\bQ\b/, 'KeyQ', 'Q'], [/\bE\b/, 'KeyE', 'E'], [/^P\b|\| P\b/, 'KeyP', 'P'],
  ].filter(([re]) => re.test(keys));
  if (!arrows && !extra.length) return '';
  const btn = (code, label, cls = '') => `<button type="button" class="btn ${cls}" data-code="${code}" aria-label="${label}">${label}</button>`;
  return `<div class="touch-pad">
      ${arrows ? `<div class="tp-arrows">${btn('ArrowUp', '↑', 'up')}${btn('ArrowLeft', '←', 'left')}${btn('ArrowDown', '↓', 'down')}${btn('ArrowRight', '→', 'right')}</div>` : ''}
      <div class="tp-actions">${extra.map(([, code, label]) => btn(code, label)).join('')}</div>
    </div>`;
}

// ---------- Utilidades de dibujo compartidas ----------

export function drawGrid(g, w, h, step = 40, color) {
  g.strokeStyle = color || colors().grid;
  g.lineWidth = 1;
  g.beginPath();
  for (let x = step; x < w; x += step) { g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, h); }
  for (let y = step; y < h; y += step) { g.moveTo(0, y + 0.5); g.lineTo(w, y + 0.5); }
  g.stroke();
}

export function text(g, str, x, y, { color, size = 13, align = 'left', baseline = 'alphabetic', weight = 500, mono = false } = {}) {
  g.fillStyle = color || colors().muted;
  g.font = `${weight} ${size}px ${mono ? 'JetBrains Mono, ui-monospace, monospace' : 'Inter, system-ui, sans-serif'}`;
  g.textAlign = align;
  g.textBaseline = baseline;
  g.fillText(str, x, y);
}

export function roundRect(g, x, y, w, h, r = 6) {
  g.beginPath();
  g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h);
}
