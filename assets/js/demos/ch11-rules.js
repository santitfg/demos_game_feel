// EX11-1 · Reglas: el mismo control (una nave con inercia) con capas de reglas de bajo, medio y alto nivel.

import { createDemo, text, roundRect } from '../core/demo.js';
import { audio } from '../core/audio.js';
import { circleCircle, burst, stepParticles, drawParticles } from './shared/physics2d.js';

const W = 900;
const H = 440;
const ROCKS = [[220, 140, 34], [460, 300, 44], [700, 150, 30], [640, 340, 26], [300, 360, 22]];

export function mountRules(mount, { id = 'EX11-1' } = {}) {
  return createDemo({
    mount,
    id,
    title: 'El mismo control, distintas reglas',
    width: W,
    height: H,
    hint: 'Clic aquí · W A S D para moverte · Espacio para disparar',
    modes: [
      { key: '1', label: 'Sin reglas' },
      { key: '2', label: '+ bajo nivel' },
      { key: '3', label: '+ nivel medio' },
      { key: '4', label: '+ alto nivel' },
    ],
    onModeChange(k, s, api) { if (s?.me) api.reset(); },
    metrics: [
      { key: 'rules', label: 'Reglas activas' },
      { key: 'hp', label: 'Salud' },
      { key: 'kills', label: 'Enemigos' },
      { key: 'keys', label: 'Llaves' },
    ],
    foot: `<p><strong>Prueba esto:</strong> en <kbd>1</kbd> la nave es un juguete: se siente bien, pero no hay por qué ir a ningún lado. <kbd>2</kbd>
      agrega enemigos con vida: los chicos caen de un disparo y el grande aguanta diez y retrocede apenas. Nada cambió en la física, pero el
      grande <em>parece</em> pesado. <kbd>3</kbd> agrega salud y botiquines: cuando estás bajo de vida, el botiquín se vuelve lo único que importa
      en la pantalla. <kbd>4</kbd> agrega llaves y una salida: ahora el mismo movimiento tiene una meta.</p>`,

    setup(api) {
      const lvl = +(api.mode || 1);
      const s = {
        me: { x: 80, y: H / 2, vx: 0, vy: 0, r: 13, m: 1, ang: 0 },
        rocks: ROCKS.map(([x, y, r]) => ({ x, y, r, vx: 0, vy: 0, fixed: true })),
        shots: [], enemies: [], packs: [], keys: [], parts: [],
        hp: 5, kills: 0, got: 0, cool: 0, hurt: 0, packIn: 4, won: false, t: 0,
      };
      if (lvl >= 2) {
        for (let i = 0; i < 5; i++) s.enemies.push(enemy(false));
        s.enemies.push(enemy(true));
      }
      if (lvl >= 4) for (let i = 0; i < 3; i++) s.keys.push({ x: 150 + Math.random() * (W - 300), y: 60 + Math.random() * (H - 120) });
      return s;
    },
    update(s, dt, api) {
      const lvl = +api.mode;
      const inp = api.input;
      s.t += dt;
      const ax = inp.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']) + (Math.abs(inp.pad.lx) > 0.2 ? inp.pad.lx : 0);
      const ay = inp.axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']) + (Math.abs(inp.pad.ly) > 0.2 ? inp.pad.ly : 0);
      const me = s.me;
      me.vx += ax * 900 * dt;
      me.vy += ay * 900 * dt;
      me.vx *= Math.exp(-1.4 * dt);
      me.vy *= Math.exp(-1.4 * dt);
      if (ax || ay) me.ang = Math.atan2(ay, ax);
      me.x += me.vx * dt;
      me.y += me.vy * dt;
      if (me.x < me.r || me.x > W - me.r) { me.vx *= -0.6; me.x = Math.max(me.r, Math.min(W - me.r, me.x)); }
      if (me.y < me.r || me.y > H - me.r) { me.vy *= -0.6; me.y = Math.max(me.r, Math.min(H - me.r, me.y)); }
      for (const r of s.rocks) circleCircle(me, r, 0.6);

      // Disparo (en todos los modos: el verbo existe aunque no haya reglas que le den sentido).
      s.cool -= dt;
      if ((inp.isDown('Space') || inp.pad.buttons[0]) && s.cool <= 0) {
        s.cool = 0.16;
        s.shots.push({ x: me.x + Math.cos(me.ang) * 16, y: me.y + Math.sin(me.ang) * 16, vx: Math.cos(me.ang) * 620 + me.vx, vy: Math.sin(me.ang) * 620 + me.vy, life: 0.9 });
        audio.tone({ freq: 900, dur: 0.04, type: 'square', gain: 0.04, slide: 0.6 });
      }
      for (const b of s.shots) { b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; }
      for (const b of s.shots) for (const r of s.rocks) if (Math.hypot(b.x - r.x, b.y - r.y) < r.r) b.life = 0;

      // Bajo nivel: los enemigos tienen vida; el grande aguanta mucho.
      for (const e of s.enemies) {
        e.t += dt;
        e.vx += Math.cos(e.t * e.f + e.ph) * 60 * dt;
        e.vy += Math.sin(e.t * e.f * 1.3 + e.ph) * 60 * dt;
        if (lvl >= 3) { const dx = me.x - e.x; const dy = me.y - e.y; const d = Math.hypot(dx, dy) || 1; e.vx += (dx / d) * (e.big ? 25 : 45) * dt; e.vy += (dy / d) * (e.big ? 25 : 45) * dt; }
        e.vx *= Math.exp(-0.8 * dt);
        e.vy *= Math.exp(-0.8 * dt);
        e.x = Math.max(e.r, Math.min(W - e.r, e.x + e.vx * dt));
        e.y = Math.max(e.r, Math.min(H - e.r, e.y + e.vy * dt));
        for (const r of s.rocks) circleCircle(e, r, 0.4);
        for (const b of s.shots) {
          if (b.life > 0 && Math.hypot(b.x - e.x, b.y - e.y) < e.r + 3) {
            b.life = 0;
            e.hp--;
            e.flash = 1;
            const push = e.big ? 25 : 120;
            e.vx += (b.vx / 620) * push;
            e.vy += (b.vy / 620) * push;
            burst(s.parts, b.x, b.y, { n: e.big ? 3 : 5, speed: 160, life: 0.25, color: 'warn', size: 3 });
            if (e.hp <= 0) {
              e.dead = true;
              s.kills++;
              burst(s.parts, e.x, e.y, { n: e.big ? 40 : 12, speed: e.big ? 300 : 200, life: 0.6, color: 'accent3', size: e.big ? 6 : 4 });
              audio.thud(e.big ? 1 : 0.2, 1);
            } else audio.tone({ freq: e.big ? 140 : 300, dur: 0.05, type: 'square', gain: 0.05 });
          }
        }
        e.flash = Math.max(0, (e.flash || 0) - dt * 8);
        // Nivel medio: tocar un enemigo quita salud.
        if (lvl >= 3 && Math.hypot(me.x - e.x, me.y - e.y) < me.r + e.r && s.hurt <= 0) {
          s.hp--;
          s.hurt = 1;
          me.vx += (me.x - e.x) * 6;
          me.vy += (me.y - e.y) * 6;
          audio.tone({ freq: 200, dur: 0.2, type: 'sawtooth', gain: 0.07, slide: 0.5 });
          if (s.hp <= 0) { api.reset(); return; }
        }
      }
      s.enemies = s.enemies.filter((e) => !e.dead);
      if (lvl >= 2 && s.enemies.length < 3) s.enemies.push(enemy(Math.random() < 0.25));
      s.shots = s.shots.filter((b) => b.life > 0 && b.x > -10 && b.x < W + 10 && b.y > -10 && b.y < H + 10);

      // Nivel medio: botiquines.
      if (lvl >= 3) {
        s.packIn -= dt;
        if (s.packIn <= 0 && s.packs.length < 1) { s.packs.push({ x: 100 + Math.random() * (W - 200), y: 60 + Math.random() * (H - 120) }); s.packIn = 6; }
        s.packs = s.packs.filter((pk) => {
          if (Math.hypot(pk.x - me.x, pk.y - me.y) < 24) { s.hp = Math.min(5, s.hp + 2); audio.blip(880); return false; }
          return true;
        });
      }
      // Alto nivel: llaves y salida.
      if (lvl >= 4) {
        s.keys = s.keys.filter((k) => {
          if (Math.hypot(k.x - me.x, k.y - me.y) < 22) { s.got++; audio.blip(1200); return false; }
          return true;
        });
        if (!s.keys.length && me.x > W - 40 && Math.abs(me.y - H / 2) < 50 && !s.won) {
          s.won = true;
          audio.tone({ freq: 660, dur: 0.4, type: 'triangle', gain: 0.2, slide: 2 });
          setTimeout(() => api.reset(), 1200);
        }
      }
      stepParticles(s.parts, dt);
      s.hurt = Math.max(0, s.hurt - dt * 1.5);
    },
    render(g, s, api) {
      const c = api.colors;
      const lvl = +api.mode;
      g.fillStyle = c.stage;
      g.fillRect(0, 0, W, H);
      if (lvl >= 3 && s.hp <= 2) { g.fillStyle = c.bad; g.globalAlpha = 0.08 + 0.05 * Math.sin(s.t * 8); g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
      for (const r of s.rocks) {
        g.fillStyle = c.surface2;
        g.beginPath();
        g.arc(r.x, r.y, r.r, 0, Math.PI * 2);
        g.fill();
      }
      if (lvl >= 4) {
        const open = !s.keys.length;
        g.fillStyle = open ? c.good : c.line;
        g.fillRect(W - 10, H / 2 - 50, 10, 100);
        text(g, open ? 'SALIDA' : 'cerrada', W - 16, H / 2 - 58, { size: 11, align: 'right', weight: 700, color: open ? c.good : c.muted });
        for (const k of s.keys) {
          g.fillStyle = c.warn;
          g.beginPath();
          g.arc(k.x, k.y, 9, 0, Math.PI * 2);
          g.fill();
          g.fillRect(k.x + 6, k.y - 2, 12, 4);
        }
      }
      for (const pk of s.packs) {
        g.fillStyle = c.good;
        g.fillRect(pk.x - 12, pk.y - 4, 24, 8);
        g.fillRect(pk.x - 4, pk.y - 12, 8, 24);
      }
      for (const e of s.enemies) {
        g.fillStyle = e.flash > 0 ? '#ffffff' : c.bad;
        g.beginPath();
        g.arc(e.x, e.y, e.r, 0, Math.PI * 2);
        g.fill();
        if (e.big) {
          g.fillStyle = c.bg;
          g.fillRect(e.x - 22, e.y - e.r - 12, 44, 5);
          g.fillStyle = c.bad;
          g.fillRect(e.x - 22, e.y - e.r - 12, 44 * (e.hp / 10), 5);
        }
      }
      for (const b of s.shots) {
        g.fillStyle = c.accent2;
        g.fillRect(b.x - 2, b.y - 2, 4, 4);
      }
      const me = s.me;
      g.save();
      g.translate(me.x, me.y);
      g.rotate(me.ang);
      g.fillStyle = s.hurt > 0 && Math.floor(s.t * 20) % 2 ? c.muted : c.accent;
      g.beginPath();
      g.moveTo(16, 0);
      g.lineTo(-11, -11);
      g.lineTo(-6, 0);
      g.lineTo(-11, 11);
      g.closePath();
      g.fill();
      g.restore();
      drawParticles(g, s.parts, c);
      if (s.won) text(g, '¡Nivel completo!', W / 2, H / 2, { size: 26, weight: 700, align: 'center', color: c.good });
      if (lvl >= 3) {
        for (let i = 0; i < 5; i++) {
          roundRect(g, 14 + i * 22, 14, 18, 18, 4);
          g.fillStyle = i < s.hp ? c.bad : c.surface2;
          g.fill();
        }
      }
      api.metric('rules', ['ninguna', 'vida de enemigos', '+ salud y botiquines', '+ llaves y salida'][lvl - 1]);
      api.metric('hp', lvl >= 3 ? `${s.hp} / 5` : '—');
      api.metric('kills', lvl >= 2 ? String(s.kills) : '—');
      api.metric('keys', lvl >= 4 ? `${s.got} / 3` : '—');
    },
  });
}

function enemy(big) {
  return {
    x: 300 + Math.random() * (W - 340), y: 40 + Math.random() * (H - 80), vx: 0, vy: 0,
    r: big ? 30 : 11, m: big ? 8 : 1, hp: big ? 10 : 1, big, t: 0, f: 0.6 + Math.random(), ph: Math.random() * 6,
  };
}
