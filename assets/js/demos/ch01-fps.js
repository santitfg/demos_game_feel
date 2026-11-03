// CH01-1 · Contexto: el mismo control en primera persona, en el vacío y en un espacio simulado.
// Sin referencias no hay movimiento perceptible; con suelo y objetos aparece la sensación de moverse.

import { createDemo, text } from '../core/demo.js';
import { audio } from '../core/audio.js';
import { createThreeView, THREE } from './shared/three-view.js';
import { mulberry } from './shared/rand.js';

const SPEED = 6; // m/s
const ACCEL = 40;
const LOOK = 0.0022; // rad por px de mouse
const PILLARS = 40;
const R_PLAYER = 0.4;
const SKY = new THREE.Color(0xbcc7d3);
const VOID = new THREE.Color(0xf4f4f2);
const FOG = new THREE.Fog(0xbcc7d3, 12, 60);

export function mountFps(mount, { id = 'CH01-1' } = {}) {
  const view = createThreeView();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, 900 / 460, 0.05, 200);
  const world = new THREE.Group();
  scene.add(world);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8a96, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(20, 30, 10);
  scene.add(sun);

  // Suelo con cuadrícula y columnas/cajas al azar (con semilla fija para que todos vean lo mismo).
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshLambertMaterial({ color: 0xd8d4cc }));
  ground.rotation.x = -Math.PI / 2;
  world.add(ground);
  const grid = new THREE.GridHelper(200, 100, 0x8a857c, 0xb3aea4);
  grid.position.y = 0.01;
  world.add(grid);
  const rand = mulberry(7);
  const pillars = [];
  const pillarMat = new THREE.MeshLambertMaterial({ color: 0xe0612f });
  const boxMat = new THREE.MeshLambertMaterial({ color: 0x3aa6b9 });
  for (let i = 0; i < PILLARS; i++) {
    const x = (rand() - 0.5) * 60;
    const z = (rand() - 0.5) * 60;
    if (Math.hypot(x, z) < 4) continue;
    const box = rand() < 0.4;
    const r = box ? 0.6 + rand() * 0.6 : 0.3 + rand() * 0.3;
    const h = box ? r * 1.6 : 2 + rand() * 4;
    const mesh = new THREE.Mesh(box ? new THREE.BoxGeometry(r * 2, h, r * 2) : new THREE.CylinderGeometry(r, r, h, 16), box ? boxMat : pillarMat);
    mesh.position.set(x, h / 2, z);
    world.add(mesh);
    pillars.push({ x, z, r: box ? r * 1.2 : r });
  }

  return createDemo({
    mount,
    id,
    title: 'Primera persona: con y sin espacio',
    width: 900,
    height: 460,
    pointerLock: true,
    hint: 'Clic para capturar el mouse · W A S D para moverte · Esc suelta el mouse',
    params: [
      { key: 'sens', label: 'Sensibilidad del mouse', min: 0.3, max: 3, step: 0.05, value: 1, unit: '×' },
      { key: 'speed', label: 'Velocidad', min: 1, max: 15, step: 0.5, value: SPEED, unit: 'm/s' },
      { key: 'bob', type: 'check', label: 'Balanceo de cámara y pasos (pulido)', value: false },
    ],
    modes: [
      { key: '1', label: 'Vacío', values: { bob: false } },
      { key: '2', label: 'Espacio simulado', values: { bob: false } },
      { key: '3', label: 'Espacio + colisiones + pasos', values: { bob: true } },
    ],
    metrics: [
      { key: 'speed', label: 'Velocidad real' },
      { key: 'pos', label: 'Posición (x, z)' },
      { key: 'feel', label: '¿Se percibe el movimiento?' },
    ],
    foot: `<p><strong>Prueba esto:</strong> en <kbd>1</kbd> camina y gira. El juego te está moviendo a 6 m/s, pero no hay nada
      contra qué medirlo: el control existe, pero no se siente. Pulsa <kbd>2</kbd> y lo mismo se vuelve movimiento. <kbd>3</kbd> agrega
      colisiones con las columnas (el espacio te responde) y un balanceo con pasos, que ya es pulido. Sin mouse: las flechas ← → giran.</p>`,

    setup() {
      return { x: 0, z: 0, vx: 0, vz: 0, yaw: 0, pitch: 0, bobT: 0, lastStep: 0, bumped: 0, speed: 0 };
    },

    update(s, dt, api) {
      const inp = api.input;
      const p = api.params;
      // Mirar: con el mouse capturado, o arrastrando si no hay captura (táctil, iframes).
      const look = inp.locked || inp.mouse.down ? 1 : 0;
      s.yaw -= inp.mouse.dx * LOOK * p.sens * look + inp.axis(['ArrowLeft'], ['ArrowRight']) * 2.2 * dt;
      s.pitch = Math.max(-1.3, Math.min(1.3, s.pitch - inp.mouse.dy * LOOK * p.sens * look));
      // Ejes locales: adelante = -z rotado por yaw.
      const f = inp.axis(['KeyS', 'ArrowDown'], ['KeyW', 'ArrowUp']);
      const r = inp.axis(['KeyA'], ['KeyD']);
      const len = Math.hypot(f, r) || 1;
      const fx = -Math.sin(s.yaw);
      const fz = -Math.cos(s.yaw);
      const tx = ((fx * f + Math.cos(s.yaw) * r) / len) * p.speed;
      const tz = ((fz * f - Math.sin(s.yaw) * r) / len) * p.speed;
      const k = 1 - Math.exp(-ACCEL * dt / Math.max(1, p.speed));
      s.vx += (tx - s.vx) * k;
      s.vz += (tz - s.vz) * k;
      s.x += s.vx * dt;
      s.z += s.vz * dt;

      if (api.mode === '3') {
        for (const pl of pillars) {
          const dx = s.x - pl.x;
          const dz = s.z - pl.z;
          const d = Math.hypot(dx, dz);
          const min = pl.r + R_PLAYER;
          if (d < min && d > 1e-6) {
            s.x = pl.x + (dx / d) * min;
            s.z = pl.z + (dz / d) * min;
            const vn = (s.vx * dx + s.vz * dz) / d;
            if (vn < 0) {
              s.vx -= (vn * dx) / d;
              s.vz -= (vn * dz) / d;
              if (-vn > 2 && api.time - s.bumped > 0.3) { audio.thud(0.6, Math.min(1, -vn / 8)); s.bumped = api.time; }
            }
          }
        }
      }
      const sp = Math.hypot(s.vx, s.vz);
      if (p.bob && sp > 0.5) {
        s.bobT += dt * sp * 1.6;
        const step = Math.floor(s.bobT / Math.PI);
        if (step !== s.lastStep) { s.lastStep = step; audio.noise({ dur: 0.06, gain: 0.12, freq: 600 }); }
      }
      s.speed = sp;
    },

    render(g, s, api) {
      const p = api.params;
      const space = api.mode !== '1';
      world.visible = space;
      scene.background = space ? SKY : VOID;
      scene.fog = space ? FOG : null;
      const bob = p.bob ? Math.sin(s.bobT * 2) * 0.05 * Math.min(1, s.speed / 3) : 0;
      camera.position.set(s.x, 1.7 + bob, s.z);
      camera.rotation.set(s.pitch, s.yaw, p.bob ? Math.sin(s.bobT) * 0.008 : 0, 'YXZ');
      view.draw(g, api, scene, camera);

      // Mira.
      const c = api.colors;
      g.strokeStyle = space ? '#1b1b1f' : '#9a9a9a';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(api.w / 2 - 8, api.h / 2); g.lineTo(api.w / 2 + 8, api.h / 2);
      g.moveTo(api.w / 2, api.h / 2 - 8); g.lineTo(api.w / 2, api.h / 2 + 8);
      g.stroke();
      if (!api.input.locked) text(g, 'Clic para capturar el mouse', api.w / 2, 30, { align: 'center', size: 13, weight: 600, color: c.accent });

      api.metric('speed', `${s.speed.toFixed(1)} m/s`);
      api.metric('pos', `${s.x.toFixed(1)}, ${s.z.toFixed(1)}`);
      api.metric('feel', space ? 'sí: hay referencias' : s.speed > 0.5 ? 'te mueves… ¿o no?' : 'quieto');
    },
  });
}
