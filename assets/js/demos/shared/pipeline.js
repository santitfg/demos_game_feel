// Tubería simulada de un juego: input → (retraso + jitter) → simulación → imagen (tope de fps, tirones).
//
// const pipe = new Pipeline(api.input);              // una vez por demo (no en setup: suma listeners)
// update: pipe.configure({...}); if (pipe.step()) { …usar pipe.input… } pipe.endStep();
// render: if (pipe.present()) state.view = foto del estado;  …dibujar state.view…
//
// Mide lo inyectado con performance.now(): `avgInjected` (input → simulación) y
// `avgScreen` (input → frame mostrado, incluye lo que el frame queda congelado).

import { LaggedInput } from '../../core/lag.js';

export class Pipeline {
  constructor(source, opts = {}) {
    this.input = new LaggedInput(source);
    this.fps = 0;
    this.hitchRate = 0; // tirones cada 10 s (promedio)
    this.hitchMs = 0;
    this.hitchUntil = 0;
    this.nextHitch = Infinity;
    this.hitches = 0;
    this.lastPresent = -Infinity;
    this.oldestT = null; // evento más viejo aplicado y aún no mostrado
    this.newestT = null; // evento más nuevo aplicado y aún no mostrado
    this.screen = [];
    this.frames = [];
    this.configure(opts);
  }

  configure({ delay, jitter, fps, hitchRate, hitchMs } = {}) {
    if (delay != null) this.input.delay = +delay;
    if (jitter != null) this.input.jitter = +jitter;
    if (fps != null) this.fps = +fps;
    if (hitchMs != null) this.hitchMs = +hitchMs;
    if (hitchRate != null && +hitchRate !== this.hitchRate) {
      this.hitchRate = +hitchRate;
      this.schedule(performance.now());
    }
  }

  // Tirones con llegada aleatoria (proceso de Poisson): no se pueden anticipar.
  schedule(now) {
    this.nextHitch = this.hitchRate > 0 ? now - Math.log(1 - Math.random()) * (10000 / this.hitchRate) : Infinity;
  }

  hitched(now = performance.now()) { return now < this.hitchUntil; }

  // Al empezar cada paso de simulación. Devuelve false durante un tirón: el juego no procesa input.
  step(now = performance.now()) {
    if (now >= this.nextHitch) {
      this.hitchUntil = now + this.hitchMs;
      this.hitches++;
      this.schedule(this.hitchUntil);
    }
    if (this.hitched(now)) return false;
    const q = this.input.queue;
    for (const it of q) {
      if (it.due > now) break;
      if (this.oldestT == null) this.oldestT = it.ev.t;
      this.newestT = it.ev.t;
    }
    this.input.pump(now);
    return true;
  }

  endStep() { this.input.clearEdges(); }

  // En cada render: ¿se muestra un frame nuevo? Con tope de fps o durante un tirón, la imagen se congela.
  present(now = performance.now()) {
    if (this.hitched(now)) return false;
    if (this.fps > 0) {
      const iv = 1000 / this.fps;
      if (now - this.lastPresent < iv - 1) return false;
      this.lastPresent = now - this.lastPresent > iv * 2 ? now : this.lastPresent + iv;
    } else {
      this.lastPresent = now;
    }
    this.frames.push(now);
    while (this.frames.length && this.frames[0] < now - 1000) this.frames.shift();
    if (this.oldestT != null) {
      // Promedio entre el evento más viejo y el más nuevo que estrena este frame.
      this.screen.push(now - (this.oldestT + this.newestT) / 2);
      if (this.screen.length > 40) this.screen.shift();
      this.oldestT = this.newestT = null;
    }
    return true;
  }

  get shownFps() { return this.frames.length; }
  get avgInjected() { return this.input.avgMeasured; }
  get avgScreen() {
    if (!this.screen.length) return 0;
    return this.screen.reduce((a, b) => a + b, 0) / this.screen.length;
  }
}

export const FPS_OPTIONS = [
  ['0', 'Sin tope (tu monitor)'],
  ['60', '60 fps'],
  ['30', '30 fps'],
  ['20', '20 fps'],
  ['10', '10 fps'],
  ['5', '5 fps'],
];
