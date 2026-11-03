// EX16-1 · Vehículo todoterreno: una caja rígida sostenida por cuatro raycasts de suspensión.
// Ejes de input filtrados al estilo Unity (Gravity, Dead, Sensitivity, Snap), velocidad del motor
// separada de la real, fricción lateral mayor que la frontal y umbral de deslizamiento.
// Sandbox de la mecánica analizada en el cap. 16: formas abstractas y terreno propio.

import { createDemo, text, roundRect } from '../core/demo.js';
import { audio } from '../core/audio.js';
import { createThreeView, THREE } from './shared/three-view.js';
import { mulberry } from './shared/rand.js';

const HX = 0.9; // medio ancho, medio alto y medio largo de la caja
const HY = 0.4;
const HZ = 1.6;
const INERTIA = new THREE.Vector3((HY * HY + HZ * HZ) / 3, (HX * HX + HZ * HZ) / 3, (HX * HX + HY * HY) / 3);
const WHEEL_R = 0.38;
const RAY = 1.0; // largo máximo del raycast desde el pozo de la rueda
const MOUNTS = [[-0.85, -0.2, 1.15], [0.85, -0.2, 1.15], [-0.85, -0.2, -1.15], [0.85, -0.2, -1.15]]; // del-izq, del-der, tras-izq, tras-der
const MAX_SPEED = 22; // m/s
const MAX_STEER = 0.6; // rad

// Terreno: lomas suaves, una fila de baches, una rampa y bordes que suben.
export function height(x, z) {
  let h = 1.6 * Math.sin(x * 0.07) * Math.cos(z * 0.06) + 0.7 * Math.sin(x * 0.21 + z * 0.13) + 0.3 * Math.sin(z * 0.37 - x * 0.11);
  const start = Math.max(0, 1 - Math.hypot(x, z + 18) / 26); // zona de salida más plana
  h *= 1 - start * 0.85;
  if (Math.abs(x) < 7 && z < -12 && z > -21) h += (Math.floor((-z - 12) / 1.5) % 2) * 0.22; // baches: escalones de 22 cm
  if (Math.abs(x) < 5 && z < -30 && z > -40) h += ((-30 - z) / 10) * 2.6; // rampa
  const edge = Math.max(0, Math.abs(x) - 105) + Math.max(0, Math.abs(z) - 105);
  return h + edge * edge * 0.08;
}
function normalAt(x, z, out) {
  const e = 0.3;
  return out.set(height(x - e, z) - height(x + e, z), 2 * e, height(x, z - e) - height(x, z + e)).normalize();
}
// Raycast contra el terreno: devuelve la distancia al impacto o null.
function raycast(o, d, len) {
  const f = (t) => o.y + d.y * t - height(o.x + d.x * t, o.z + d.z * t);
  if (f(0) <= 0) return 0;
  let prev = 0;
  for (let i = 1; i <= 8; i++) {
    const t = (len * i) / 8;
    if (f(t) <= 0) {
      let a = prev;
      let b = t;
      for (let k = 0; k < 7; k++) { const m = (a + b) / 2; if (f(m) <= 0) b = m; else a = m; }
      return b;
    }
    prev = t;
  }
  return null;
}

// Eje virtual estilo Unity: tiende a `target` a `sens` u/s, cae a 0 a `grav` u/s, se anula bajo `dead`.
export function stepAxis(v, target, { grav, sens, dead, snap }, dt) {
  if (target !== 0) {
    if (snap && v !== 0 && Math.sign(v) !== Math.sign(target)) v = 0;
    v += Math.sign(target - v) * Math.min(Math.abs(target - v), sens * dt);
  } else {
    v -= Math.sign(v) * Math.min(Math.abs(v), grav * dt);
  }
  return Math.abs(v) < dead ? 0 : v;
}

