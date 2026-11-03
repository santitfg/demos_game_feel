// CH15-1 · Movimiento 3D analógico: una cápsula sobre un plano, relativa a la cámara.
// Curva stick→velocidad (fig. 15.6), giro mezclado por frame, frenada con pie plantado, cadena de saltos y deslizamiento.
// Sandbox de la mecánica analizada en el cap. 15: formas abstractas y escenario propio.

import { createDemo, text } from '../core/demo.js';
import { audio } from '../core/audio.js';
import { drawCurvePlot } from '../core/plot.js';
import { createThreeView, THREE } from './shared/three-view.js';
import { mulberry } from './shared/rand.js';

const R = 0.4; // radio de la cápsula
const HEIGHT = 1.6;
const BOXES = [];

// Curva del libro, aproximada: zona muerta, rampa y meseta. "Lineal" para comparar.
export function stickToSpeed(d, curve) {
  if (curve === 'linear') return Math.min(1, d);
  if (d < 0.12) return 0;
  if (d < 0.25) return ((d - 0.12) / 0.13) * 0.25; // pasos de puntillas
  if (d < 0.85) return 0.25 + ((d - 0.25) / 0.6) * 0.75;
  return 1;
}

export function mountCapsule(mount, { id = 'CH15-1' } = {}) {
  const view = createThreeView();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fc3e6);
  scene.fog = new THREE.Fog(0x9fc3e6, 30, 90);
  const camera = new THREE.PerspectiveCamera(60, 900 / 460, 0.1, 200);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6b7a5a, 1.5));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(10, 20, 6);
  scene.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshLambertMaterial({ color: 0x7fa65a }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  const grid = new THREE.GridHelper(120, 60, 0x5d7f42, 0x6b8f4c);
  grid.position.y = 0.01;
  scene.add(grid);
  const rand = mulberry(15);
  const boxMat = new THREE.MeshLambertMaterial({ color: 0xc9a36a });
  const topMat = new THREE.MeshLambertMaterial({ color: 0xe0612f });
  if (!BOXES.length) {
    for (let i = 0; i < 14; i++) {
      const w = 2 + rand() * 4;
      const d = 2 + rand() * 4;
      const h = 0.6 + rand() * 2.4;
      const x = (rand() - 0.5) * 50;
      const z = (rand() - 0.5) * 50;
      if (Math.hypot(x, z) < 6) continue;
      BOXES.push({ x, z, w, d, h });
    }
    // Escalera de plataformas para probar la cadena de saltos.
    BOXES.push({ x: 8, z: -6, w: 3, d: 3, h: 1.2 }, { x: 12, z: -9, w: 3, d: 3, h: 2.6 }, { x: 16, z: -12, w: 3, d: 3, h: 4.2 });
  }
  for (const b of BOXES) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), [boxMat, boxMat, topMat, boxMat, boxMat, boxMat]);
    m.position.set(b.x, b.h / 2, b.z);
    scene.add(m);
  }
  const capsule = new THREE.Mesh(new THREE.CapsuleGeometry(R, HEIGHT - 2 * R, 6, 14), new THREE.MeshLambertMaterial({ color: 0xd94a3d }));
  scene.add(capsule);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.35), new THREE.MeshLambertMaterial({ color: 0x2b2b2b }));
  scene.add(nose);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(R * 1.1, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 }));
  shadow.rotation.x = -Math.PI / 2;
  scene.add(shadow);

  const floorAt = (x, z, y) => {
    let f = 0;
    for (const b of BOXES) if (Math.abs(x - b.x) < b.w / 2 + R * 0.5 && Math.abs(z - b.z) < b.d / 2 + R * 0.5 && y >= b.h - 0.35) f = Math.max(f, b.h);
    return f;
  };

  return createDemo({
    mount,
    id,
    title: 'Cápsula analógica: correr, girar y encadenar saltos',
    width: 900,
    height: 460,
    hint: 'Clic aquí · W A S D o stick · arrastrar = stick virtual · Espacio saltar · Shift agacharse · Q/E cámara',
    params: [
      { key: 'curve', type: 'select', label: 'Stick → velocidad', options: [['book', 'Curva del libro (fig. 15.6)'], ['linear', 'Lineal']], value: 'book' },
      { key: 'speed', label: 'Velocidad máxima', min: 2, max: 16, step: 0.5, value: 8, unit: 'm/s' },
      { key: 'blend', label: 'Mezcla de rumbo por segundo', min: 1, max: 40, step: 0.5, value: 10, help: 'Cuánto se acerca el rumbo actual al deseado en cada instante. Alto = giro seco; bajo = curva amplia.' },
      { key: 'plant', type: 'check', label: 'Frenada con pie plantado (giro > 90°)', value: true },
      { key: 'chain', type: 'check', label: 'Cadena de saltos (doble y triple)', value: true },
      { key: 'window', label: 'Ventana para encadenar', min: 0.05, max: 0.6, step: 0.01, value: 0.2, unit: 's' },
      { key: 'camLag', label: 'Retraso de la cámara', min: 0, max: 1, step: 0.01, value: 0.25, unit: 's' },
    ],
    metrics: [
      { key: 'state', label: 'Estado' },
      { key: 'stick', label: 'Desplazamiento del stick' },
      { key: 'speed', label: 'Velocidad' },
      { key: 'jump', label: 'Último salto' },
    ],
    foot: `<p><strong>Prueba esto:</strong> con un gamepad, o arrastrando el mouse como stick virtual, inclina el stick de a poco: la cápsula pasa de
      andar de puntillas a trotar y a correr según cuánto lo inclines, siguiendo la curva del gráfico. Con el teclado solo hay "parado" y "a fondo".
      Gira en redondo y la cápsula planta el pie, frena y arranca para el otro lado. Corre y salta al tocar el suelo tres veces seguidas: doble y
      triple, cada uno más alto. Agáchate (<kbd>Shift</kbd>) corriendo y te deslizas. La escalera de cajas naranjas está para probar la cadena.</p>`,

    setup() {
      return { x: 0, y: 0, z: 0, vy: 0, heading: Math.PI, speed: 0, ground: true, state: 'quieto', plantT: 0, chain: 0, landT: -9, lastJump: '—', camYaw: 0, cam: null, stick: 0, drag: null, slideV: 0, jumpHold: false, jt: 0 };
    },
    update(s, dt, api) {
      const p = api.params;
      const inp = api.input;
      // Input: gamepad, stick virtual (arrastre) o teclado.
      let ix = 0;
      let iy = 0;
      if (inp.pad.connected && Math.hypot(inp.pad.lx, inp.pad.ly) > 0.05) { ix = inp.pad.lx; iy = inp.pad.ly; } else if (inp.mouse.down) {
        if (!s.drag) s.drag = { x: inp.mouse.x, y: inp.mouse.y };
        ix = (inp.mouse.x - s.drag.x) / 70;
        iy = (inp.mouse.y - s.drag.y) / 70;
      } else {
        ix = inp.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']);
        iy = inp.axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']);
      }
      if (!inp.mouse.down) s.drag = null;
      const mag = Math.min(1, Math.hypot(ix, iy));
      s.stick = mag;
      s.camYaw += inp.axis(['KeyQ'], ['KeyE']) * 2 * dt + (inp.pad.connected ? inp.pad.rx * 2.5 * dt : 0);

      // Dirección deseada, relativa a la cámara.
      const cy = Math.cos(s.camYaw);
      const sy = Math.sin(s.camYaw);
      const wx = ix * cy - iy * sy;
      const wz = ix * sy + iy * cy;
      const want = mag > 0.05 ? Math.atan2(wx, wz) : null;
      const target = stickToSpeed(mag, p.curve) * p.speed;
      const crouch = inp.isDown('ShiftLeft', 'ShiftRight', 'KeyC') || !!inp.pad.buttons[6];
      const jumpPressed = inp.wasPressed('Space') || inp.padPressed.has(0);
      const jumpHeld = inp.isDown('Space') || !!inp.pad.buttons[0];

      if (s.ground) {
        if (s.state === 'plantado') {
          s.plantT -= dt;
          s.speed = Math.max(0, s.speed - 30 * dt);
          if (jumpPressed) { jump(s, 'mortal lateral', 11, true); }
          else if (s.plantT <= 0) { s.state = 'corriendo'; if (want != null) s.heading = want; }
        } else if (crouch && s.speed > 4) {
          s.state = 'deslizando';
          s.speed = Math.max(0, s.speed - 6 * dt);
        } else {
          if (want != null) {
            let d = want - s.heading;
            d = Math.atan2(Math.sin(d), Math.cos(d));
            if (s.speed < 0.3) s.heading = want; // parado: gira en seco, sin frames intermedios
            else if (p.plant && Math.abs(d) > Math.PI / 2 && s.speed > 3) { s.state = 'plantado'; s.plantT = 0.18; audio.noise({ dur: 0.1, gain: 0.15, freq: 900 }); }
            else s.heading += d * (1 - Math.exp(-p.blend * dt));
          }
          if (s.state !== 'plantado') {
            s.speed += (target - s.speed) * (1 - Math.exp(-dt / (target > s.speed ? 0.18 : 0.1)));
            s.state = s.speed > 0.3 ? 'corriendo' : 'quieto';
          }
          if (jumpPressed) {
            const recent = api.time - s.landT < p.window && s.speed > p.speed * 0.5 && p.chain;
            s.chain = recent ? Math.min(3, s.chain + 1) : 1;
            if (s.chain === 3) jump(s, 'triple', 13.5, true);
            else if (s.chain === 2) jump(s, 'doble', 10.5, false);
            else jump(s, 'simple', 8.5, false);
          }
        }
      } else {
        // En el aire: el rumbo queda fijo y el stick empuja de costado, reducido.
        if (want != null) {
          s.x += wx * 2.2 * dt * Math.min(1, mag);
          s.z += wz * 2.2 * dt * Math.min(1, mag);
        }
        // Salto variable: soltar recorta la subida (salvo en los saltos fijos).
        if (s.jumpHold && !jumpHeld) { s.jumpHold = false; if (!s.fixed && s.vy > 3) s.vy = 3; }
        s.vy -= (s.vy < 0 ? 2 : 1) * 28 * dt; // la gravedad se duplica desde el ápice
        s.vy = Math.max(-30, s.vy);
      }
      // Avance en el rumbo.
      s.x += Math.sin(s.heading) * s.speed * dt;
      s.z += Math.cos(s.heading) * s.speed * dt;
      // Colisión lateral contra cajas (círculo contra rectángulo en XZ).
      for (const b of BOXES) {
        if (s.y >= b.h - 0.05) continue;
        const cx = Math.max(b.x - b.w / 2, Math.min(b.x + b.w / 2, s.x));
        const cz = Math.max(b.z - b.d / 2, Math.min(b.z + b.d / 2, s.z));
        const dx = s.x - cx;
        const dz = s.z - cz;
        const d = Math.hypot(dx, dz);
        if (d < R && d > 1e-6) { s.x = cx + (dx / d) * R; s.z = cz + (dz / d) * R; s.speed *= 0.9; }
      }
      s.y += s.vy * dt;
      const floor = floorAt(s.x, s.z, s.y);
      if (s.y <= floor) {
        if (!s.ground) { s.landT = api.time; audio.thud(0.3, Math.min(1, -s.vy / 15)); }
        s.y = floor;
        s.vy = 0;
        s.ground = true;
      } else if (s.y > floor + 0.05 && s.ground) {
        s.ground = false; // caminó fuera del borde
        s.vy = 0;
      }
      if (s.ground && api.time - s.landT > p.window) s.chain = s.state === 'corriendo' ? s.chain : 0;
      if (s.ground && api.time - s.landT > p.window + 0.3) s.chain = 0;

      function jump(st, name, v, fixed) {
        st.vy = v;
        st.ground = false;
        st.fixed = fixed;
        st.jumpHold = true;
        st.lastJump = name;
        st.state = 'saltando';
        if (name === 'mortal lateral') { st.heading += Math.PI; st.speed = 2; }
        audio.tone({ freq: { simple: 400, doble: 520, triple: 660, 'mortal lateral': 600 }[name], dur: 0.12, type: 'triangle', gain: 0.15, slide: 1.8 });
      }
    },
    render(g, s, api) {
      const p = api.params;
      capsule.position.set(s.x, s.y + HEIGHT / 2, s.z);
      capsule.rotation.set(s.state === 'deslizando' ? -1.2 : 0, s.heading, 0, 'YXZ');
      if (s.state === 'deslizando') capsule.position.y = s.y + R;
      nose.position.set(s.x + Math.sin(s.heading) * R, s.y + HEIGHT * 0.75, s.z + Math.cos(s.heading) * R);
      nose.rotation.y = s.heading;
      shadow.position.set(s.x, floorAt(s.x, s.z, s.y + 0.01) + 0.02, s.z);
      // Cámara que sigue desde atrás (según su propio yaw), con retraso configurable.
      const want = new THREE.Vector3(s.x - Math.sin(s.camYaw) * -9, s.y + 5, s.z - Math.cos(s.camYaw) * -9);
      if (!s.cam) s.cam = want.clone();
      const k = p.camLag > 0 ? 1 - Math.exp(-(1 / 60) / p.camLag) : 1;
      s.cam.lerp(want, k);
      camera.position.copy(s.cam);
      camera.lookAt(s.x, s.y + 1, s.z);
      view.draw(g, api, scene, camera);

      // Gráfico de la curva stick → velocidad con el punto actual.
      const c = api.colors;
      g.fillStyle = c.surface;
      g.globalAlpha = 0.85;
      g.fillRect(8, 8, 200, 170);
      g.globalAlpha = 1;
      drawCurvePlot(g, { x: 40, y: 34, w: 150, h: 110 }, {
        fn: (d) => stickToSpeed(d, p.curve),
        point: { x: s.stick, y: s.speed / p.speed },
        xLabel: 'stick', yLabel: 'vel.', title: 'Stick → velocidad',
      });
      api.metric('state', s.state);
      api.metric('stick', `${Math.round(s.stick * 100)} %`);
      api.metric('speed', `${s.speed.toFixed(1)} m/s`);
      api.metric('jump', s.lastJump);
    },
  });
}
