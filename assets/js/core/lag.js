// Inyección de latencia: una cola que retiene los eventos de input y los aplica a un
// InputState propio cuando "llega su hora". Mantiene el orden de los eventos aunque
// haya jitter (un evento nunca adelanta al anterior), igual que un pipeline real.

import { InputState } from './input.js';

export class LaggedInput extends InputState {
  constructor(source, { delay = 0, jitter = 0 } = {}) {
    super();
    this.delay = delay; // ms
    this.jitter = jitter; // ms (desviación máxima, uniforme ±jitter/2 … +jitter)
    this.queue = [];
    this.lastDue = 0;
    this.measured = []; // latencias efectivas recientes (ms), para verificar el slider
    source.onEvent((ev) => this.push(ev));
  }

  push(ev) {
    const j = this.jitter > 0 ? Math.random() * this.jitter : 0;
    const due = Math.max(this.lastDue, ev.t + this.delay + j);
    this.lastDue = due;
    this.queue.push({ ev, due });
  }

  // Aplica los eventos vencidos. Llamar al inicio de cada paso de simulación.
  pump(now = performance.now()) {
    while (this.queue.length && this.queue[0].due <= now) {
      const { ev } = this.queue.shift();
      this.apply(ev);
      this.measured.push(now - ev.t);
      if (this.measured.length > 60) this.measured.shift();
    }
  }

  get avgMeasured() {
    if (!this.measured.length) return 0;
    return this.measured.reduce((a, b) => a + b, 0) / this.measured.length;
  }

  flush() {
    for (const { ev } of this.queue) this.apply(ev);
    this.queue.length = 0;
  }
}

// Bandas de percepción de latencia según el cap. 2 (Card, Moran y Newell; Mick West; Miller).
export const LAG_BANDS = [
  { max: 50, label: 'Instantáneo', color: 'good', note: 'Dentro de un ciclo perceptivo: se siente como causa-efecto directo.' },
  { max: 100, label: 'Ajustado ("tight")', color: 'good', note: 'Aún se percibe como respuesta inmediata.' },
  { max: 200, label: 'Lag notable', color: 'warn', note: 'Se nota, pero se puede ignorar o compensar.' },
  { max: 240, label: 'Lento', color: 'warn', note: 'El control se siente pesado y torpe.' },
  { max: Infinity, label: 'Control roto', color: 'bad', note: 'Más que un ciclo de corrección (240 ms): el jugador actúa antes de ver el efecto.' },
];
export const lagBand = (ms) => LAG_BANDS.find((b) => ms <= b.max);
