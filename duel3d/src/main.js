// 게임 진행: 렌더러 · 상태 머신(타이틀→라운드→KO→결과) · 컷인 렌더 · 훈련 모드
import * as THREE from 'three';
import { keys, pressed, endFrame, MAPS, KeyCtrl, sfx, audioInit, setMuted, isMuted, damp, keyName } from './core.js';
import { FX } from './fx.js';
import { buildStage } from './stage.js';
import { Fighter } from './fighter.js';
import { FightCam } from './camera.js';
import { HUD } from './hud.js';
import { AICtrl, DummyCtrl, DUMMY_LABEL } from './ai.js';
import { ROSTER, EMPTY_SLOTS } from './characters/index.js';

const V3 = THREE.Vector3;
const $ = (s) => document.querySelector(s);
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(48, 16 / 9, 0.1, 1500);
const camera2 = new THREE.PerspectiveCamera(48, 8 / 9, 0.1, 1500); // 2P 화면 분할용
const pCam = new THREE.PerspectiveCamera(26, 4, 0.05, 60);
const pKey = new THREE.SpotLight(0xffffff, 0, 10, 0.7, 0.6, 1); scene.add(pKey, pKey.target);
const pHemi = new THREE.HemisphereLight(0xc8d4ff, 0x1a1020, 0); scene.add(pHemi);
// 카메라를 따라다니는 보조광: 역광 속에서도 캐릭터 실루엣이 읽히도록
const camFill = new THREE.DirectionalLight(0xc0c8ff, 1.1); scene.add(camFill, camFill.target);
const stage = buildStage(scene), fx = new FX(scene), hud = new HUD(), fcam = new FightCam(camera), fcam2 = new FightCam(camera2);

const G = (window.__G = {
  scene, camera, renderer, fx, hud, stage, fighters: [], ents: [], preview: [],
  state: 'title', mode: 'cpu', time: 0, t: 0, rdt: 1 / 60, timer: 99, round: 1, hitstop: 0, ts: 1, tsT: 1, tsHold: 0,
  cine: null, paused: false, camFwd: { x: 0, z: -1 }, tint: { c: 0, a: 0 }, tintA: 0, sel: { p1: 0, p2: 0 },
  shake(a) { fcam.shake = Math.max(fcam.shake, a); fcam2.shake = Math.max(fcam2.shake, a); },
  // 2P 대전은 좌우 분할. 궁극기 연출·KO·결과처럼 카메라 1이 연출 중이면 전체 화면 하나로 합친다
  splitOn() { return G.mode === 'pvp' && G.fighters.length === 2 && !G.cine && !fcam.cine && !fcam.focus && G.state !== 'title'; },
  views() {
    const w = innerWidth, h = innerHeight;
    return G.splitOn() ? [{ cam: camera, fc: fcam, x: 0, w: Math.floor(w / 2), h }, { cam: camera2, fc: fcam2, x: Math.floor(w / 2), w: w - Math.floor(w / 2), h }] : [{ cam: camera, fc: fcam, x: 0, w, h }];
  },
  camFwdOf(f) { const c = f && f.slot === 1 && G.splitOn() ? camera2 : camera; c.getWorldDirection(tmpV); tmpV.y = 0; tmpV.normalize(); return { x: tmpV.x, z: tmpV.z }; },
  flash(c, a) { hud.flash(c, a); },
  slow(s, h) { G.tsT = s; G.ts = Math.min(G.ts, s); G.tsHold = h; },
  spawn(e) { G.ents.push(e); },
  setTint(c, a) { G.tint = { c, a }; if (a > 0) stage.setTint(c, G.tintA); },
  startCine(f) {
    G.cine = { f, t: 0, dur: 1.75, out: false }; hud.showCutin(f); sfx('ult'); G.flash(f.palette.accent, 0.35);
    fcam.stopCine(); f.pose.set(f.def._poses.portrait || f.def._poses.base); f.applyRig(1);
  },
  onKO(loser, att) {
    if (G.mode === 'training') return;
    if (G.state !== 'fight') return;
    G.state = 'ko'; G.t = 0; G.winner = att; att.wins++; G.slow(0.25, 1.1); G.flash(0xffffff, 0.7); G.shake(0.3); sfx('ko');
    hud.announce('K.O.', '', 'red', 2.2); fcam.setFocus(loser, { dist: 5.5, h: 1.8, spin: 0.35 });
  },
});

