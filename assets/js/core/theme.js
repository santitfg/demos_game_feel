// Colores del tema leídos de las variables CSS, para dibujar en canvas.
// Se refrescan al cambiar el tema (botón o preferencia del sistema).

const KEYS = ['bg', 'surface', 'surface-2', 'stage', 'text', 'muted', 'line', 'accent', 'accent-2', 'accent-3', 'good', 'warn', 'bad', 'grid'];
let cache = null;

function read() {
  const cs = getComputedStyle(document.documentElement);
  const c = {};
  for (const k of KEYS) c[k.replace(/-(\d)/, '$1')] = cs.getPropertyValue(`--${k}`).trim();
  return c;
}

export function colors() {
  if (!cache) cache = read();
  return cache;
}

const refresh = () => { cache = null; };
window.addEventListener('gf-theme', refresh);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', refresh);

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