export function mountJeep(mount, { id = 'EX16-1' } = {}) {
  const view = createThreeView();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa9cbe8);
  scene.fog = new THREE.Fog(0xa9cbe8, 40, 140);
  const camera = new THREE.PerspectiveCamera(60, 900 / 460, 0.1, 400);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6b5a3a, 1.4));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(-20, 30, 10);
  scene.add(sun);

  // Malla del terreno con color por altura y pendiente.
  const SIZE = 240;
  const SEG = 160;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  const low = new THREE.Color(0x8aa05a);
  const high = new THREE.Color(0xc2a46e);
  const tmpC = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = height(x, z);
    pos.setY(i, y);
    tmpC.copy(low).lerp(high, Math.max(0, Math.min(1, (y + 1.5) / 5)));
    if (Math.abs(x) < 5 && z < -30 && z > -40) tmpC.set(0xd08a4a);
    if (Math.abs(x) < 7 && z < -12 && z > -21) tmpC.set(0xb59a68);
    cols.set([tmpC.r, tmpC.g, tmpC.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  scene.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true })));

  // Árboles: obstáculos con choque "pegajoso", como en el libro.
  const rand = mulberry(16);
  const trees = [];
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f7a3a });
  for (let i = 0; i < 70; i++) {
    const x = (rand() - 0.5) * 190;
    const z = (rand() - 0.5) * 190;
    if (Math.abs(x) < 10 && z < 8 && z > -48) continue;
    const s = 0.8 + rand() * 0.8;
    const y = height(x, z);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25 * s, 0.35 * s, 2 * s, 7), trunkMat);
    trunk.position.set(x, y + s, z);
    const leaves = new THREE.Mesh(new THREE.ConeGeometry(1.6 * s, 3.6 * s, 8), leafMat);
    leaves.position.set(x, y + 2 * s + 1.6 * s, z);
    scene.add(trunk, leaves);
    trees.push({ x, z, r: 0.35 * s, top: y + 5 * s });
  }

  // Jeep: caja, cabina, ruedas y rayos de suspensión.
  const jeep = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(HX * 2, HY * 2, HZ * 2), new THREE.MeshLambertMaterial({ color: 0xd9a21f }));
  const cab = new THREE.Mesh(new THREE.BoxGeometry(HX * 1.7, 0.5, 1.1), new THREE.MeshLambertMaterial({ color: 0x2d3a3f }));
  cab.position.set(0, HY + 0.25, -0.2);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.5), new THREE.MeshLambertMaterial({ color: 0x2d3a3f }));
  hood.position.set(0, HY + 0.03, 1.1);
  jeep.add(body, cab, hood);
  scene.add(jeep);
  const wheelGeo = new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.32, 14);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const hubMat = new THREE.MeshLambertMaterial({ color: 0xbbbbbb });
  const wheels = MOUNTS.map(() => {
    const w = new THREE.Group();
    const tire = new THREE.Mesh(wheelGeo, wheelMat);
    const hub = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.5), hubMat);
    const spin = new THREE.Group();
    spin.add(tire, hub);
    w.add(spin);
    w.userData.spin = spin;
    scene.add(w);
    return w;
  });
  const rayMat = new THREE.LineBasicMaterial({ color: 0xff3366, depthTest: false });
  const rays = MOUNTS.map(() => {
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const l = new THREE.Line(g, rayMat);
    l.renderOrder = 10;
    scene.add(l);
    return l;
  });
  // Marcas de neumático al deslizar: un anillo de puntos reutilizados.
  const MARKS = 400;
  const markGeo = new THREE.PlaneGeometry(0.3, 0.3);
  markGeo.rotateX(-Math.PI / 2);
  const marks = new THREE.InstancedMesh(markGeo, new THREE.MeshBasicMaterial({ color: 0x3b2d20, transparent: true, opacity: 0.55 }), MARKS);
  marks.count = 0;
  scene.add(marks);
  const markM = new THREE.Matrix4();

  const engine = audio.drone({ type: 'sawtooth', filter: 700 });
  const V = () => new THREE.Vector3();
  const tmp = { a: V(), b: V(), c: V(), d: V(), e: V(), n: V(), f: V(), s: V(), r: V(), qi: new THREE.Quaternion(), wq: new THREE.Quaternion() };

  function applyForce(s, F, at) {
    s.F.add(F);
    tmp.r.subVectors(at, s.p);
    s.T.add(tmp.e.crossVectors(tmp.r, F));
  }
  function pointVel(s, at, out) {
    tmp.r.subVectors(at, s.p);
    return out.crossVectors(s.w, tmp.r).add(s.v);
  }

  const axisOpts = (p, which) => ({ grav: p[which + 'G'], sens: p[which + 'S'], dead: p.dead, snap: p.snap });

  return createDemo({
    mount,
    id,
    title: 'Jeep: suspensión por raycasts y ejes filtrados',
    width: 900,
    height: 460,
    hint: 'Clic aquí · W A S D para manejar · Espacio freno de mano',
    modes: [
      { key: '1', label: 'Ejes del libro', values: { raw: false, steerG: 3, steerS: 2, throttleG: 3, throttleS: 3, damp: 4 } },
      { key: '2', label: 'Input crudo', values: { raw: true, damp: 4 } },
      { key: '3', label: 'Muy suave', values: { raw: false, steerG: 0.8, steerS: 0.7, throttleG: 0.8, throttleS: 0.8, damp: 4 } },
      { key: '4', label: 'Sin amortiguación', values: { raw: false, steerG: 3, steerS: 2, throttleG: 3, throttleS: 3, damp: 0 } },
    ],
    params: [
      { heading: 'Ejes de input (teclado)' },
      { key: 'raw', type: 'check', label: 'Input crudo (sin filtro)', value: false },
      { key: 'steerG', label: 'Giro · Gravity', min: 0.2, max: 20, step: 0.1, value: 3, unit: 'u/s', help: 'Velocidad con la que el eje vuelve a 0 al soltar.' },
      { key: 'steerS', label: 'Giro · Sensitivity', min: 0.2, max: 20, step: 0.1, value: 2, unit: 'u/s', help: 'Velocidad con la que el eje va hacia ±1 al pulsar.' },
      { key: 'throttleG', label: 'Avance · Gravity', min: 0.2, max: 20, step: 0.1, value: 3, unit: 'u/s' },
      { key: 'throttleS', label: 'Avance · Sensitivity', min: 0.2, max: 20, step: 0.1, value: 3, unit: 'u/s' },
      { key: 'dead', label: 'Dead', min: 0, max: 0.3, step: 0.001, value: 0.001, help: 'Debajo de este valor el eje vale 0.' },
      { key: 'snap', type: 'check', label: 'Snap (cambiar de lado salta a 0)', value: false },
      { heading: 'Suspensión' },
      { key: 'spring', label: 'Fuerza del resorte', min: 10, max: 80, step: 1, value: 32 },
      { key: 'damp', label: 'Amortiguación', min: 0, max: 10, step: 0.1, value: 4, help: 'En 0 el jeep rebota cada vez más: es la fig. 16.10 del libro.' },
      { key: 'extraG', label: 'Gravedad extra del jeep', min: 0, max: 20, step: 0.5, value: 6, unit: 'm/s²', help: 'Gravedad que solo afecta al jeep, para que no parezca un aerodeslizador.' },
      { key: 'interp', type: 'check', label: 'Interpolar la posición visible de las ruedas', value: true },
      { key: 'showRays', type: 'check', label: 'Ver los raycasts', value: true },
      { heading: 'Neumáticos' },
      { key: 'sideMu', label: 'Fricción lateral', min: 0.1, max: 3, step: 0.05, value: 1.6, help: 'Mayor que la frontal: es lo que hace que el jeep "talle" la curva en vez de patinar.' },
      { key: 'fwdMu', label: 'Fricción frontal', min: 0.1, max: 3, step: 0.05, value: 0.9 },
      { key: 'slip', label: 'Umbral de deslizamiento', min: 1, max: 30, step: 0.5, value: 7, unit: 'm/s', help: 'Si la velocidad del motor y la real difieren más que esto, la rueda se suelta y patina.' },
      { key: 'slowmo', type: 'check', label: 'Cámara lenta en los saltos', value: true },
    ],
    graph: {
      window: 4,
      series: [
        { label: 'giro: teclas', color: 'muted', min: -1, max: 1, width: 1, step: true },
        { label: 'giro: eje', color: 'accent', min: -1, max: 1 },
        { label: 'avance: eje', color: 'accent2', min: -1, max: 1 },
      ],
    },
    metrics: [
      { key: 'speed', label: 'Velocidad real' },
      { key: 'motor', label: 'Velocidad del motor' },
      { key: 'grip', label: 'Neumáticos' },
      { key: 'wheels', label: 'Ruedas en el suelo' },
      { key: 'impact', label: 'Último choque' },
    ],
    foot: `<p><strong>Prueba esto:</strong> en <kbd>1</kbd> toca apenas <kbd>A</kbd> o <kbd>D</kbd> y mira el gráfico: el eje sube en rampa
      (Sensitivity) y baja en rampa al soltar (Gravity), así que un toque corto apenas gira. Con <kbd>2</kbd> el giro es todo o nada y el jeep
      da volantazos; con <kbd>3</kbd> parece que el volante pesa una tonelada. Pasa por los baches con y sin "Interpolar ruedas", y salta la
      rampa acelerando en el aire: el motor se revoluciona y, al aterrizar, las ruedas patinan hasta agarrar. En <kbd>4</kbd>, sin amortiguación,
      el jeep rebota sin parar.</p>`,

    setup() {
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
      return {
        p: new THREE.Vector3(0, height(0, 0) + 2.4, 0), v: V(), q, w: V(), F: V(), T: V(),
        steer: 0, throttle: 0, rawSteer: 0, rawThrottle: 0, motor: 0,
        comp: [0, 0, 0, 0], vis: [RAY, RAY, RAY, RAY], hit: [null, null, null, null], spin: [0, 0, 0, 0],
        slipping: 0, contacts: 0, impact: '—', impactT: -9, airT: 0, cam: null, markI: 0, markT: 0, tscale: 1,
      };
    },
    update(s, dtReal, api) {
      const p = api.params;
      const inp = api.input;
      // Input: teclas → ejes filtrados. El stick del gamepad entra crudo, como en Unity.
      s.rawSteer = inp.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']);
      s.rawThrottle = inp.axis(['KeyS', 'ArrowDown'], ['KeyW', 'ArrowUp']);
      const pad = inp.pad.connected && (Math.abs(inp.pad.lx) > 0.1 || inp.pad.rt > 0.05 || inp.pad.lt > 0.05);
      if (pad) {
        s.steer = Math.abs(inp.pad.lx) > 0.1 ? inp.pad.lx : 0;
        s.throttle = inp.pad.rt - inp.pad.lt;
      } else if (p.raw) {
        s.steer = s.rawSteer;
        s.throttle = s.rawThrottle;
      } else {
        s.steer = stepAxis(s.steer, s.rawSteer, axisOpts(p, 'steer'), dtReal);
        s.throttle = stepAxis(s.throttle, s.rawThrottle, axisOpts(p, 'throttle'), dtReal);
      }
      const handbrake = inp.isDown('Space') || !!inp.pad.buttons[0];
      api.graph.push(api.time, [s.rawSteer, s.steer, s.throttle]);

      // Cámara lenta mientras el jeep vuela alto (pulido de "stunt").
      const groundBelow = height(s.p.x, s.p.z);
      const wantScale = p.slowmo && s.contacts === 0 && s.p.y - groundBelow > 4 ? 0.35 : 1;
      s.tscale += (wantScale - s.tscale) * Math.min(1, dtReal * 6);
      const dt = dtReal * s.tscale;

      // Velocidad deseada (motor): sube aunque las ruedas no toquen el suelo.
      const target = s.throttle * (s.throttle >= 0 ? MAX_SPEED : MAX_SPEED * 0.45);
      s.motor += (handbrake ? -s.motor : target - s.motor) * (1 - Math.exp(-2.2 * dt));

      s.F.set(0, -(9.8 + p.extraG), 0);
      s.T.set(0, 0, 0);
      const up = tmp.a.set(0, 1, 0).applyQuaternion(s.q);
      const down = tmp.b.copy(up).negate();
      const fwdBody = tmp.c.set(0, 0, 1).applyQuaternion(s.q);
      let contacts = 0;
      let slipSum = 0;
      for (let i = 0; i < 4; i++) {
        const m = MOUNTS[i];
        const mw = new THREE.Vector3(m[0], m[1], m[2]).applyQuaternion(s.q).add(s.p);
        const t = raycast(mw, down, RAY);
        s.hit[i] = t;
        if (t == null) { s.comp[i] = 0; continue; }
        contacts++;
        // Resorte + amortiguador: más compresión, más fuerza; la amortiguación frena la velocidad de compresión.
        const x = RAY - t;
        const rate = (x - s.comp[i]) / dt;
        s.comp[i] = x;
        const Fn = Math.max(0, p.spring * x + p.damp * rate);
        const cp = mw.clone().addScaledVector(down, t);
        applyForce(s, up.clone().multiplyScalar(Fn), mw);

        // Fricción: la rueda tiene su propia dirección (las delanteras giran) y su propia velocidad.
        const n = normalAt(cp.x, cp.z, tmp.n);
        const steerA = i < 2 ? -s.steer * MAX_STEER * (1 - Math.min(0.5, s.v.length() / 60)) : 0;
        const fw = tmp.f.copy(fwdBody).applyAxisAngle(up, steerA);
        fw.addScaledVector(n, -fw.dot(n)).normalize();
        const side = tmp.s.crossVectors(n, fw).normalize();
        const vp = pointVel(s, cp, tmp.d);
        const vf = vp.dot(fw);
        const vs = vp.dot(side);
        // Umbral de deslizamiento: si el motor gira mucho más rápido que el suelo (o la rueda va de costado), se suelta.
        const over = Math.max(Math.abs(s.motor - vf), Math.abs(vs)) - p.slip;
        const grip = over > 0 ? Math.max(0.35, 1 - over / (p.slip + 4)) : 1;
        slipSum += 1 - grip;
        let sideMu = p.sideMu * grip;
        if (handbrake && i >= 2) sideMu *= 0.25;
        const Fs = Math.max(-sideMu * Fn, Math.min(sideMu * Fn, -vs * 10));
        const Ff = Math.max(-p.fwdMu * grip * Fn, Math.min(p.fwdMu * grip * Fn, (s.motor - vf) * 6));
        // Como en el libro, el centro de gravedad se "baja" a mano: la fricción se aplica a la altura del pozo
        // de la rueda y no en el contacto, para que el jeep no vuelque en cada curva cerrada.
        applyForce(s, side.clone().multiplyScalar(Fs).addScaledVector(fw, Ff), mw);
        s.spin[i] += ((grip < 0.9 ? s.motor : vf) / WHEEL_R) * dt;
        // Marcas en el suelo cuando la rueda patina.
        if (grip < 0.8 && api.time - s.markT > 0.03) {
          markM.makeTranslation(cp.x, height(cp.x, cp.z) + 0.03, cp.z);
          marks.setMatrixAt(s.markI % MARKS, markM);
          s.markI++;
          marks.count = Math.min(MARKS, s.markI);
          marks.instanceMatrix.needsUpdate = true;
          if (i === 3) s.markT = api.time;
        }
      }
      for (let i = 0; i < 4; i++) if (s.hit[i] == null) s.spin[i] += (s.motor / WHEEL_R) * dt; // en el aire giran con el motor
      if (s.contacts === 0 && contacts > 0 && s.airT > 0.35) audio.thud(0.8, Math.min(1, s.airT / 1.5));
      s.airT = contacts ? 0 : s.airT + dt;
      s.contacts = contacts;
      s.slipping = contacts ? slipSum / contacts : 0;

      // Esquinas de la caja contra el terreno (vuelcos y caídas de techo).
      for (const cx of [-HX, HX]) for (const cy of [-HY, HY + 0.5]) for (const cz of [-HZ, HZ]) {
        const c = new THREE.Vector3(cx, cy, cz).applyQuaternion(s.q).add(s.p);
        const d = height(c.x, c.z) - c.y;
        if (d <= 0) continue;
        const n = normalAt(c.x, c.z, tmp.n).clone();
        const vc = pointVel(s, c, tmp.d).clone();
        const vn = vc.dot(n);
        const F = n.clone().multiplyScalar(260 * d - (vn < 0 ? 18 * vn : 0));
        F.addScaledVector(vc.addScaledVector(n, -vn), -2.5);
        applyForce(s, F, c);
      }

      // Integración (Euler semi-implícito) con inercia de caja en ejes locales.
      s.v.addScaledVector(s.F, dt);
      s.v.multiplyScalar(Math.exp(-0.05 * dt));
      tmp.qi.copy(s.q).invert();
      const tl = s.T.clone().applyQuaternion(tmp.qi);
      tl.set(tl.x / INERTIA.x, tl.y / INERTIA.y, tl.z / INERTIA.z).applyQuaternion(s.q);
      s.w.addScaledVector(tl, dt);
      s.w.multiplyScalar(Math.exp(-0.6 * dt));
      s.p.addScaledVector(s.v, dt);
      const wq = tmp.wq.set(s.w.x, s.w.y, s.w.z, 0).multiply(s.q);
      s.q.set(s.q.x + 0.5 * wq.x * dt, s.q.y + 0.5 * wq.y * dt, s.q.z + 0.5 * wq.z * dt, s.q.w + 0.5 * wq.w * dt).normalize();

      // Árboles: choque pegajoso que se come el momento; el sonido escala con la velocidad del impacto.
      for (const tr of trees) {
        if (s.p.y > tr.top) continue;
        const dx = s.p.x - tr.x;
        const dz = s.p.z - tr.z;
        const d = Math.hypot(dx, dz);
        const R = tr.r + 1.25;
        if (d >= R || d < 1e-6) continue;
        const nx = dx / d;
        const nz = dz / d;
        s.p.x = tr.x + nx * R;
        s.p.z = tr.z + nz * R;
        const vn = s.v.x * nx + s.v.z * nz;
        if (vn < 0) {
          s.v.x -= nx * vn * 1.15;
          s.v.z -= nz * vn * 1.15;
          s.v.multiplyScalar(0.6);
          s.w.y += (Math.random() - 0.5) * 0.8;
          const hit = -vn;
          if (api.time - s.impactT > 0.25 && hit > 1) {
            s.impactT = api.time;
            if (hit < 5) { s.impact = 'toque'; audio.thud(0.4, 0.5); }
            else if (hit < 12) { s.impact = 'choque'; audio.thud(0.7, 0.9); audio.noise({ dur: 0.25, gain: 0.3, freq: 2500, type: 'bandpass' }); }
            else { s.impact = 'destrozo'; audio.thud(1, 1); audio.noise({ dur: 0.7, gain: 0.4, freq: 3500, type: 'bandpass', q: 0.6 }); }
          }
        }
      }
    },
    render(g, s, api) {
      const p = api.params;
      jeep.position.copy(s.p);
      jeep.quaternion.copy(s.q);
      const down = new THREE.Vector3(0, -1, 0).applyQuaternion(s.q);
      const k = p.interp ? 1 - Math.exp(-(1 / 60) * 22) : 1;
      for (let i = 0; i < 4; i++) {
        const m = MOUNTS[i];
        const mw = new THREE.Vector3(m[0], m[1], m[2]).applyQuaternion(s.q).add(s.p);
        const target = s.hit[i] == null ? RAY : s.hit[i];
        s.vis[i] += (target - s.vis[i]) * k;
        const w = wheels[i];
        w.position.copy(mw).addScaledVector(down, s.vis[i] - WHEEL_R);
        w.quaternion.copy(s.q);
        if (i < 2) w.rotateY(-s.steer * MAX_STEER);
        w.userData.spin.rotation.x = s.spin[i];
        const r = rays[i];
        r.visible = p.showRays;
        if (p.showRays) {
          const end = mw.clone().addScaledVector(down, s.hit[i] == null ? RAY : s.hit[i]);
          r.geometry.attributes.position.setXYZ(0, mw.x, mw.y, mw.z);
          r.geometry.attributes.position.setXYZ(1, end.x, end.y, end.z);
          r.geometry.attributes.position.needsUpdate = true;
          r.material.color.set(s.hit[i] == null ? 0x888888 : 0xff3366);
        }
      }
      // Cámara de persecución con retraso, mirando adonde va el jeep.
      const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(s.q);
      fwd.y = 0;
      if (fwd.lengthSq() < 0.01) fwd.set(0, 0, -1);
      fwd.normalize();
      const want = s.p.clone().addScaledVector(fwd, -9);
      want.y = Math.max(s.p.y + 3.5, height(want.x, want.z) + 2);
      if (!s.cam) s.cam = want.clone();
      s.cam.lerp(want, 0.08);
      camera.position.copy(s.cam);
      camera.lookAt(s.p.x, s.p.y + 1, s.p.z);
      view.draw(g, api, scene, camera);

      // Panel: ejes (teclas frente a eje filtrado) y motor frente a velocidad real.
      const c = api.colors;
      const speed = Math.hypot(s.v.x, s.v.z);
      g.globalAlpha = 0.88;
      g.fillStyle = c.surface;
      roundRect(g, 8, 8, 236, 112, 6);
      g.fill();
      g.globalAlpha = 1;
      const bar = (y, label, raw, val) => {
        text(g, label, 18, y + 4, { size: 11, color: c.text, weight: 600 });
        const x0 = 90;
        const w = 140;
        g.fillStyle = c.line;
        g.fillRect(x0, y - 4, w, 8);
        g.fillStyle = c.muted;
        g.fillRect(x0 + w / 2 + (raw * w) / 2 - 1, y - 8, 2, 16);
        g.fillStyle = c.accent;
        const v = (val * w) / 2;
        g.fillRect(x0 + w / 2 + Math.min(0, v), y - 4, Math.abs(v), 8);
      };
      bar(28, 'giro', s.rawSteer, s.steer);
      bar(50, 'avance', s.rawThrottle, s.throttle);
      text(g, 'motor', 18, 80, { size: 11, color: c.text, weight: 600 });
      text(g, 'real', 18, 100, { size: 11, color: c.text, weight: 600 });
      g.fillStyle = c.line;
      g.fillRect(90, 72, 140, 8);
      g.fillRect(90, 92, 140, 8);
      g.fillStyle = c.accent2;
      g.fillRect(90, 72, Math.min(140, (Math.abs(s.motor) / MAX_SPEED) * 140), 8);
      g.fillStyle = s.slipping > 0.1 ? c.bad : c.good;
      g.fillRect(90, 92, Math.min(140, (speed / MAX_SPEED) * 140), 8);
      if (s.tscale < 0.9) text(g, 'cámara lenta', api.w - 14, 24, { size: 12, align: 'right', color: c.text, weight: 700 });

      // Motor: tono que sube con la velocidad deseada; solo suena con la demo enfocada.
      const focused = document.activeElement === api.stage;
      engine.set({ freq: 55 + Math.abs(s.motor) * 5 + s.slipping * 40, gain: focused ? 0.05 + Math.abs(s.throttle) * 0.05 : 0 });

      api.metric('speed', `${Math.round(speed * 3.6)} km/h`);
      api.metric('motor', `${Math.round(Math.abs(s.motor) * 3.6)} km/h`);
      api.metric('grip', s.contacts === 0 ? 'en el aire' : s.slipping > 0.1 ? `patinan (${Math.round(s.slipping * 100)} %)` : 'agarran');
      api.metricColor('grip', s.slipping > 0.1 && s.contacts ? 'bad' : '');
      api.metric('wheels', `${s.contacts} / 4`);
      api.metric('impact', s.impact);
    },
  });
}
