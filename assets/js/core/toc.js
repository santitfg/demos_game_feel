// Índice "En esta página": secciones (h2) y, anidados, los ejemplos prácticos (demos)
// que aparecen en cada una, con sus dispositivos. Llamar después de montar las demos.
import { DEMOS, DEVICE_LABEL } from '../chapters.js';

const slugify = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^[-0-9]+|-$/g, '');

export function buildToc() {
  const main = document.querySelector('main');
  const nodes = main.querySelectorAll('article h2, figure.demo');
  if (!nodes.length) return;

  const root = document.createElement('ul');
  let current = null; // <ul> de demos de la sección actual
  let demoCount = 0;

  for (const n of nodes) {
    if (n.tagName === 'H2') {
      if (!n.id) n.id = slugify(n.textContent);
      const li = document.createElement('li');
      li.innerHTML = `<a href="#${n.id}">${n.textContent}</a>`;
      current = document.createElement('ul');
      current.className = 'toc-demos';
      li.append(current);
      root.append(li);
      continue;
    }
    demoCount++;
    const id = n.querySelector('.demo-id')?.textContent || '';
    const meta = DEMOS[id] || {};
    const title = meta.title || n.querySelector('h3')?.textContent || 'Demo';
    const devs = (meta.devices || []).map((d) => `<span class="dev">${DEVICE_LABEL[d] || d}</span>`).join('');
    const li = document.createElement('li');
    li.innerHTML = `<a href="#${n.id}"><span class="toc-id">${id}</span> ${title}</a> ${devs}`;
    (current || root).append(li);

    // Atajo de vuelta al índice en la cabecera de la demo.
    const back = document.createElement('a');
    back.className = 'to-toc';
    back.href = '#indice';
    back.textContent = '↑ índice';
    n.querySelector('.demo-head').append(back);
  }
  root.querySelectorAll('ul.toc-demos:empty').forEach((u) => u.remove());

  const nav = document.createElement('nav');
  nav.className = 'toc';
  nav.id = 'indice';
  nav.setAttribute('aria-label', 'Índice de la página');
  nav.innerHTML = `<div class="toc-head"><strong>En esta página</strong><span>${demoCount} ejemplo${demoCount === 1 ? '' : 's'} práctico${demoCount === 1 ? '' : 's'}</span></div>`;
  nav.append(root);

  const anchor = main.querySelector('.lede') || main.querySelector('h1');
  anchor.after(nav);
}
