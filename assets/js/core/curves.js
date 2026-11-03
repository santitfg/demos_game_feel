// Curvas de respuesta, zonas muertas, envolventes ADSR y suavizados.
// Todas las curvas de mapeo trabajan en 0..1 → 0..1; `signed()` las extiende a -1..1.

export const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;

// ---------- Curvas de mapeo input → output ----------

export const CURVES = {
  linear: { label: 'Lineal', fn: (x) => x },
  quadratic: { label: 'Cuadrática (x²)', fn: (x) => x * x },
  cubic: { label: 'Cúbica (x³)', fn: (x) => x * x * x },
  sqrt: { label: 'Raíz (√x) — sensible al centro', fn: (x) => Math.sqrt(x) },
  expo: { label: 'Exponencial', fn: (x, k = 4) => (Math.exp(k * x) - 1) / (Math.exp(k) - 1) },
  sCurve: { label: 'Curva S', fn: (x, k = 2.5) => { const a = x ** k; return a / (a + (1 - x) ** k); } },
  steps: { label: 'Escalonada (4)', fn: (x, n = 4) => Math.round(x * n) / n },
  digital: { label: 'Digital (on/off)', fn: (x) => (x > 0.5 ? 1 : 0) },
};

// Potencia genérica: p < 1 sensible al centro, p > 1 suave al centro (estilo GTA, fig. 7.19).
export const power = (x, p) => Math.pow(clamp(x), p);

// Bezier cúbica con extremos (0,0) y (1,1), como cubic-bezier() de CSS.
export function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t;
  const sy = (t) => ((ay * t + by) * t + cy) * t;
  const dsx = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    x = clamp(x);
    // Newton, con bisección de respaldo si la derivada es casi cero.
    let t = x;
    for (let i = 0; i < 8; i++) {
      const e = sx(t) - x;
      if (Math.abs(e) < 1e-6) return sy(t);
      const d = dsx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    let lo = 0, hi = 1;
    t = x;
    for (let i = 0; i < 30; i++) {
      const v = sx(t);
      if (Math.abs(v - x) < 1e-6) break;
      if (v < x) lo = t; else hi = t;
      t = (lo + hi) / 2;
    }
    return sy(t);
  };
}

// Aplica una curva 0..1 a un valor con signo -1..1 de forma simétrica.
export const signed = (fn, x) => Math.sign(x) * fn(Math.abs(x));

// ---------- Zonas muertas ----------

// 1D: por debajo de `inner` → 0; por encima de `outer` → 1; en medio se reescala a 0..1.
export function deadzone1D(x, inner = 0.15, outer = 1) {
  const a = Math.abs(x);
  if (a <= inner) return 0;
  return Math.sign(x) * clamp((a - inner) / Math.max(1e-6, outer - inner));
}

// 2D: tres estrategias clásicas para sticks.
//  - axial: zona muerta independiente por eje (forma de cruz; "pega" a los ejes)
//  - radial: corta por magnitud, sin reescalar (salto brusco al salir de la zona)
//  - scaled: radial y reescalada (suave desde el borde de la zona muerta)
export function deadzone2D(x, y, inner = 0.2, outer = 1, mode = 'scaled') {
  if (mode === 'axial') {
    return { x: deadzone1D(x, inner, outer), y: deadzone1D(y, inner, outer) };
  }
  const m = Math.hypot(x, y);
  if (m <= inner) return { x: 0, y: 0 };
  if (mode === 'radial') {
    const k = m > 1 ? 1 / m : 1;
    return { x: x * k, y: y * k };
  }
  const nm = clamp((m - inner) / Math.max(1e-6, outer - inner));
  return { x: (x / m) * nm, y: (y / m) * nm };
}

// ---------- Envolvente ADSR ----------
// Valor objetivo (0..1, multiplicado por `peak`) en función del tiempo desde que se pulsa,
// del estado de la tecla y del nivel desde el que se inició el release.
// Los tiempos están en segundos; `shape` > 1 curva las rampas (más lento al principio).

export class ADSR {
  constructor(p) {
    this.p = { attack: 0.25, decay: 0.1, sustain: 0.8, release: 0.3, peak: 1, shape: 1, ...p };
    this.level = 0;
    this.phase = 'idle';
    this.t = 0;
    this.from = 0;
  }
  set(p) { Object.assign(this.p, p); }
  update(dt, gate) {
    const { attack, decay, sustain, release, peak } = this.p;
    if (gate && (this.phase === 'idle' || this.phase === 'release')) {
      this.phase = 'attack';
      this.t = 0;
      this.from = this.level;
    } else if (!gate && this.phase !== 'idle' && this.phase !== 'release') {
      this.phase = 'release';
      this.t = 0;
      this.from = this.level;
    }
    this.t += dt;
    const ramp = (t, dur) => (dur <= 0 ? 1 : Math.pow(clamp(t / dur), this.p.shape));
    switch (this.phase) {
      case 'attack':
        this.level = lerp(this.from, peak, ramp(this.t, attack));
        if (this.t >= attack) { this.phase = 'decay'; this.t = 0; }
        break;
      case 'decay':
        this.level = lerp(peak, sustain, ramp(this.t, decay));
        if (this.t >= decay) { this.phase = 'sustain'; this.t = 0; }
        break;
      case 'sustain':
        this.level = sustain;
        break;
      case 'release':
        this.level = lerp(this.from, 0, ramp(this.t, release));
        if (this.t >= release) { this.phase = 'idle'; this.level = 0; }
        break;
      default:
        this.level = 0;
    }
    return this.level;
  }
}

// Forma estática de la envolvente para dibujarla: puntos [t, v] con la tecla
// sostenida `hold` segundos después del ataque+decay.
export function adsrShape(p, hold = 0.5, n = 120) {
  const env = new ADSR(p);
  const total = p.attack + p.decay + hold + p.release + 0.05;
  const pts = [];
  const dt = total / n;
  for (let i = 0; i <= n; i++) {
    const t = i * dt;
    const gate = t < p.attack + p.decay + hold;
    pts.push([t, env.update(i === 0 ? 0 : dt, gate)]);
  }
  return { pts, total, releaseAt: p.attack + p.decay + hold };
}

// ---------- Suavizados (todos independientes del framerate) ----------

// Acerca `current` a `target` una fracción por segundo: 1 - e^(-rate·dt).
export const expSmooth = (current, target, rate, dt) => current + (target - current) * (1 - Math.exp(-rate * dt));

// Avanza hacia el objetivo con velocidad máxima constante (lineal, sin curva).
export function moveTowards(current, target, maxDelta) {
  const d = target - current;
  if (Math.abs(d) <= maxDelta) return target;
  return current + Math.sign(d) * maxDelta;
}

// Resorte-amortiguador (masa m, rigidez k, amortiguación c). Euler semi-implícito.
// s = { x, v } (se modifica). Devuelve s.
export function springStep(s, target, { k = 120, c = 12, m = 1 }, dt) {
  const f = -k * (s.x - target) - c * s.v;
  s.v += (f / m) * dt;
  s.x += s.v * dt;
  return s;
}
export const dampingRatio = (k, c, m) => c / (2 * Math.sqrt(k * m));
export const criticalDamping = (k, m) => 2 * Math.sqrt(k * m);
