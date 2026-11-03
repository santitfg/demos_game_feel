// Input unificado: teclado, puntero (mouse/táctil) y gamepad.
//
// Todo pasa por eventos con timestamp que se aplican a un InputState. Así, el
// laboratorio de lag puede interponer una cola de retardo (ver lag.js) y obtener
// otro InputState con la misma interfaz, pero "llegando tarde".

export class InputState {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();
    this.released = new Set();
    this.mouse = { x: 0, y: 0, dx: 0, dy: 0, down: false, inside: false };
    this.mousePressed = false;
    this.mouseReleased = false;
    this.pad = { connected: false, lx: 0, ly: 0, rx: 0, ry: 0, lt: 0, rt: 0, buttons: [] };
    this.padPressed = new Set();
  }

  apply(ev) {
    switch (ev.type) {
      case 'keydown':
        if (!this.keys.has(ev.code)) this.pressed.add(ev.code);
        this.keys.add(ev.code);
        break;
      case 'keyup':
        this.keys.delete(ev.code);
        this.released.add(ev.code);
        break;
      case 'move':
        this.mouse.dx += ev.x - this.mouse.x;
        this.mouse.dy += ev.y - this.mouse.y;
        this.mouse.x = ev.x;
        this.mouse.y = ev.y;
        this.mouse.inside = true;
        break;
      case 'rel': // movimiento relativo (pointer lock)
        this.mouse.dx += ev.dx;
        this.mouse.dy += ev.dy;
        break;
      case 'down':
        this.mouse.x = ev.x;
        this.mouse.y = ev.y;
        this.mouse.down = true;
        this.mousePressed = true;
        break;
      case 'up':
        this.mouse.down = false;
        this.mouseReleased = true;
        break;
      case 'leave':
        this.mouse.inside = false;
        break;
      case 'pad': {
        const prev = this.pad.buttons;
        ev.pad.buttons.forEach((b, i) => { if (b && !prev[i]) this.padPressed.add(i); });
        this.pad = ev.pad;
        break;
      }
      case 'blur':
        this.keys.clear();
        this.mouse.down = false;
        break;
    }
  }

  isDown(...codes) { return codes.some((c) => this.keys.has(c)); }
  wasPressed(...codes) { return codes.some((c) => this.pressed.has(c)); }
  wasReleased(...codes) { return codes.some((c) => this.released.has(c)); }

  // Eje digital -1..1 a partir de teclas (p.ej. axis(['KeyA','ArrowLeft'], ['KeyD','ArrowRight'])).
  axis(neg, pos) {
    return (this.isDown(...pos) ? 1 : 0) - (this.isDown(...neg) ? 1 : 0);
  }

  // Limpia los flancos (pressed/released) tras un paso de simulación.
  clearEdges() {
    this.pressed.clear();
    this.released.clear();
    this.padPressed.clear();
    this.mousePressed = false;
    this.mouseReleased = false;
    this.mouse.dx = 0;
    this.mouse.dy = 0;
  }
}

const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'PageUp', 'PageDown']);

// Conecta un elemento del DOM a un InputState. `toLocal(clientX, clientY)` convierte
// coordenadas de pantalla a coordenadas lógicas de la demo.
export class Input extends InputState {
  constructor(el, { toLocal, pointerLock = false } = {}) {
    super();
    this.el = el;
    this.listeners = [];
    this.toLocal = toLocal || ((x, y) => {
      const r = el.getBoundingClientRect();
      return { x: x - r.left, y: y - r.top };
    });
    this.pointerLock = pointerLock;
    this.locked = false;

    const emit = (ev) => {
      ev.t = performance.now();
      this.apply(ev);
      for (const fn of this.listeners) fn(ev);
    };
    this.emit = emit;

    el.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (SCROLL_KEYS.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      emit({ type: 'keydown', code: e.code, key: e.key });
    });
    el.addEventListener('keyup', (e) => emit({ type: 'keyup', code: e.code, key: e.key }));
    el.addEventListener('blur', () => emit({ type: 'blur' }));

    el.addEventListener('pointermove', (e) => {
      if (this.locked) {
        emit({ type: 'rel', dx: e.movementX, dy: e.movementY });
        return;
      }
      // Eventos agrupados: usar todos los puntos intermedios para un trazo fino.
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const ce of (evs.length ? evs : [e])) {
        const p = this.toLocal(ce.clientX, ce.clientY);
        emit({ type: 'move', x: p.x, y: p.y });
      }
    });
    el.addEventListener('pointerdown', (e) => {
      el.focus({ preventScroll: true });
      if (this.pointerLock && !this.locked && el.requestPointerLock) {
        // Puede fallar (iframes, headless, permisos): la demo sigue funcionando sin captura.
        try { el.requestPointerLock()?.catch?.(() => {}); } catch { /* sin pointer lock */ }
      }
      try { el.setPointerCapture(e.pointerId); } catch { /* algunos navegadores */ }
      const p = this.toLocal(e.clientX, e.clientY);
      emit({ type: 'down', x: p.x, y: p.y, button: e.button });
    });
    el.addEventListener('pointerup', (e) => {
      const p = this.toLocal(e.clientX, e.clientY);
      emit({ type: 'up', x: p.x, y: p.y, button: e.button });
    });
    el.addEventListener('pointercancel', () => emit({ type: 'up' }));
    el.addEventListener('pointerleave', () => emit({ type: 'leave' }));
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === el;
    });
  }

  onEvent(fn) { this.listeners.push(fn); }

  // Llamar una vez por frame: la Gamepad API no emite eventos de ejes.
  pollGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = [...pads].find((p) => p && p.connected);
    if (!gp) {
      if (this.pad.connected) this.emit({ type: 'pad', pad: { connected: false, lx: 0, ly: 0, rx: 0, ry: 0, lt: 0, rt: 0, buttons: [] } });
      return;
    }
    const a = gp.axes;
    const pad = {
      connected: true,
      id: gp.id,
      lx: a[0] || 0, ly: a[1] || 0, rx: a[2] || 0, ry: a[3] || 0,
      lt: gp.buttons[6]?.value || 0, rt: gp.buttons[7]?.value || 0,
      buttons: gp.buttons.map((b) => b.pressed),
      raw: gp,
    };
    const p = this.pad;
    const changed = !p.connected || pad.lx !== p.lx || pad.ly !== p.ly || pad.rx !== p.rx || pad.ry !== p.ry ||
      pad.lt !== p.lt || pad.rt !== p.rt || pad.buttons.some((b, i) => b !== p.buttons[i]);
    if (changed) this.emit({ type: 'pad', pad });
  }
}
