// Panel de parámetros generado desde un schema.
//
// schema: [
//   { heading: 'Movimiento' },
//   { key: 'accel', label: 'Aceleración', min: 0, max: 5000, step: 10, value: 1200, unit: 'px/s²', help: '…' },
//   { key: 'drag', type: 'check', label: 'Drag', value: true },
//   { key: 'model', type: 'select', label: 'Modelo', options: [['direct','Directo'], …], value: 'direct' },
//   { presets: { 'Jumpman': {accel: 0, …}, 'Mario': {…} } },
// ]
// Devuelve { values, set(key, v), setMany(obj), onChange(fn), el }.

const fmt = (v, step) => {
  if (typeof v !== 'number') return String(v);
  const decimals = step >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log10(step)));
  return v.toFixed(decimals);
};

export function createParams(container, schema, { onChange } = {}) {
  const values = {};
  const controls = {};
  const listeners = onChange ? [onChange] : [];
  const notify = (key) => listeners.forEach((fn) => fn(key, values[key], values));

  for (const item of schema) {
    if (item.heading) {
      const h = document.createElement('div');
      h.className = 'param-heading';
      h.textContent = item.heading;
      container.append(h);
      continue;
    }
    if (item.presets) {
      const wrap = document.createElement('div');
      wrap.className = 'presets';
      for (const [name, preset] of Object.entries(item.presets)) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn small';
        b.textContent = name;
        b.addEventListener('click', () => api.setMany(preset));
        wrap.append(b);
      }
      container.append(wrap);
      continue;
    }

    const type = item.type || 'range';
    const row = document.createElement('div');
    row.className = `param ${type}`;
    const id = `p-${Math.random().toString(36).slice(2, 8)}-${item.key}`;
    values[item.key] = item.value;

    if (type === 'range') {
      row.innerHTML = `
        <div class="param-row">
          <label for="${id}">${item.label}</label>
          <input class="val" type="text" inputmode="decimal" aria-label="${item.label} (valor)">
        </div>
        <input id="${id}" type="range" min="${item.min}" max="${item.max}" step="${item.step ?? 'any'}">`;
      const range = row.querySelector('input[type=range]');
      const num = row.querySelector('.val');
      const show = () => {
        range.value = values[item.key];
        num.value = fmt(values[item.key], item.step ?? 0.01) + (item.unit ? ` ${item.unit}` : '');
      };
      range.addEventListener('input', () => {
        values[item.key] = parseFloat(range.value);
        show();
        notify(item.key);
      });
      // Permite escribir valores fuera del rango del slider, como en los ejemplos del libro.
      const commit = () => {
        const v = parseFloat(num.value.replace(',', '.'));
        if (!Number.isNaN(v)) { values[item.key] = v; notify(item.key); }
        show();
      };
      num.addEventListener('change', commit);
      num.addEventListener('keydown', (e) => { if (e.key === 'Enter') { commit(); num.blur(); } });
      controls[item.key] = show;
      show();
    } else if (type === 'check') {
      row.innerHTML = `<label><input id="${id}" type="checkbox"> ${item.label}</label>`;
      const cb = row.querySelector('input');
      cb.addEventListener('change', () => { values[item.key] = cb.checked; notify(item.key); });
      controls[item.key] = () => { cb.checked = !!values[item.key]; };
      controls[item.key]();
    } else if (type === 'select') {
      row.innerHTML = `<div class="param-row"><label for="${id}">${item.label}</label></div><select id="${id}"></select>`;
      const sel = row.querySelector('select');
      for (const [v, label] of item.options) sel.add(new Option(label, v));
      sel.addEventListener('change', () => { values[item.key] = sel.value; notify(item.key); });
      controls[item.key] = () => { sel.value = values[item.key]; };
      controls[item.key]();
    }
    if (item.help) {
      const h = document.createElement('div');
      h.className = 'help';
      h.textContent = item.help;
      row.append(h);
    }
    container.append(row);
  }

  const api = {
    values,
    el: container,
    set(key, v) {
      if (!(key in values)) return;
      values[key] = v;
      controls[key]?.();
      notify(key);
    },
    setMany(obj) {
      for (const [k, v] of Object.entries(obj)) {
        if (k in values) { values[k] = v; controls[k]?.(); }
      }
      notify(null);
    },
    onChange(fn) { listeners.push(fn); },
  };
  return api;
}
