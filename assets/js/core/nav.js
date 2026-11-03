// Header, selector de tema, pager prev/next y footer.
// Cada página declara <body data-root="../" data-page="slug">.
import { SEQUENCE } from '../chapters.js';

const root = document.body.dataset.root ?? '';
const page = document.body.dataset.page ?? '';

const THEMES = ['auto', 'light', 'dark'];
const THEME_LABEL = { auto: 'auto', light: 'claro', dark: 'oscuro' };
const THEME_ICON = { auto: '◐', light: '☀', dark: '☾' };

function readTheme() {
  try { return localStorage.getItem('gf-theme') || 'auto'; } catch { return 'auto'; }
}
function applyTheme(t) {
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem('gf-theme', t); } catch { /* sin storage */ }
  window.dispatchEvent(new CustomEvent('gf-theme'));
}
applyTheme(readTheme());

function header() {
  const h = document.createElement('header');
  h.className = 'site-header';
  const isLab = location.pathname.includes('/laboratorio/');
  const isCap = location.pathname.includes('/capitulos/');
  h.innerHTML = `
    <div class="bar">
      <a class="brand" href="${root}index.html"><span class="dot"></span>Game Feel <span class="hide-sm" style="color:var(--muted);font-weight:500">· laboratorio</span></a>
      <nav class="site-nav" aria-label="Principal">
        <a href="${root}index.html#capitulos" ${isCap ? 'aria-current="page"' : ''}>Capítulos</a>
        <a href="${root}index.html#laboratorio" ${isLab ? 'aria-current="page"' : ''}>Laboratorio</a>
        <button type="button" class="theme-toggle" aria-label="Cambiar tema"></button>
      </nav>
    </div>`;
  const btn = h.querySelector('.theme-toggle');
  const sync = () => {
    const t = readTheme();
    btn.innerHTML = `<span aria-hidden="true">${THEME_ICON[t]}</span><span class="hide-sm"> Tema: ${THEME_LABEL[t]}</span>`;
    btn.title = `Tema: ${THEME_LABEL[t]}`;
  };
  btn.addEventListener('click', () => {
    const next = THEMES[(THEMES.indexOf(readTheme()) + 1) % THEMES.length];
    applyTheme(next);
    sync();
  });
  sync();
  return h;
}

function pager() {
  const i = SEQUENCE.findIndex((s) => s.id === page);
  if (i < 0) return null;
  const nav = document.createElement('nav');
  nav.className = 'pager';
  nav.setAttribute('aria-label', 'Anterior y siguiente');
  const find = (dir) => SEQUENCE[i + dir] || null;
  const prev = find(-1);
  const next = find(1);
  if (prev) nav.insertAdjacentHTML('beforeend', `<a class="prev" href="${root}${prev.path}"><small>← Anterior</small>${prev.label}</a>`);
  if (next) nav.insertAdjacentHTML('beforeend', `<a class="next" href="${root}${next.path}"><small>Siguiente →</small>${next.label}</a>`);
  return nav;
}

export const BOOK_URL = 'http://www.game-feel.com';

function footer() {
  const f = document.createElement('footer');
  f.className = 'site-footer';
  f.innerHTML = `
    <p><strong>Inspirado en el libro original</strong> <em>Game Feel: A Game Designer's Guide to Virtual Sensation</em>,
      de Steve Swink (Morgan Kaufmann / Elsevier, 2009).
      Sitio original del libro y sus ejemplos: <a href="${BOOK_URL}" rel="noopener">www.game-feel.com</a>.</p>
    <p>Proyecto de estudio independiente, sin relación oficial con el autor ni la editorial. Los resúmenes están redactados con
      palabras propias y las demos son recreaciones abstractas de los conceptos. <a href="${root}index.html#creditos">Créditos completos</a>.</p>`;
  return f;
}

document.body.prepend(header());
const main = document.querySelector('main');
const p = pager();
if (p && main) main.append(p);
document.body.append(footer());
