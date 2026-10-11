// HUD (HTML 오버레이)
import * as THREE from 'three';
import { keyName } from './core.js';

const $ = (s, r = document) => r.querySelector(s);
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const tV = new THREE.Vector3();

export class HUD {
  constructor() {
    this.root = $('#hud'); this.dmg = $('#dmg'); this.ann = $('#announce'); this.flashEl = $('#flash'); this.cut = $('#cutin');
    this.sides = [0, 1].map((i) => {
      const el = $(`.pl.p${i + 1}`), eb = $(`.eb.p${i + 1}`);
      return { el, eb, fill: $('.fill', el), chip: $('.chip', el), nm: $('.nm', el), tt: $('.tt', el), num: $('.num', el), pips: $('.pips', el),
        en: $('.enfill', eb), enl: $('.enlabel', eb), skills: $('.skills', eb), combo: $(`.combo.p${i + 1}`) };
    });
    this.timer = $('#timer b'); this.rnd = $('#timer small'); this.annT = 0; this.flashA = 0;
  }
  show(v) { this.root.hidden = !v; }
  setup(G) {
    G.fighters.forEach((f, i) => {
      const s = this.sides[i], d = f.def, acc = hex(f.palette.accent);
      s.el.style.setProperty('--acc', acc); s.eb.style.setProperty('--acc', acc); s.combo.style.setProperty('--acc', acc);
      s.nm.textContent = d.short || d.name;
      s.tt.textContent = `${d.title} · ${f.ctrl && f.ctrl.human ? (i ? '2P' : '1P') : G.mode === 'training' && i ? '더미' : 'CPU'}`;
      const kl = (a) => (f.ctrl && f.ctrl.m ? keyName(f.ctrl.m[a][0]) : '');
      s.skills.innerHTML = ['s1', 's2'].map((k) => `<div class="sk" data-k="${k}"><b>${d.skills[k].name}</b><span>${kl(k)}</span><i></i></div>`).join('');
      s.ultKey = kl('ult');
      s.pips.innerHTML = G.mode === 'training' ? '' : '<i></i><i></i>';
      s.lastHp = -1; s.lastEn = -1;
    });
    this.rnd.textContent = G.mode === 'training' ? '훈련 모드' : `ROUND ${G.round}`;
  }
  update(G, dt) {
    G.fighters.forEach((f, i) => {
      const s = this.sides[i];
      if (f.chipT > 0) f.chipT -= dt; else f.dispHp += (f.hp - f.dispHp) * (1 - Math.exp(-dt * 5));
      if (f.dispHp < f.hp) f.dispHp = f.hp;
      s.fill.style.transform = `scaleX(${f.hp / f.maxHp})`; s.chip.style.transform = `scaleX(${f.dispHp / f.maxHp})`;
      s.el.classList.toggle('low', f.hp / f.maxHp < 0.25);
      s.num.textContent = `${Math.ceil(f.hp)} / ${f.maxHp}`;
      const en = Math.floor(f.energy), full = en >= 100;
      if (en !== s.lastEn) { s.en.style.transform = `scaleX(${f.energy / 100})`; s.enl.textContent = full ? `궁극기 준비 완료${s.ultKey ? `  [${s.ultKey}]` : ''}` : `ENERGY ${en}%`; s.eb.classList.toggle('full', full); s.lastEn = en; }
      s.skills.querySelectorAll('.sk').forEach((el) => {
        const k = el.dataset.k, cd = Math.max(0, f.cd[k]), max = f.def.skills[k].cd;
        el.classList.toggle('cool', cd > 0); el.querySelector('i').style.setProperty('--p', cd / max); el.querySelector('span').textContent = cd > 0 ? cd.toFixed(1) : (f.ctrl && f.ctrl.m ? keyName(f.ctrl.m[k][0]) : '');
      });
      const pips = s.pips.children; for (let k = 0; k < pips.length; k++) pips[k].classList.toggle('on', k < f.wins);
      if (f.combo >= 2 && f.comboT > 0) { s.combo.hidden = false; if (s.combo.dataset.n !== String(f.combo)) { s.combo.dataset.n = f.combo; s.combo.innerHTML = `<b>${f.combo}</b><span>HIT COMBO</span>`; s.combo.classList.remove('pop'); void s.combo.offsetWidth; s.combo.classList.add('pop'); } s.combo.style.opacity = Math.min(1, f.comboT * 2); }
      else s.combo.hidden = true;
    });
    this.timer.textContent = G.mode === 'training' ? '∞' : Math.ceil(G.timer);
    this.timer.classList.toggle('warn', G.mode !== 'training' && G.timer < 10);
    if (this.annT > 0) { this.annT -= dt; if (this.annT <= 0) this.ann.className = ''; }
    if (this.flashA > 0) { this.flashA = Math.max(0, this.flashA - dt * 2.6); this.flashEl.style.opacity = this.flashA; }
  }
  announce(text, sub = '', cls = '', dur = 1.2) {
    this.ann.innerHTML = `<h1>${text}</h1>${sub ? `<p>${sub}</p>` : ''}`; this.ann.className = ''; void this.ann.offsetWidth; this.ann.className = 'on ' + cls; this.annT = dur;
  }
  flash(color, a) { if (a < this.flashA) return; this.flashA = a; this.flashEl.style.background = hex(color); this.flashEl.style.opacity = a; }
  damage(p, val, big, block) {
    const G = window.__G; if (!G) return; tV.copy(p).project(G.camera);
    if (tV.z > 1) return;
    const r = G.renderer.domElement.getBoundingClientRect(), el = document.createElement('div');
    el.className = 'dn' + (big ? ' big' : '') + (block ? ' blk' : ''); el.textContent = val;
    el.style.left = `${r.left + (tV.x * 0.5 + 0.5) * r.width + (Math.random() - 0.5) * 30}px`; el.style.top = `${r.top + (-tV.y * 0.5 + 0.5) * r.height - 30}px`;
    this.dmg.appendChild(el); setTimeout(() => el.remove(), 900);
  }
  showCutin(f) {
    const d = f.def, c = this.cut; c.style.setProperty('--acc', hex(f.palette.accent)); c.style.setProperty('--band', f.palette.band || '#101018');
    $('small', c).textContent = `${d.short || d.name} · 궁극기`; $('h2', c).textContent = d.skills.ult.name; $('p', c).textContent = `— ${d.skills.ult.sub} —`;
    c.hidden = false; c.classList.remove('on', 'out'); void c.offsetWidth; c.classList.add('on');
  }
  outCutin() { this.cut.classList.add('out'); }
  hideCutin() { this.cut.hidden = true; this.cut.classList.remove('on', 'out'); }
  cutRect() { return $('.band', this.cut).getBoundingClientRect(); }
  setTraining(text) { const t = $('#trainBar'); t.hidden = !text; if (text) t.innerHTML = text; }
}
