// Sonidos sintetizados con WebAudio: sin archivos, se crean bajo demanda.
// El AudioContext se inicia tras el primer gesto del usuario (requisito de los navegadores).

let ac = null;
let master = null;
let enabled = true;
// Silencio por demo: createDemo marca qué demo está sonando (scope) mientras corre su update/render.
let scope = null;
const muted = new Set();
try { JSON.parse(localStorage.getItem('gf-muted') || '[]').forEach((id) => muted.add(id)); } catch { /* sin almacenamiento */ }
const silent = () => !enabled || (scope != null && muted.has(scope));

function ctx() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = 0.5;
    master.connect(ac.destination);
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
['pointerdown', 'keydown'].forEach((t) => window.addEventListener(t, () => ctx(), { once: true, capture: true }));

export const audio = {
  set enabled(v) { enabled = v; },
  get enabled() { return enabled; },
  set scope(id) { scope = id; },
  isMuted: (id) => muted.has(id),
  setMuted(id, v) {
    if (v) muted.add(id); else muted.delete(id);
    try { localStorage.setItem('gf-muted', JSON.stringify([...muted])); } catch { /* sin almacenamiento */ }
  },

  // Tono corto con envolvente: freq en Hz, dur en s, slide = multiplicador de frecuencia final.
  tone({ freq = 440, dur = 0.12, type = 'sine', gain = 0.3, slide = 1, attack = 0.005 } = {}) {
    const a = !silent() && ctx();
    if (!a) return;
    const t = a.currentTime;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide !== 1) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  },

  // Ruido filtrado: golpes, roces, impactos.
  noise({ dur = 0.15, gain = 0.3, freq = 800, q = 1, type = 'lowpass' } = {}) {
    const a = !silent() && ctx();
    if (!a) return;
    const t = a.currentTime;
    const len = Math.ceil(a.sampleRate * dur);
    const buf = a.createBuffer(1, len, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
    const src = a.createBufferSource();
    src.buffer = buf;
    const f = a.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = a.createGain();
    g.gain.value = gain;
    src.connect(f).connect(g).connect(master);
    src.start(t);
  },

  // Golpe sordo cuya gravedad depende de la "masa" (0..1): más masa, más grave y largo.
  thud(mass = 0.5, intensity = 1) {
    const m = Math.max(0, Math.min(1, mass));
    const i = Math.max(0, Math.min(1, intensity));
    this.tone({ freq: 160 - m * 110, dur: 0.08 + m * 0.25, type: 'sine', gain: 0.5 * i, slide: 0.5 });
    this.noise({ dur: 0.05 + m * 0.12, gain: 0.25 * i, freq: 1400 - m * 1100 });
  },

  // Sonido continuo (motor, zumbido): set({ freq, gain }) cada frame. Si deja de llamarse
  // (demo fuera de pantalla o en pausa) se apaga solo a los 150 ms.
  drone({ type = 'sawtooth', filter = 900 } = {}) {
    let osc = null;
    let g = null;
    let timer = null;
    const fade = () => { if (g) g.gain.setTargetAtTime(0, ac.currentTime, 0.05); };
    return {
      set({ freq = 80, gain = 0.1 } = {}) {
        const a = !silent() && ac && ac.state === 'running' ? ac : null;
        if (!a) { fade(); return; }
        if (!osc) {
          osc = a.createOscillator();
          osc.type = type;
          const f = a.createBiquadFilter();
          f.type = 'lowpass';
          f.frequency.value = filter;
          g = a.createGain();
          g.gain.value = 0;
          osc.connect(f).connect(g).connect(master);
          osc.start();
        }
        osc.frequency.setTargetAtTime(freq, a.currentTime, 0.03);
        g.gain.setTargetAtTime(gain, a.currentTime, 0.05);
        clearTimeout(timer);
        timer = setTimeout(fade, 150);
      },
      stop: fade,
    };
  },

  click() { this.tone({ freq: 1800, dur: 0.03, type: 'square', gain: 0.08 }); },
  blip(freq = 660) { this.tone({ freq, dur: 0.08, type: 'triangle', gain: 0.2 }); },
};
