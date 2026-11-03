// Cap. 4 · Checklist de criterios: ¿esta mecánica tiene game feel? Ubica la respuesta en el diagrama de Venn.

const QUESTIONS = [
  { k: 'motion', block: 'ctl', q: '¿La imagen se actualiza a 10 fps o más mientras la usas?' },
  { k: 'resp', block: 'ctl', q: '¿Responde dentro de un ciclo perceptivo (≈100 ms o menos)?' },
  { k: 'cont', block: 'ctl', q: '¿Acepta input de forma continua, sin bloqueos largos que no eligió el jugador?' },
  { k: 'space', block: 'sim', q: '¿Hay colisiones u objetos en el espacio con los que el avatar interactúa?' },
  { k: 'active', block: 'sim', q: '¿El jugador percibe ese espacio activamente, a través de su propio control?' },
  { k: 'polish', block: 'pol', q: '¿Animaciones, sonido o partículas enfatizan las interacciones físicas?' },
];

const CASES = [
  { name: 'Street Fighter II · caminar', ctl: true, sim: true, pol: true, note: 'Responde en menos de 100 ms y sin bloqueos.' },
  { name: 'Street Fighter II · golpe fuerte', ctl: false, sim: true, pol: true, note: 'Casi un segundo de bloqueo, pero elegido; el sistema completo sí tiene control.' },
  { name: 'Prince of Persia (1989) · correr', ctl: false, sim: true, pol: true, note: 'Casi 900 ms de animación entre quieto y carrera a toda velocidad.' },
  { name: 'Prince of Persia · paso corto', ctl: true, sim: true, pol: true, note: 'La única mecánica con pocos frames: casi en tiempo real.' },
  { name: 'Guitar Hero · rasgueo', ctl: false, sim: false, pol: true, note: 'Respuesta instantánea pero sin continuidad: corta y termina.' },
  { name: 'Guitar Hero · palanca de trémolo', ctl: true, sim: false, pol: true, note: 'Continua, pero no hay espacio que percibir.' },
  { name: 'Kirby: Canvas Curse · dibujar', ctl: false, sim: true, pol: true, note: 'Corriges tu trazo, no un objeto virtual; Kirby te sigue indirectamente.' },
  { name: 'Starcraft · ordenar con clic', ctl: false, sim: true, pol: true, note: 'Fijas el destino, no guías el viaje.' },
];

export function mountChecklist(mount) {
  const host = document.querySelector(mount);
  const state = Object.fromEntries(QUESTIONS.map((q) => [q.k, true]));
  host.innerHTML = `
    <div class="checklist">
      <div class="checklist-q"></div>
      <div class="checklist-out">
        <svg viewBox="0 0 220 200" width="220" height="200" role="img" aria-label="Diagrama de Venn: control, espacio y pulido"></svg>
        <p class="verdict" aria-live="polite"></p>
      </div>
    </div>
    <div class="table-scroll">
      <table>
        <thead><tr><th>Mecánica (casos del cap. 4)</th><th>Control</th><th>Espacio</th><th>Pulido</th><th>Por qué</th></tr></thead>
        <tbody>${CASES.map((c, i) => `<tr data-i="${i}" tabindex="0" style="cursor:pointer"><td>${c.name}</td>${['ctl', 'sim', 'pol'].map((k) => `<td>${c[k] ? '✓' : '—'}</td>`).join('')}<td>${c.note}</td></tr>`).join('')}</tbody>
      </table>
    </div>`;
  const qBox = host.querySelector('.checklist-q');
  for (const q of QUESTIONS) {
    const row = document.createElement('label');
    row.className = 'param check';
    row.innerHTML = `<input type="checkbox" checked> ${q.q}`;
    row.querySelector('input').addEventListener('change', (e) => { state[q.k] = e.target.checked; draw(); });
    qBox.append(row);
  }
  const svg = host.querySelector('svg');
  const verdict = host.querySelector('.verdict');

  // Clic en un caso del libro: carga sus respuestas.
  host.querySelectorAll('tbody tr').forEach((tr) => {
    const load = () => {
      const c = CASES[+tr.dataset.i];
      state.motion = true;
      state.resp = c.ctl || c.name.includes('rasgueo') || c.name.includes('dibujar');
      state.cont = c.ctl;
      state.space = c.sim;
      state.active = c.sim && c.ctl;
      state.polish = c.pol;
      qBox.querySelectorAll('input').forEach((inp, i) => { inp.checked = state[QUESTIONS[i].k]; });
      draw(c.name);
    };
    tr.addEventListener('click', load);
    tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') load(); });
  });

  function draw(name) {
    const ctl = state.motion && state.resp && state.cont;
    const sim = state.space;
    const pol = state.polish;
    const full = ctl && sim && state.active && pol;
    const circ = (cx, cy, on, color, label, lx, ly) => `
      <circle cx="${cx}" cy="${cy}" r="58" fill="var(${color})" fill-opacity="${on ? 0.38 : 0.06}" stroke="var(${on ? color : '--line'})" stroke-width="2"/>
      <text x="${lx}" y="${ly}" font-size="12" font-family="Inter, sans-serif" fill="var(${on ? '--text' : '--muted'})" text-anchor="middle">${label}</text>`;
    svg.innerHTML = circ(78, 72, ctl, '--accent', 'Control', 50, 22) + circ(142, 72, sim, '--accent-3', 'Espacio', 172, 22) + circ(110, 128, pol, '--accent-2', 'Pulido', 110, 198)
      + (full ? '<circle cx="110" cy="92" r="7" fill="var(--text)"/>' : '');
    let msg;
    if (full) msg = 'Game feel pleno: control en tiempo real sobre un espacio simulado que se percibe activamente, con pulido.';
    else if (ctl && sim && pol && !state.active) msg = 'Hay control y espacio, pero el espacio se percibe de forma indirecta: game feel en el borde.';
    else if (!ctl && sim && pol) msg = 'Espacio y pulido sin control en tiempo real: se mira más de lo que se siente (Starcraft, Peggle).';
    else if (ctl && sim) msg = 'Game feel "crudo": funciona, pero le falta pulido que venda las interacciones.';
    else if (ctl && pol) msg = 'Control con pulido, pero sin espacio que tantear: los efectos no se apoyan en nada (Guitar Hero, trémolo).';
    else if (ctl) msg = 'Control desnudo: entretiene, pero el movimiento no significa nada.';
    else if (pol) msg = 'Solo pulido: vende interacciones que el jugador no controla (Bejeweled, Civilization).';
    else if (sim) msg = 'Simulación vista desde afuera (Bridge Builder).';
    else msg = 'Ninguno de los tres bloques: no hay game feel en el sentido del libro.';
    if (!state.cont && state.resp) msg += ' Ojo: si el bloqueo lo elige el jugador y tiene sentido en el mundo, puede no romper la sensación de control.';
    verdict.innerHTML = (name ? `<strong>${name}:</strong> ` : '') + msg;
  }
  draw();
}
