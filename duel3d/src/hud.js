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
      const el = $(`.ph.p${i + 1}`), tb = $(`.tb.p${i + 1}`);
      return { el, tb, fill: $('.hpbar .fill', el), chip: $('.hpbar .chip', el), nm: $('.who .nm', el), tt: $('.who .tt', el), hpb: $('.hpnum b', el), hps: $('.hpnum span', el), rs: $('.rsbar', el),
        ult: $('.ult', el), arc: $('.ult .arc', el), ub: $('.uin b', el), uk: $('.uin span', el), un: $('.uname', el), skills: $('.skills', el), combo: $('.combo', el),
        tnm: $('.nm', tb), pips: $('.pips', tb), hb: $(`#hb${i}`) };
    });
    for (const s of this.sides) { s.hbn = $('.hbn', s.hb); s.hbf = $('.hbb .fill', s.hb); s.hbc = $('.hbb .chip', s.hb); }
    this.timer = $('#timer b'); this.rnd = $('#timer small'); this.annT = 0; this.flashA = 0;
    this.boss = $('#boss'); this.wave = $('#waveInfo'); this.ebars = []; this.ebarRoot = $('#ebars'); this.ret = $('#reticle'); this.popEl = $('#pop');
  }
  show(v) { this.root.hidden = !v; }
  setup(G) {
    this.root.classList.toggle('pvp', G.mode === 'pvp'); this.root.classList.toggle('pve', G.isPvE());
    const duo = G.isPvE() ? [G.player] : G.fighters.slice(0, 2);
    duo.forEach((f, i) => {
      const s = this.sides[i], d = f.def, acc = hex(f.palette.accent);
      for (const el of [s.el, s.tb, s.hb]) el.style.setProperty('--acc', acc);
      const role = f.ctrl && f.ctrl.human ? (i ? '2P' : '1P') : G.mode === 'training' && i ? '더미' : 'CPU';
      s.nm.textContent = d.short || d.name; s.tt.textContent = `${d.title} · ${role}`; s.tnm.textContent = `${role} ${d.short || d.name}`;
      s.hbn.textContent = `${d.short || d.name} · ${role}`;
      const kl = (a) => (f.ctrl && f.ctrl.m ? keyName(f.ctrl.m[a][0]) : '');
      // 스킬 칸: 우클(강공) · Shift(스킬1) · E(스킬2)
      const slots = [['heavy', (d.skills.heavy && d.skills.heavy.name) || '강공'], ['s1', d.skills.s1.name], ['s2', d.skills.s2.name]];
      s.skills.innerHTML = slots.map(([k, n]) => `<div class="sk" data-k="${k}"><i class="cd"></i><b class="k">${kl(k)}</b><span class="n">${n}</span><em class="t"></em></div>`).join('');
      s.uk.textContent = kl('ult'); s.un.textContent = `${d.skills.ult.name} 준비 완료`;
      s.pips.innerHTML = G.mode === 'training' ? '' : '<i></i><i></i>'; s.lastEn = -1;
    });
    this.rnd.textContent = G.isPvE() ? (G.mode === 'boss' ? '보스전' : '토벌전') : G.mode === 'training' ? '훈련 모드' : `ROUND ${G.round}`;
    this.boss.hidden = true; this.wave.hidden = !G.isPvE() || G.mode !== 'waves';
  }
  setWave(G) { if (G.mode !== 'waves') return; const n = G.fighters.filter((o) => o.team === 1 && !o.gone).length; this.wave.innerHTML = `<b>WAVE ${G.wave + 1}</b> / ${G.waveCount || 4} · 남은 적 ${n}`; }
  say(name, text, col) { const el = this.sayEl || (this.sayEl = $('#say')); el.innerHTML = `<b style="color:${hex(col)}">${name}</b>${text}`; el.className = ''; void el.offsetWidth; el.className = 'on'; }
  pop(text, cls) { const el = this.popEl; el.textContent = text; el.className = ''; void el.offsetWidth; el.className = 'on ' + (cls || ''); }
  update(G, dt) {
    const views = G.views ? G.views() : [], pve = G.isPvE();
    (pve ? [G.player] : G.fighters.slice(0, 2)).forEach((f, i) => {
      const s = this.sides[i];
      if (f.chipT > 0) f.chipT -= dt; else f.dispHp += (f.hp - f.dispHp) * (1 - Math.exp(-dt * 5));
      if (f.dispHp < f.hp) f.dispHp = f.hp;
      const hp = f.hp / f.maxHp, ch = f.dispHp / f.maxHp;
      s.fill.style.transform = `scaleX(${hp})`; s.chip.style.transform = `scaleX(${ch})`; s.el.classList.toggle('low', hp < 0.25);
      s.hpb.textContent = Math.ceil(f.hp); s.hps.textContent = `/ ${f.maxHp}`;
      // 캐릭터 고유 자원 (def.resource(f) → { v: 0..1, label, color, full })
      const rs = f.def.resource && f.def.resource(f); s.rs.hidden = !rs;
      if (rs) { s.rs.firstChild.style.transform = `scaleX(${rs.v})`; s.rs.lastChild.textContent = rs.label; s.rs.style.setProperty('--rs', hex(rs.color)); s.rs.classList.toggle('full', !!rs.full); }
      const en = Math.floor(f.energy);
      if (en !== s.lastEn) { s.arc.style.strokeDashoffset = 264 * (1 - f.energy / 100); s.ub.textContent = `${en}%`; s.ult.classList.toggle('ready', en >= 100); s.lastEn = en; }
      s.skills.querySelectorAll('.sk').forEach((el) => {
        const k = el.dataset.k, max = (f.def.skills[k] && f.def.skills[k].cd) || 0, cd = max ? Math.max(0, f.cd[k] || 0) : 0;
        el.classList.toggle('cool', cd > 0); el.querySelector('.cd').style.setProperty('--p', max ? cd / max : 0); el.querySelector('.t').textContent = cd > 0 ? Math.ceil(cd) : '';
      });
      const pips = s.pips.children; for (let k = 0; k < pips.length; k++) pips[k].classList.toggle('on', k < f.wins);
      if (f.combo >= 2 && f.comboT > 0) { s.combo.hidden = false; if (s.combo.dataset.n !== String(f.combo)) { s.combo.dataset.n = f.combo; s.combo.innerHTML = `<b>${f.combo}</b><span>HIT COMBO</span>`; s.combo.classList.remove('pop'); void s.combo.offsetWidth; s.combo.classList.add('pop'); } s.combo.style.opacity = Math.min(1, f.comboT * 2); }
      else s.combo.hidden = true;
    });
    // 상대 체력: 각 화면에서 상대 머리 위에 표시
    this.sides.forEach((s) => (s.hb.hidden = true));
    const showBars = G.state === 'intro' || G.state === 'fight' || G.state === 'ko';
    if (showBars && !pve && G.fighters.length === 2) views.forEach((v, vi) => {
      const me = v.fc.follow || G.fighters[0], o = me.opp; if (!o) return;
      if (!o.root.visible) return;
      tV.set(o.pos.x, o.pos.y + 2.25, o.pos.z).project(v.cam); if (tV.z > 1 || Math.abs(tV.x) > 1.05 || Math.abs(tV.y) > 1.05) return;
      const el = this.sides[vi].hb; // 화면마다 머리 위 막대 하나
      const os = this.sides[o.slot];
      el.style.setProperty('--acc', hex(o.palette.accent));
      el.querySelector('.hbn').textContent = os.hbn.textContent;
      el.querySelector('.hbb .fill').style.transform = `scaleX(${o.hp / o.maxHp})`; el.querySelector('.hbb .chip').style.transform = `scaleX(${o.dispHp / o.maxHp})`;
      el.style.left = `${v.x + (tV.x * 0.5 + 0.5) * v.w}px`; el.style.top = `${(-tV.y * 0.5 + 0.5) * v.h}px`; el.hidden = false;
    });
    if (pve) this.updatePvE(G, views[0]);
    else { this.boss.hidden = true; this.ebars.forEach((b) => (b.hidden = true)); }
    this.timer.textContent = pve ? `${Math.floor(G.stats.t / 60)}:${String(Math.floor(G.stats.t % 60)).padStart(2, '0')}` : G.mode === 'training' ? '∞' : Math.ceil(G.timer);
    this.timer.classList.toggle('warn', G.mode !== 'training' && G.timer < 10);
    if (this.annT > 0) { this.annT -= dt; if (this.annT <= 0) this.ann.className = ''; }
    if (this.flashA > 0) { this.flashA = Math.max(0, this.flashA - dt * 2.6); this.flashEl.style.opacity = this.flashA; }
  }
  announce(text, sub = '', cls = '', dur = 1.2) {
    this.ann.innerHTML = `<h1>${text}</h1>${sub ? `<p>${sub}</p>` : ''}`; this.ann.className = ''; void this.ann.offsetWidth; this.ann.className = 'on ' + cls; this.annT = dur;
  }
  flash(color, a) { if (a < this.flashA) return; this.flashA = a; this.flashEl.style.background = hex(color); this.flashEl.style.opacity = a; }
  // 보스 막대 · 몬스터 머리 위 막대 · 대상 표시
  updatePvE(G, v) {
    const B = G.boss && !G.boss.gone ? G.boss : null, active = G.state === 'fight' || G.state === 'intro';
    this.boss.hidden = !B || !active;
    if (B) {
      const b = this.boss; b.style.setProperty('--acc', hex(B.palette.accent));
      b.querySelector('.bn').textContent = B.def.name; b.querySelector('.bph').textContent = B.brokenT > 0 ? '브레이크' : B.enraged ? '2페이즈 · 격노' : '';
      b.querySelector('.bhp .fill').style.transform = `scaleX(${B.hp / B.maxHp})`; b.querySelector('.bhp .chip').style.transform = `scaleX(${B.dispHp / B.maxHp})`;
      b.querySelector('.bdz .fill').style.transform = `scaleX(${B.daze / B.maxDaze})`; b.classList.toggle('broken', B.brokenT > 0);
      if (B.chipT > 0) B.chipT -= 1 / 60; else B.dispHp += (B.hp - B.dispHp) * 0.08; if (B.dispHp < B.hp) B.dispHp = B.hp;
    }
    const mobs = G.fighters.filter((o) => o.team === 1 && !o.gone && o !== B);
    while (this.ebars.length < mobs.length) { const el = document.createElement('div'); el.className = 'hb eb'; el.innerHTML = '<span class="hbn"></span><div class="hbb"><i class="chip"></i><i class="fill"></i></div><div class="dzb"><i></i></div>'; this.ebarRoot.appendChild(el); this.ebars.push(el); }
    this.ebars.forEach((el, i) => {
      const o = mobs[i]; el.hidden = true; if (!o || !active || o.state === 'ko') return;
      tV.set(o.pos.x, o.pos.y + 2.2 * o.scale, o.pos.z).project(v.cam); if (tV.z > 1 || Math.abs(tV.x) > 1.05 || Math.abs(tV.y) > 1.05) return;
      if (o.chipT > 0) o.chipT -= 1 / 60; else o.dispHp += (o.hp - o.dispHp) * 0.1; if (o.dispHp < o.hp) o.dispHp = o.hp;
      el.style.setProperty('--acc', hex(o.palette.accent)); el.querySelector('.hbn').textContent = o.def.short;
      el.querySelector('.fill').style.transform = `scaleX(${o.hp / o.maxHp})`; el.querySelector('.chip').style.transform = `scaleX(${o.dispHp / o.maxHp})`;
      el.querySelector('.dzb i').style.transform = `scaleX(${o.maxDaze ? o.daze / o.maxDaze : 0})`; el.classList.toggle('broken', o.brokenT > 0); el.classList.toggle('tgt', o === G.player.opp);
      el.style.left = `${(tV.x * 0.5 + 0.5) * v.w}px`; el.style.top = `${(-tV.y * 0.5 + 0.5) * v.h}px`; el.hidden = false;
    });
    // 공격 대상 표시
    const t = G.player.opp; this.ret.hidden = true;
    if (t && active && !t.gone && t.state !== 'ko') { tV.set(t.pos.x, t.pos.y + 1.1 * t.scale, t.pos.z).project(v.cam); if (tV.z < 1) { this.ret.style.left = `${(tV.x * 0.5 + 0.5) * v.w}px`; this.ret.style.top = `${(-tV.y * 0.5 + 0.5) * v.h}px`; this.ret.hidden = false; this.ret.classList.toggle('locked', G.lock === t); } }
  }
  damage(p, val, big, block, crit) {
    const G = window.__G; if (!G) return;
    for (const v of G.views()) { // 화면 분할이면 양쪽 화면에 각각 표시
      tV.copy(p).project(v.cam); if (tV.z > 1 || Math.abs(tV.x) > 1.1) continue;
      const el = document.createElement('div');
      el.className = 'dn' + (big ? ' big' : '') + (block ? ' blk' : '') + (crit ? ' crit' : ''); el.textContent = val;
      el.style.left = `${v.x + (tV.x * 0.5 + 0.5) * v.w + (Math.random() - 0.5) * 30}px`; el.style.top = `${(-tV.y * 0.5 + 0.5) * v.h - 30}px`;
      this.dmg.appendChild(el); setTimeout(() => el.remove(), 900);
    }
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
