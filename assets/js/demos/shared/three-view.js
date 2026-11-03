// Puente entre Three.js y createDemo: se renderiza en un canvas WebGL propio y se copia
// al canvas 2D de la demo. Así las demos 3D conservan panel, métricas, HUD y teclas de modo.

import * as THREE from '../../../vendor/three.module.min.js';

export { THREE };

export function createThreeView() {
  const canvas = document.createElement('canvas');
  let renderer = null;
  let failed = false;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(1);
  } catch {
    failed = true;
  }
  return {
    get ok() { return !failed; },
    renderer,
    // Dibuja la escena ocupando w×h lógicos del canvas 2D, a la resolución real del canvas.
    draw(g, api, scene, camera) {
      if (failed) {
        g.fillStyle = api.colors.surface2;
        g.fillRect(0, 0, api.w, api.h);
        g.fillStyle = api.colors.muted;
        g.font = '14px Inter, system-ui, sans-serif';
        g.textAlign = 'center';
        g.fillText('Este navegador no tiene WebGL: la demo 3D no puede dibujarse.', api.w / 2, api.h / 2);
        return;
      }
      const pw = api.canvas.width;
      const ph = api.canvas.height;
      if (canvas.width !== pw || canvas.height !== ph) {
        renderer.setSize(pw, ph, false);
        camera.aspect = pw / ph;
        camera.updateProjectionMatrix();
      }
      renderer.render(scene, camera);
      g.drawImage(canvas, 0, 0, api.w, api.h);
    },
  };
}