/* ---------- 리사이즈 ---------- */
function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  fx.setScale((h * renderer.getPixelRatio()) / (2 * Math.tan((camera.fov * Math.PI) / 360)));
}
addEventListener('resize', resize); resize();

/* ---------- 터치 ---------- */
const touch = $('#touch');
if (matchMedia('(pointer: coarse)').matches) touch.classList.add('on');
touch.querySelectorAll('button').forEach((b) => {
  const k = b.dataset.k;
  const on = (e) => { e.preventDefault(); audioInit(); if (!keys[k]) pressed[k] = true; keys[k] = true; b.classList.add('down'); };
  const off = (e) => { e.preventDefault(); keys[k] = false; b.classList.remove('down'); };
  b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off);
});

/* ---------- 타이틀 / 선택 ---------- */
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
function buildSelect() {
  for (const [id, slot] of [['#r1', 'p1'], ['#r2', 'p2']]) {
    const el = $(id), col = slot === 'p1' ? 'var(--p1)' : 'var(--p2)';
    el.innerHTML = ROSTER.map((d, i) => `<button class="card" data-slot="${slot}" data-i="${i}" style="--sel:${col}" aria-pressed="${G.sel[slot] === i}"><span class="tag">${slot === 'p1' ? '1P' : G.mode === 'pvp' ? '2P' : G.mode === 'training' ? '더미' : 'CPU'}</span><b>${d.short || d.name}</b><span>${d.title}</span></button>`).join('')
      + Array.from({ length: EMPTY_SLOTS }, () => '<div class="card empty"><b>?</b><span>추가 예정</span></div>').join('');
  }
  $('#r2lbl').textContent = G.mode === 'pvp' ? '2P 캐릭터' : G.mode === 'training' ? '훈련 상대' : 'CPU 캐릭터';
  document.querySelectorAll('#modes button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.mode === G.mode));
  const d = ROSTER[G.sel.p1];
  $('#charInfo').innerHTML = `<h3>${d.name}</h3><p>${d.desc}</p><dl class="mv">${d.moveList.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
  const k = (c) => `<kbd>${c}</kbd>`;
  $('#keyHelp').innerHTML = G.mode === 'pvp'
    ? `1P ${k('W')}${k('A')}${k('S')}${k('D')} 이동 · ${k('Space')} 점프 · ${k('Shift')} 대시 · ${k('L')} 방어 · ${k('J')} 약공 ${k('K')} 강공 ${k('U')} ${k('I')} 스킬 ${k('O')} 궁극기<br>2P 방향키 이동 · ${k('Num0')} 점프 · ${k('Num.')} 대시 · ${k('Num3')} 방어 · ${k('Num1')} 약공 ${k('Num2')} 강공 ${k('Num4')} ${k('Num5')} 스킬 ${k('Num6')} 궁극기`
    : `${k('W')}${k('A')}${k('S')}${k('D')} / 방향키 이동 (카메라 기준) · ${k('Space')} 점프 · ${k('Shift')} 대시 · ${k('L')} 방어(누르고 있기)<br>${k('J')} 약공(연타 3단) · ${k('K')} 강공 · ${k('U')} 스킬1 · ${k('I')} 스킬2 · ${k('O')} 궁극기 · ${k('Esc')} 일시정지 · ${k('M')} 소리`;
  rebuildPreview();
}
function rebuildPreview() {
  for (const f of G.preview) f.dispose(); G.preview = [];
  const d1 = ROSTER[G.sel.p1], d2 = ROSTER[G.sel.p2];
  const a = new Fighter(d1, 0, null, G, d1.palettes[0]), b = new Fighter(d2, 1, null, G, d1 === d2 ? d2.palettes[1] : d2.palettes[0]);
  a.reset(new V3(-1.3, 0, 0.6)); b.reset(new V3(1.3, 0, -0.6)); a.opp = b; b.opp = a; a.state = 'win'; G.preview = [a, b];
}
document.addEventListener('click', (e) => {
  const t = e.target.closest('button'); if (!t) return; audioInit();
  if (t.dataset.mode) { G.mode = t.dataset.mode; sfx('ui'); buildSelect(); }
  else if (t.dataset.slot) { G.sel[t.dataset.slot] = +t.dataset.i; sfx('ui'); buildSelect(); }
  else if (t.id === 'start') startMatch();
  else if (t.dataset.act === 'resume') setPause(false);
  else if (t.dataset.act === 'title') toTitle();
  else if (t.dataset.act === 'rematch') startMatch();
});
function showScreen(id) { for (const s of ['#title', '#pause', '#result']) $(s).hidden = s !== id; }
function toTitle() {
  G.paused = false; clearMatch(); G.state = 'title'; fcam.mode = 'orbit'; fcam.focus = null; fcam.cine = null; fcam.follow = fcam2.follow = null; hud.show(false); hud.hideCutin(); hud.setTraining('');
  showScreen('#title'); buildSelect();
}
function setPause(p) {
  G.paused = p; $('#pause').hidden = !p;
  $('#pauseKeys').innerHTML = G.mode === 'training' ? '훈련 모드 단축키: <kbd>F</kbd> 에너지 100% · <kbd>R</kbd> 쿨타임 초기화 · <kbd>T</kbd> 더미 행동 변경 · <kbd>H</kbd> 체력 회복' : '<kbd>Esc</kbd> 또는 <kbd>P</kbd> 로 계속하기 · <kbd>M</kbd> 소리 켜기/끄기';
}

/* ---------- 경기 ---------- */
function clearMatch() {
  for (const f of G.fighters) f.dispose(); G.fighters = [];
  for (const e of G.ents) e.kill && e.kill(); G.ents = []; fx.clear(); G.cine = null; G.setTint(0, 0);
}
function startMatch() {
  sfx('ult'); for (const f of G.preview) f.dispose(); G.preview = []; clearMatch();
  const d1 = ROSTER[G.sel.p1], d2 = ROSTER[G.sel.p2];
  const c1 = new KeyCtrl(G.mode === 'pvp' ? MAPS.p1 : MAPS.p1solo);
  const c2 = G.mode === 'pvp' ? new KeyCtrl(MAPS.p2) : G.mode === 'training' ? new DummyCtrl() : new AICtrl();
  const a = new Fighter(d1, 0, c1, G, d1.palettes[0]), b = new Fighter(d2, 1, c2, G, d1 === d2 ? d2.palettes[1] : d2.palettes[0]);
  a.opp = b; b.opp = a; G.fighters = [a, b]; G.round = 1;
  showScreen(null); hud.show(true); fcam.mode = fcam2.mode = 'fight'; fcam.follow = a; fcam2.follow = b; fcam.cyaw = fcam2.cyaw = null; startRound();
}
function startRound() {
  const [a, b] = G.fighters; a.reset(new V3(-4, 0, 0)); b.reset(new V3(4, 0, 0));
  for (const e of G.ents) e.kill && e.kill(); G.ents = []; fx.clear();
  G.cine = null; G.t = 0; G.timer = 99; G.winner = null; G.timeout = false; G.ts = G.tsT = 1; G.tsHold = 0; G.hitstop = 0; G.setTint(0, 0);
  fcam.focus = null; fcam.cine = null; fcam.cyaw = fcam2.cyaw = null; hud.hideCutin(); hud.setup(G);
  if (G.mode === 'training') { G.state = 'fight'; hud.announce('훈련 시작', '', 'gold', 1.2); updateTrainBar(); }
  else { G.state = 'intro'; hud.announce(G.round >= 3 ? '최종 라운드' : `ROUND ${G.round}`, '', '', 1.1); }
}
function updateTrainBar() {
  const d = G.fighters[1].ctrl;
  hud.setTraining(`<kbd>F</kbd> 에너지 100% · <kbd>R</kbd> 쿨타임 초기화 · <kbd>H</kbd> 체력 회복 · <kbd>T</kbd> 더미: <b>${DUMMY_LABEL[d.mode]}</b>`);
}
function timeUp() {
  const [a, b] = G.fighters; G.state = 'ko'; G.t = 0; G.timeout = true;
  G.winner = Math.abs(a.hp - b.hp) < 1 ? null : a.hp > b.hp ? a : b; if (G.winner) G.winner.wins++;
  hud.announce('TIME OVER', G.winner ? '' : '무승부', 'red', 2.2);
}
function endRoundCheck() {
  const champ = G.fighters.find((f) => f.wins >= 2);
  if (champ) {
    G.state = 'over'; G.t = 0; champ.state = 'win'; champ.inv = 99; fcam.setFocus(champ, { dist: 4.2, h: 1.5, spin: 0.15, yaw: champ.yaw });
    $('#resSub').textContent = champ.def.title; $('#resTitle').textContent = `${champ.slot ? (G.mode === 'cpu' ? 'CPU' : '2P') : '1P'} 승리`;
    $('#resScore').textContent = `${champ.def.short || champ.def.name}  ·  ${G.fighters[0].wins} : ${G.fighters[1].wins}`;
    setTimeout(() => { if (G.state === 'over') showScreen('#result'); }, 1200);
  } else { G.round++; startRound(); }
}

/* ---------- 업데이트 ---------- */
const tmpV = new V3();
function update(rdt) {
  G.rdt = rdt; G.time += rdt;
  camera.getWorldDirection(tmpV); tmpV.y = 0; tmpV.normalize(); G.camFwd = { x: tmpV.x, z: tmpV.z };
  if (pressed.KeyM) setMuted(!isMuted());
  stage.update(rdt, G.time);
  if (G.state === 'title') {
    if (pressed.Enter) startMatch();
    if (pressed.ArrowLeft || pressed.KeyA) { G.sel.p1 = (G.sel.p1 + ROSTER.length - 1) % ROSTER.length; buildSelect(); }
    if (pressed.ArrowRight || pressed.KeyD) { G.sel.p1 = (G.sel.p1 + 1) % ROSTER.length; buildSelect(); }
    if (pressed.Tab) { const m = ['cpu', 'pvp', 'training']; G.mode = m[(m.indexOf(G.mode) + 1) % 3]; buildSelect(); }
    for (const f of G.preview) f.update(rdt, false);
    fx.update(rdt, camera); fcam.update(rdt, { fighters: [] }); return;
  }
  if ((pressed.Escape || pressed.KeyP) && (G.state === 'fight' || G.state === 'intro' || G.paused)) setPause(!G.paused);
  if (G.paused) return;
  if (G.state === 'over' && G.t > 1.2 && pressed.Enter) return startMatch();
  if (G.state === 'over' && pressed.Escape) return toTitle();
  for (const f of G.fighters) f.read();
  // 훈련 단축키
  if (G.mode === 'training') {
    const [a, b] = G.fighters;
    if (pressed.KeyF) a.energy = b.energy = 100;
    if (pressed.KeyR) { a.cd.s1 = a.cd.s2 = b.cd.s1 = b.cd.s2 = 0; }
    if (pressed.KeyH) { a.hp = a.dispHp = a.maxHp; b.hp = b.dispHp = b.maxHp; }
    if (pressed.KeyT) { b.ctrl.cycle(); updateTrainBar(); }
    for (const f of G.fighters) if (f.lastHitT > 1.6 && f.state !== 'hit') f.hp = Math.min(f.maxHp, f.hp + rdt * 500);
  }
  // 시간 배율 · 화면 색조
  if (G.tsHold > 0) G.tsHold -= rdt; else G.tsT = 1;
  G.ts = damp(G.ts, G.tsT, 6, rdt);
  G.tintA = damp(G.tintA, G.tint.a, 4, rdt); stage.setTint(G.tint.c, G.tintA);
  const dt = rdt * G.ts;
  if (G.cine) {
    const C = G.cine; C.t += rdt;
    if (C.t > C.dur - 0.22 && !C.out) { C.out = true; hud.outCutin(); }
    if (C.t >= C.dur) { G.cine = null; hud.hideCutin(); G.flash(0xffffff, 0.6); G.shake(0.15); fcam.playCine(C.f, C.f.act && C.f.act.cam); }
    camUpdate(rdt); hud.update(G, rdt); return;
  }
  if (G.hitstop > 0) { G.hitstop -= rdt; fx.update(dt * 0.1, camera); camUpdate(rdt); hud.update(G, rdt); return; }
  G.t += dt;
  if (G.state === 'intro' && G.t > 1.15 && !G.fightShown) { G.fightShown = true; hud.announce('FIGHT!', '', 'gold', 0.9); }
  if (G.state === 'intro' && G.t > 1.9) { G.state = 'fight'; G.t = 0; G.fightShown = false; }
  const live = G.state === 'fight';
  if (live && G.mode !== 'training') { G.timer -= dt; if (G.timer <= 0) { G.timer = 0; timeUp(); } }
  if (G.state === 'ko') {
    if (G.t > 1.8 && G.winner && !['act', 'win', 'ko', 'hit', 'down'].includes(G.winner.state)) { G.winner.state = 'win'; G.winner.inv = 99; }
    if (G.t > 1.4 && G.winner && !G.winSub) { G.winSub = true; hud.announce(`${G.winner.slot ? (G.mode === 'cpu' ? 'CPU' : '2P') : '1P'} 라운드 승리`, '', 'gold', 1.6); }
    if (G.t > 4) { G.winSub = false; endRoundCheck(); }
  }
  for (const f of G.fighters) f.update(dt, live || (G.state === 'ko' && f.state === 'act'));
  // 몸 겹침 방지
  const [a, b] = G.fighters;
  if (!a.held && !b.held && a.state !== 'ko' && b.state !== 'ko' && Math.abs(a.pos.y - b.pos.y) < 1.4) {
    const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz), ov = 0.9 - d;
    if (ov > 0) { const nx = d > 1e-4 ? dx / d : 1, nz = d > 1e-4 ? dz / d : 0; a.pos.x -= nx * ov / 2; a.pos.z -= nz * ov / 2; b.pos.x += nx * ov / 2; b.pos.z += nz * ov / 2; }
  }
  for (let i = G.ents.length - 1; i >= 0; i--) { G.ents[i].update(dt); if (G.ents[i].done) G.ents.splice(i, 1); }
  fx.update(dt, camera); camUpdate(rdt); hud.update(G, rdt);
}
function camUpdate(rdt) { fcam.update(rdt, G); if (G.mode === 'pvp') fcam2.update(rdt, G); }

/* ---------- 렌더 (+ 궁극기 초상 패스) ---------- */
const bandColor = new THREE.Color();
function render() {
  camFill.position.copy(camera.position).add(new V3(0, 3, 0)); camFill.target.position.copy(fcam.look);
  const views = G.views(), split = views.length > 1;
  renderer.setScissorTest(split);
  for (const v of views) {
    const a = v.w / v.h; if (Math.abs(v.cam.aspect - a) > 1e-3) { v.cam.aspect = a; v.cam.updateProjectionMatrix(); }
    renderer.setViewport(v.x, 0, v.w, v.h); if (split) renderer.setScissor(v.x, 0, v.w, v.h);
    renderer.render(scene, v.cam);
  }
  renderer.setScissorTest(false); renderer.setViewport(0, 0, innerWidth, innerHeight);
  document.body.classList.toggle('split', split);
  if (G.cine) renderPortrait(G.cine);
}
function renderPortrait(C) {
  const r = hud.cutRect(); if (r.height < 4) return;
  const x = r.left, y = innerHeight - r.bottom, w = r.width, h = r.height, f = C.f;
  const head = f.model.J.head.getWorldPosition(new V3()).add(new V3(0, 0.06, 0)), fw = f.fwd(new V3()), up = new V3(0, 1, 0);
  const sr = new V3().crossVectors(fw.clone().negate(), up).normalize();
  const dist = 1.55 - C.t * 0.12, visH = 2 * dist * Math.tan((pCam.fov * Math.PI) / 360), off = 0.2 * visH * (w / h);
  pCam.aspect = w / h; pCam.updateProjectionMatrix();
  pCam.position.copy(head).addScaledVector(fw, dist).addScaledVector(sr, off).add(new V3(0, 0.04, 0)); pCam.lookAt(head.clone().addScaledVector(sr, off));
  pKey.position.copy(head).addScaledVector(fw, 1.4).addScaledVector(sr, -1.1).add(new V3(0, 0.9, 0)); pKey.target.position.copy(head); pKey.intensity = 40; pHemi.intensity = 1.1;
  const hidden = [stage.group, ...G.fighters.filter((o) => o !== f).map((o) => o.root)], vis = hidden.map((o) => o.visible);
  hidden.forEach((o) => (o.visible = false)); fx.setVisible(false); f.shield.m.visible = false;
  const fog = scene.fog; scene.fog = null; scene.background = bandColor.set(f.palette.band || '#101018');
  renderer.setScissorTest(true); renderer.setScissor(x, y, w, h); renderer.setViewport(x, y, w, h);
  renderer.render(scene, pCam);
  renderer.setScissorTest(false); renderer.setViewport(0, 0, innerWidth, innerHeight);
  scene.background = null; scene.fog = fog; hidden.forEach((o, i) => (o.visible = vis[i])); fx.setVisible(true); pKey.intensity = 0; pHemi.intensity = 0;
}

let last = performance.now();
function frame(now) {
  const rdt = Math.min(0.05, (now - last) / 1000); last = now;
  try { update(rdt); render(); } catch (e) { console.error(e); }
  endFrame(); requestAnimationFrame(frame);
}
// 개발용: 고정 간격으로 n프레임 진행 (헤드리스 테스트에서 사용)
window.__step = (n, dt = 1 / 60) => { for (let i = 0; i < n; i++) { update(dt); endFrame(); } render(); };
buildSelect(); fcam.snap(); requestAnimationFrame(frame);
