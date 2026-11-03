// Bucle de juego con paso fijo para la simulación y render en requestAnimationFrame.
// - update(dt) corre a `hz` pasos por segundo, independiente del refresco del monitor.
// - render() corre una vez por frame mostrado.
// - maxFps (opcional) descarta frames de rAF para simular tasas bajas (10, 20, 30 fps).
// - Se pausa sola cuando el elemento observado sale de pantalla o la pestaña se oculta.

export function createLoop({ update, render, hz = 120, maxFps = 0, observe = null, onFrame = null }) {
  const step = 1 / hz;
  let acc = 0;
  let last = 0;
  let lastShown = 0;
  let raf = 0;
  let running = false;
  let visible = true;
  let cap = maxFps;
  let frameStats = { dt: 0, fps: 0 };

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (cap > 0) {
      const interval = 1000 / cap;
      // Tolerancia de 1 ms para no perder frames por redondeo del vsync.
      if (now - lastShown < interval - 1) return;
      lastShown = now - ((now - lastShown) % interval);
    }
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25; // evita la "espiral de la muerte" tras pausas largas
    acc += dt;
    let steps = 0;
    while (acc >= step) {
      update(step, steps === 0, now);
      acc -= step;
      steps++;
    }
    frameStats.dt = dt;
    frameStats.fps = frameStats.fps * 0.9 + (dt > 0 ? 1 / dt : 0) * 0.1;
    render(acc / step, frameStats, now);
    if (onFrame) onFrame(now);
  }

  function start() {
    if (running || !visible || document.hidden) return;
    running = true;
    last = performance.now();
    lastShown = last;
    acc = 0;
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  if (observe && 'IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      visible ? start() : stop();
    }).observe(observe);
  }
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

  return {
    start,
    stop,
    get running() { return running; },
    setMaxFps(f) { cap = f; },
    get stats() { return frameStats; },
  };
}
