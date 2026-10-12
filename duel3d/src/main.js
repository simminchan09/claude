// 게임 진행: 렌더러 · 모드별 진행(보스전 · 토벌전 · 1:1 결투 · 2P 대전 · 훈련) · 전투 판정 이벤트 · 컷인 렌더
import * as THREE from 'three';
import { keys, pressed, endFrame, MAPS, KeyCtrl, sfx, audioInit, setMuted, isMuted, damp, rand, mouse } from './core.js';
import { FX } from './fx.js';
import { buildStage, MAPS as STAGES } from './stage.js';
import { Fighter } from './fighter.js';
import { FightCam } from './camera.js';
import { HUD } from './hud.js';
import { AICtrl, DummyCtrl, DUMMY_LABEL, EnemyAI } from './ai.js';
import { ROSTER, EMPTY_SLOTS } from './characters/index.js';
import { ENEMIES, WAVES } from './enemies/index.js';

const V3 = THREE.Vector3, UP = new V3(0, 1, 0);
const $ = (s) => document.querySelector(s);
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
// 내부 해상도: 일반 모니터(배율 1)에서도 1.25배로 그려 계단 현상을 줄인다. ?q=low 면 기기 배율 그대로
const LOWQ = new URLSearchParams(location.search).get('q') === 'low';
renderer.setPixelRatio(LOWQ ? Math.min(1, window.devicePixelRatio || 1) : Math.min(2, Math.max(1.25, window.devicePixelRatio || 1)));
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
const firstMap = STAGES[(Math.random() * STAGES.length) | 0].id;
let stage = buildStage(scene, firstMap); const fx = new FX(scene), hud = new HUD(), fcam = new FightCam(camera), fcam2 = new FightCam(camera2);

const PVE = ['boss', 'waves'];
const isPvE = () => PVE.includes(G.mode);
const MODE_NAME = { boss: '보스전', waves: '토벌전', duel: '1:1 결투', pvp: '2P 대전', training: '훈련' };

const G = (window.__G = {
  scene, camera, renderer, fx, hud, stage, fighters: [], ents: [], preview: [], player: null, boss: null, lock: null,
  state: 'title', mode: 'boss', time: 0, t: 0, rdt: 1 / 60, timer: 99, round: 1, hitstop: 0, ts: 1, tsT: 1, tsHold: 0, foeScale: 1, foeSlowT: 0,
  cine: null, paused: false, camFwd: { x: 0, z: -1 }, tint: { c: 0, a: 0 }, tintA: 0, tintT: 0, sel: { p1: 0, p2: 0 }, mapId: firstMap, mouse,
  isPvE,
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
  // 대사 자막 (플레이어 캐릭터만)
  say(f, text) { if (f === G.player || (G.mode === 'pvp' && f.team === 1)) hud.say(f.def.short || f.def.name, text, f.palette.accent); },
  setTint(c, a, hold) { G.tint = { c, a }; G.tintT = hold || 0; if (a > 0) stage.setTint(c, G.tintA); },
  // 공격 대상: 다른 팀이면서 살아 있는 파이터
  foesOf(f) { return G.fighters.filter((o) => o.team !== f.team && o.state !== 'ko' && !o.gone); },
  // 동시에 공격하는 몬스터 수 제한 (보스는 예외)
  takeToken(f) { return f.def.boss || G.fighters.filter((o) => o.team === 1 && o.state === 'act' && !o.def.boss).length < 2; },
  toggleLock(f) { if (f !== G.player || G.mode === 'pvp') return; G.lock = G.lock ? null : f.opp; sfx('ui'); },
  // 공격 예고: 노랑 = 패리 가능, 빨강 = 막을 수 없음(회피)
  telegraph(f, kind) {
    const col = kind === 'red' ? 0xff2a2a : 0xffc83a, head = new V3(f.pos.x, f.pos.y + 1.95 * f.scale, f.pos.z);
    fx.p(head, { size: 1.5 * f.scale, size1: 0.3, life: 0.4, color: col, alpha: 1 }); fx.ring(head, { r0: 0.1, r1: 1.3 * f.scale, life: 0.4, color: col, billboard: true });
    fx.burst(head, 12, [col, 0xffffff], 4); fx.light(head, col, 40, 0.35, 8);
    if (kind === 'red') fx.ring(f.pos.clone().setY(0.06), { normal: UP, r0: 3.5 * f.scale, r1: 0.8, life: 0.55, color: col });
    sfx(kind === 'red' ? 'teleRed' : 'tele');
  },
  onPerfectDodge(f, att) {
    if (f.team !== 0) return;
    G.foeSlowT = 1.7; f.counterT = 1.9; f.inv = Math.max(f.inv, 0.45); G.stats.dodge++;
    sfx('dodge'); hud.pop('극한 회피', 'cyan'); G.flash(0x9ad8ff, 0.25); G.setTint(0x2a5aff, 0.28, 1.6);
    fx.burst(f.chest(), 30, [f.palette.accent, 0xffffff], 6, { kind: 'glow', sk: 0.6 }); fx.ring(f.chest(), { r0: 0.2, r1: 2.5, life: 0.4, color: 0x9ad8ff, billboard: true });
  },
  onParry(f, att, h, point) {
    G.stats.parry++; sfx('parry'); hud.pop('패리', 'gold'); G.hitstop = Math.max(G.hitstop, 0.14); G.slow(0.35, 0.35); G.flash(0xffe08a, 0.25);
    fx.burst(point, 34, [0xffe08a, 0xffffff], 10); fx.ring(point, { r0: 0.2, r1: 2.2, life: 0.35, color: 0xffd060, billboard: true }); fx.light(point, 0xffd060, 90, 0.3);
    f.energy = Math.min(100, f.energy + 8); f.blockStun = 0.12; f.shield.hit = 1;
    if (att.maxDaze && att.brokenT <= 0) { att.daze = Math.min(att.maxDaze, att.daze + 45); if (att.daze >= att.maxDaze) { att.breakStart(f); return; } }
    if (att.act && !att.act.ult) { att.act.end && att.act.end(att, att.opp, G); att.act = null; att.trail.clear(); }
    att.state = 'hit'; att.stun = att.def.stats.armor ? 0.6 : 1.0; const d = new V3().subVectors(att.pos, f.pos).setY(0).normalize(); att.vel.set(d.x * 4, 0, d.z * 4);
  },
  onBreak(f, att) {
    G.stats.brk++; sfx('brk'); hud.pop('브레이크!', 'violet'); G.slow(0.4, 0.3); G.shake(0.25);
    const c = f.chest(); fx.burst(c, 40, [0xd08aff, 0xffffff], 12); fx.ring(c, { r0: 0.3, r1: 3.5 * f.scale, life: 0.5, color: 0xd08aff, billboard: true }); fx.light(c, 0xd08aff, 100, 0.4);
  },
  startCine(f) {
    G.cine = { f, t: 0, dur: 1.75, out: false }; hud.showCutin(f); sfx('ult'); G.flash(f.palette.accent, 0.35);
    fcam.stopCine(); f.pose.set(f.def._poses.portrait || f.def._poses.base); f.applyRig(1);
  },
  onKO(loser, att) {
    if (G.mode === 'training') return;
    if (isPvE()) {
      if (loser === G.player) {
        if (G.state === 'fight') { G.state = 'fail'; G.t = 0; G.slow(0.25, 1.2); sfx('ko'); hud.announce('패배', '', 'red', 2.4); fcam.setFocus(loser, { dist: 5.5, h: 1.8, spin: 0.35 }); }
      } else {
        G.stats.kills++; loser.goneT = 0; if (G.lock === loser) G.lock = null;
        if (loser.def.boss) { G.slow(0.2, 1.4); G.flash(0xffffff, 0.6); G.shake(0.4); sfx('ko'); hud.announce('격파!', loser.def.name, 'gold', 2.2); }
        else G.slow(0.6, 0.2);
      }
      return;
    }
    if (G.state !== 'fight') return;
    G.state = 'ko'; G.t = 0; G.winner = att; att.wins++; G.slow(0.25, 1.1); G.flash(0xffffff, 0.7); G.shake(0.3); sfx('ko');
    hud.announce('K.O.', '', 'red', 2.2); fcam.setFocus(loser, { dist: 5.5, h: 1.8, spin: 0.35 });
  },
});

function setMap(id) {
  if (id === G.mapId) return;
  stage.dispose(); stage = buildStage(scene, id); G.stage = stage; G.mapId = id;
}

/* ---------- 히트박스 보기 (훈련 5 · 어디서나 F3) ---------- */
const DBG_MAX = 12000, dbgPos = new Float32Array(DBG_MAX * 3), dbgCol = new Float32Array(DBG_MAX * 3);
const dbgGeo = new THREE.BufferGeometry(); dbgGeo.setAttribute('position', new THREE.BufferAttribute(dbgPos, 3).setUsage(THREE.DynamicDrawUsage)); dbgGeo.setAttribute('color', new THREE.BufferAttribute(dbgCol, 3).setUsage(THREE.DynamicDrawUsage));
const dbgLines = new THREE.LineSegments(dbgGeo, new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true, opacity: 0.9 }));
dbgLines.frustumCulled = false; dbgLines.renderOrder = 50; dbgLines.visible = false; scene.add(dbgLines);
function drawCapsules() {
  let n = 0; const c = new THREE.Color(), u = new V3(), v = new V3(), w = new V3(), p = new V3();
  const seg = (a, b) => { if (n + 2 > DBG_MAX) return; dbgPos.set([a.x, a.y, a.z, b.x, b.y, b.z], n * 3); dbgCol.set([c.r, c.g, c.b, c.r, c.g, c.b], n * 3); n += 2; };
  const cap = (a, b, r) => {
    w.subVectors(b, a); if (w.lengthSq() < 1e-6) w.set(0, 1, 0); w.normalize(); u.set(Math.abs(w.y) < 0.9 ? 0 : 1, Math.abs(w.y) < 0.9 ? 1 : 0, 0).cross(w).normalize(); v.crossVectors(w, u);
    for (const s of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const o = u.clone().multiplyScalar(s[0] * r).addScaledVector(v, s[1] * r); seg(a.clone().add(o), b.clone().add(o)); }
    for (const e of [a, b]) for (let i = 0; i < 12; i++) { const a0 = (i / 12) * Math.PI * 2, a1 = ((i + 1) / 12) * Math.PI * 2;
      seg(p.copy(e).addScaledVector(u, Math.cos(a0) * r).addScaledVector(v, Math.sin(a0) * r).clone(), e.clone().addScaledVector(u, Math.cos(a1) * r).addScaledVector(v, Math.sin(a1) * r)); }
  };
  for (const f of G.fighters) {
    if (f.gone) continue;
    c.set(f.inv > 0 ? 0x8888ff : 0x40ff70); for (const h of f.hurt) cap(h.a, h.b, h.r);
    if (f.state === 'act' && f.act.hits && f.hasW) { const live = f.act.hits.some((hb) => f.at >= hb.t0 && f.at <= hb.t1); c.set(live ? 0xff3030 : 0x806060); cap(f.wb, f.wt, 0.14 * f.scale); }
  }
  dbgGeo.setDrawRange(0, n); dbgGeo.attributes.position.needsUpdate = true; dbgGeo.attributes.color.needsUpdate = true;
}

/* ---------- 리사이즈 · 터치 · 포인터 잠금 ---------- */
function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  fx.setScale((h * renderer.getPixelRatio()) / (2 * Math.tan((camera.fov * Math.PI) / 360)));
}
addEventListener('resize', resize); resize();
const touch = $('#touch');
if (matchMedia('(pointer: coarse)').matches) touch.classList.add('on');
touch.querySelectorAll('button').forEach((b) => {
  const k = b.dataset.k;
  const on = (e) => { e.preventDefault(); audioInit(); if (!keys[k]) pressed[k] = true; keys[k] = true; b.classList.add('down'); };
  const off = (e) => { e.preventDefault(); keys[k] = false; b.classList.remove('down'); };
  b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off);
});
const freeCam = () => fcam.mode === 'free' && G.fighters.length > 0;
function lockPointer() { if (!freeCam() || document.pointerLockElement || G.paused) return; try { const r = canvas.requestPointerLock && canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* 잠금이 막힌 환경: 마우스 이동만으로 시점 회전 */ } }
canvas.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse' && (G.state === 'fight' || G.state === 'intro')) lockPointer(); });
let hadLock = false;
document.addEventListener('pointerlockchange', () => {
  const now = !!document.pointerLockElement;
  if (hadLock && !now && (G.state === 'fight' || G.state === 'intro') && !G.paused) setPause(true);
  hadLock = now;
});

/* ---------- 타이틀 / 선택 ---------- */
function buildSelect() {
  const pve = isPvE();
  for (const [id, slot] of [['#r1', 'p1'], ['#r2', 'p2']]) {
    const el = $(id), col = slot === 'p1' ? 'var(--p1)' : 'var(--p2)';
    el.innerHTML = ROSTER.map((d, i) => `<button class="card" data-slot="${slot}" data-i="${i}" style="--sel:${col}" aria-pressed="${G.sel[slot] === i}"><span class="tag">${slot === 'p1' ? '1P' : G.mode === 'pvp' ? '2P' : G.mode === 'training' ? '더미' : 'CPU'}</span><b>${d.short || d.name}</b><span>${d.title}</span></button>`).join('')
      + Array.from({ length: EMPTY_SLOTS }, () => '<div class="card empty"><b>?</b><span>추가 예정</span></div>').join('');
  }
  $('#r2wrap').hidden = pve;
  $('#r2lbl').textContent = G.mode === 'pvp' ? '2P 캐릭터' : G.mode === 'training' ? '훈련 상대' : 'CPU 캐릭터';
  $('#modeInfo').textContent = {
    boss: `공허의 기사 니힐과 1:1. 노란 예고는 패리(F), 빨간 예고는 회피(C). 체력이 절반 아래로 떨어지면 격노합니다.`,
    waves: `적 무리를 ${WAVES.length - 1}웨이브 처치하면 보스가 나타납니다. 파편병 · 사수 · 파쇄자(슈퍼아머)`,
    duel: 'CPU 캐릭터와 3판 2선승 결투', pvp: '한 키보드로 두 사람이 3판 2선승 (화면 분할)', training: '시간 제한 없이 기술과 판정을 확인',
  }[G.mode];
  document.querySelectorAll('#modes button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.mode === G.mode));
  const d = ROSTER[G.sel.p1];
  $('#charInfo').innerHTML = `<h3>${d.name}</h3><p>${d.desc}</p><dl class="mv">${d.moveList.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
  const k = (c) => `<kbd>${c}</kbd>`;
  $('#keyHelp').innerHTML = G.mode === 'pvp'
    ? `1P ${k('W')}${k('A')}${k('S')}${k('D')} 이동 · ${k('좌클')} 공격 · ${k('우클')} ${k('Shift')} ${k('E')} 스킬 · ${k('Q')} 궁극기 · ${k('Space')} 점프 · ${k('C')} 회피 · ${k('F')} 방어<br>2P 방향키 이동 · ${k('Num1')} 공격 · ${k('Num2')} ${k('Num4')} ${k('Num5')} 스킬 · ${k('Num6')} 궁극기 · ${k('Num0')} 점프 · ${k('Num.')} 회피 · ${k('Num3')} 방어`
    : `${k('마우스')} 시점 · ${k('W')}${k('A')}${k('S')}${k('D')} 이동 · ${k('좌클')} 공격(연타) · ${k('우클')} ${k('Shift')} ${k('E')} 스킬 · ${k('Q')} 궁극기<br>${k('C')} 회피(타이밍 = 극한 회피) · ${k('F')} 방어(타이밍 = 패리) · ${k('Space')} 점프 · ${k('Tab')}/${k('휠클릭')} 대상 고정 · ${k('Esc')} 일시정지`;
  rebuildPreview();
}
function rebuildPreview() {
  for (const f of G.preview) f.dispose(); G.preview = [];
  const d1 = ROSTER[G.sel.p1], pve = isPvE();
  const d2 = pve ? (G.mode === 'boss' ? ENEMIES.boss : ENEMIES.grunt) : ROSTER[G.sel.p2];
  const a = new Fighter(d1, 0, null, G, d1.palettes[0]), b = new Fighter(d2, 1, null, G, d1 === d2 ? d2.palettes[1] : d2.palettes[0]);
  a.reset(new V3(-1.3, 0, 0.6)); b.reset(new V3(pve ? 2 : 1.3, 0, pve ? -1.2 : -0.6)); a.opp = b; b.opp = a; a.state = 'win'; G.preview = [a, b];
}
document.addEventListener('click', (e) => {
  const t = e.target.closest('button'); if (!t) return; audioInit();
  if (t.dataset.mode) { G.mode = t.dataset.mode; sfx('ui'); buildSelect(); }
  else if (t.dataset.slot) { G.sel[t.dataset.slot] = +t.dataset.i; sfx('ui'); buildSelect(); }
  else if (t.id === 'start') startMatch();
  else if (t.dataset.act === 'resume') { setPause(false); lockPointer(); }
  else if (t.dataset.act === 'title') toTitle();
  else if (t.dataset.act === 'rematch') startMatch();
});
function showScreen(id) { for (const s of ['#title', '#pause', '#result']) $(s).hidden = s !== id; }
function toTitle() {
  G.paused = false; clearMatch(); G.state = 'title'; fcam.mode = 'orbit'; fcam.focus = null; fcam.cine = null; fcam.follow = fcam2.follow = null; hud.show(false); hud.hideCutin(); hud.setTraining('');
  if (document.pointerLockElement) document.exitPointerLock(); showScreen('#title'); buildSelect();
}
function setPause(p) {
  G.paused = p; $('#pause').hidden = !p;
  if (p && document.pointerLockElement) document.exitPointerLock();
  $('#pauseKeys').innerHTML = G.mode === 'training' ? '훈련 모드 단축키: <kbd>1</kbd> 궁극기 충전 · <kbd>2</kbd> 쿨타임 초기화 · <kbd>3</kbd> 체력 회복 · <kbd>4</kbd> 더미 행동 변경 · <kbd>5</kbd> 히트박스' : '<kbd>Esc</kbd> 또는 <kbd>P</kbd> 로 계속하기 · <kbd>M</kbd> 소리 켜기/끄기';
}

/* ---------- 경기 ---------- */
function clearMatch() {
  for (const f of G.fighters) f.dispose(); G.fighters = []; G.player = null; G.boss = null; G.lock = null;
  for (const e of G.ents) e.kill && e.kill(); G.ents = []; fx.clear(); G.cine = null; G.setTint(0, 0);
}
function startMatch() {
  sfx('ult'); for (const f of G.preview) f.dispose(); G.preview = []; clearMatch();
  // 게임을 시작할 때마다 맵을 무작위로 정한다 (직전 맵은 제외)
  const pool = STAGES.filter((m) => m.id !== G.mapId); setMap(pool[(Math.random() * pool.length) | 0].id);
  const d1 = ROSTER[G.sel.p1], d2 = ROSTER[G.sel.p2];
  const a = new Fighter(d1, 0, new KeyCtrl(G.mode === 'pvp' ? MAPS.p1 : MAPS.p1solo), G, d1.palettes[0]);
  G.fighters = [a]; G.player = a; G.round = 1;
  if (!isPvE()) {
    const c2 = G.mode === 'pvp' ? new KeyCtrl(MAPS.p2) : G.mode === 'training' ? new DummyCtrl() : new AICtrl();
    const b = new Fighter(d2, 1, c2, G, d1 === d2 ? d2.palettes[1] : d2.palettes[0]); a.opp = b; b.opp = a; G.fighters.push(b);
  }
  G.stats = { combo: 0, dodge: 0, parry: 0, brk: 0, kills: 0, t: 0 };
  showScreen(null); hud.show(true);
  fcam.mode = G.mode === 'pvp' ? 'fight' : 'free'; fcam2.mode = 'fight'; fcam.follow = a; fcam2.follow = G.fighters[1] || null; fcam.cyaw = fcam2.cyaw = null; fcam.fy = null;
  startRound();
}
function startRound() {
  for (const e of G.ents) e.kill && e.kill(); G.ents = []; fx.clear();
  G.cine = null; G.t = 0; G.timer = 99; G.winner = null; G.timeout = false; G.ts = G.tsT = 1; G.tsHold = 0; G.hitstop = 0; G.foeScale = 1; G.foeSlowT = 0; G.setTint(0, 0);
  fcam.focus = null; fcam.cine = null; fcam.cyaw = fcam2.cyaw = null; hud.hideCutin();
  const a = G.player;
  if (isPvE()) {
    for (const f of G.fighters.slice(1)) f.dispose(); G.fighters = [a]; G.boss = null; G.lock = null; a.opp = null;
    a.reset(new V3(0, 0, -8)); a.yaw = 0; fcam.fy = 0; G.wave = 0; G.waveCount = WAVES.length; G.waveClearT = 0; hud.setup(G);
    spawnWave(); G.state = 'intro';
    hud.announce(G.mode === 'boss' ? '보스전' : '토벌 개시', stage.def.name, '', 1.8);
    return;
  }
  const b = G.fighters[1]; a.reset(new V3(-4, 0, 0)); b.reset(new V3(4, 0, 0)); fcam.fy = Math.PI / 2; hud.setup(G);
  if (G.mode === 'training') { G.state = 'fight'; hud.announce('훈련 시작', stage.def.name, 'gold', 1.4); updateTrainBar(); }
  else { G.state = 'intro'; hud.announce(G.round >= 3 ? '최종 라운드' : `ROUND ${G.round}`, G.round === 1 ? stage.def.name : '', '', G.round === 1 ? 1.6 : 1.1); }
}
// 적 생성: 플레이어 맞은편 결투장 안쪽 빈 자리
function spawnWave() {
  const list = G.mode === 'boss' ? ['boss'] : WAVES[G.wave], W = stage.world, p = G.player;
  list.forEach((id, i) => {
    const def = ENEMIES[id], a = (i - (list.length - 1) / 2) * 0.55, R = def.boss ? 9 : 10 + rand(-1.5, 2);
    const pos = new V3(Math.sin(a) * R, 0, Math.cos(a) * R * (p.pos.z < 0 ? 1 : -1)); for (let k = 0; k < 3; k++) W.push(pos, 0.6 * (def.scale || 1));
    const f = new Fighter(def, 1, new EnemyAI(), G, def.palettes[0]); f.reset(pos); f.opp = p; f.faceOpp(); f.inv = 0.8; f.ai = f.ctrl;
    G.fighters.push(f); if (def.boss) G.boss = f;
    const c = pos.clone().setY(0.05), col = def.palettes[0].accent;
    fx.ring(c, { normal: UP, r0: 0.3, r1: 2.6 * f.scale, life: 0.7, color: col }); fx.beam(c, { r: 0.8 * f.scale, h: 6, color: col, life: 0.6 }); fx.burst(c.clone().setY(1), 24, [col, 0xffffff], 6);
  });
  sfx('spawn'); hud.setWave(G);
  if (G.boss && G.mode === 'waves') hud.announce('보스 등장', G.boss.def.name, 'red', 2);
}
function updateTrainBar() {
  const d = G.fighters[1].ctrl;
  hud.setTraining(`<kbd>1</kbd> 궁극기 충전 · <kbd>2</kbd> 쿨타임 초기화 · <kbd>3</kbd> 체력 회복 · <kbd>4</kbd> 더미: <b>${DUMMY_LABEL[d.mode]}</b> · <kbd>5</kbd> 히트박스 보기`);
}
function timeUp() {
  const [a, b] = G.fighters; G.state = 'ko'; G.t = 0; G.timeout = true;
  G.winner = Math.abs(a.hp - b.hp) < 1 ? null : a.hp > b.hp ? a : b; if (G.winner) G.winner.wins++;
  hud.announce('TIME OVER', G.winner ? '' : '무승부', 'red', 2.2);
}
const fmtT = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
function showResult(title, sub) {
  $('#resSub').textContent = sub; $('#resTitle').textContent = title;
  const S = G.stats;
  $('#resScore').innerHTML = isPvE()
    ? `시간 <b>${fmtT(S.t)}</b> · 최대 콤보 <b>${S.combo}</b> · 처치 <b>${S.kills}</b> · 극한 회피 <b>${S.dodge}</b> · 패리 <b>${S.parry}</b> · 브레이크 <b>${S.brk}</b>`
    : `${G.player.def.short}  ·  ${G.fighters[0].wins} : ${G.fighters[1].wins}`;
  if (document.pointerLockElement) document.exitPointerLock();
  setTimeout(() => { if (G.state === 'over') showScreen('#result'); }, 1200);
}
function endRoundCheck() {
  const champ = G.fighters.find((f) => f.wins >= 2);
  if (champ) {
    G.state = 'over'; G.t = 0; champ.state = 'win'; champ.inv = 99; fcam.setFocus(champ, { dist: 4.2, h: 1.5, spin: 0.15, yaw: champ.yaw });
    showResult(`${champ.slot ? (G.mode === 'duel' ? 'CPU' : '2P') : '1P'} 승리`, champ.def.title);
  } else { G.round++; startRound(); }
}
// 플레이어의 공격 대상: 고정 대상 → 카메라 앞쪽의 가까운 적
function pickTarget(p) {
  if (G.lock && (G.lock.state === 'ko' || G.lock.gone)) G.lock = null;
  if (G.lock) return G.lock;
  const cf = G.camFwd; let best = null, bs = 1e9;
  for (const o of G.foesOf(p)) {
    const dx = o.pos.x - p.pos.x, dz = o.pos.z - p.pos.z, d = Math.hypot(dx, dz) || 0.01; if (d > 22) continue;
    const dot = (dx * cf.x + dz * cf.z) / d, s = d * (1.7 - dot);
    if (s < bs) { bs = s; best = o; }
  }
  return best || (p.opp && p.opp.state !== 'ko' && !p.opp.gone ? p.opp : null);
}

/* ---------- 업데이트 ---------- */
const tmpV = new V3();
function update(rdt) {
  G.rdt = rdt; G.time += rdt;
  camera.getWorldDirection(tmpV); tmpV.y = 0; tmpV.normalize(); G.camFwd = { x: tmpV.x, z: tmpV.z };
  if (pressed.KeyM) setMuted(!isMuted());
  if (pressed.F3) G.showHit = !G.showHit;
  stage.update(rdt, G.time);
  mouse.active = freeCam() && (G.state === 'fight' || G.state === 'intro') && !G.paused;
  if (G.state === 'title') {
    if (pressed.Enter) startMatch();
    if (pressed.Tab) { const m = Object.keys(MODE_NAME); G.mode = m[(m.indexOf(G.mode) + 1) % m.length]; buildSelect(); }
    for (const f of G.preview) f.update(rdt, false);
    fx.update(rdt, camera); fcam.update(rdt, { fighters: [] }); mouse.dx = mouse.dy = 0; return;
  }
  if ((pressed.Escape || pressed.KeyP) && (G.state === 'fight' || G.state === 'intro' || G.paused)) setPause(!G.paused);
  if (G.paused) { mouse.dx = mouse.dy = 0; return; }
  if (G.state === 'over' && G.t > 1.2 && pressed.Enter) return startMatch();
  if (G.state === 'over' && pressed.Escape) return toTitle();
  const a = G.player, pve = isPvE();
  if (a && G.mode !== 'pvp') a.opp = pickTarget(a);
  for (const f of G.fighters) f.read();
  // 훈련 단축키
  if (G.mode === 'training') {
    const b = G.fighters[1];
    if (pressed.Digit1) a.energy = b.energy = 100;
    if (pressed.Digit2) for (const f of [a, b]) for (const k in f.cd) f.cd[k] = 0;
    if (pressed.Digit3) { a.hp = a.dispHp = a.maxHp; b.hp = b.dispHp = b.maxHp; }
    if (pressed.Digit4) { b.ctrl.cycle(); updateTrainBar(); }
    if (pressed.Digit5) G.showHit = !G.showHit;
    for (const f of G.fighters) if (f.lastHitT > 1.6 && f.state !== 'hit') f.hp = Math.min(f.maxHp, f.hp + rdt * 500);
  }
  // 시간 배율 · 화면 색조 · 극한 회피 슬로우
  if (G.tsHold > 0) G.tsHold -= rdt; else G.tsT = 1;
  G.ts = damp(G.ts, G.tsT, 6, rdt);
  if (G.tintT > 0) { G.tintT -= rdt; if (G.tintT <= 0) G.tint = { c: G.tint.c, a: 0 }; }
  G.tintA = damp(G.tintA, G.tint.a, 4, rdt); stage.setTint(G.tint.c, G.tintA);
  G.foeSlowT -= rdt;
  const ultOn = a && a.state === 'act' && a.act.ult;
  G.foeScale = damp(G.foeScale, G.foeSlowT > 0 ? 0.12 : ultOn && pve ? 0.05 : 1, G.foeSlowT > 0 ? 20 : 6, rdt);
  const dt = rdt * G.ts;
  if (G.cine) {
    const C = G.cine; C.t += rdt;
    if (C.t > C.dur - 0.22 && !C.out) { C.out = true; hud.outCutin(); }
    if (C.t >= C.dur) { G.cine = null; hud.hideCutin(); G.flash(0xffffff, 0.6); G.shake(0.15); fcam.playCine(C.f, C.f.act && C.f.act.cam); }
    camUpdate(rdt); hud.update(G, rdt); return;
  }
  if (G.hitstop > 0) { G.hitstop -= rdt; fx.update(dt * 0.1, camera); camUpdate(rdt); hud.update(G, rdt); return; }
  G.t += dt;
  if (G.state === 'intro' && G.t > 1.15 && !G.fightShown) { G.fightShown = true; hud.announce(pve ? '전투 개시' : 'FIGHT!', '', 'gold', 0.9); }
  if (G.state === 'intro' && G.t > 1.9) { G.state = 'fight'; G.t = 0; G.fightShown = false; }
  const live = G.state === 'fight';
  if (live && !pve && G.mode !== 'training') { G.timer -= dt; if (G.timer <= 0) { G.timer = 0; timeUp(); } }
  if (live && pve) G.stats.t += dt;
  if (G.stats && a) G.stats.combo = Math.max(G.stats.combo, a.combo);
  if (G.state === 'ko') {
    if (G.t > 1.8 && G.winner && !['act', 'win', 'ko', 'hit', 'down'].includes(G.winner.state)) { G.winner.state = 'win'; G.winner.inv = 99; }
    if (G.t > 1.4 && G.winner && !G.winSub) { G.winSub = true; hud.announce(`${G.winner.slot ? (G.mode === 'duel' ? 'CPU' : '2P') : '1P'} 라운드 승리`, '', 'gold', 1.6); }
    if (G.t > 4) { G.winSub = false; endRoundCheck(); }
  }
  // PvE 진행: 웨이브 정리 → 다음 웨이브 / 클리어 · 패배 · 보스 격노
  if (pve) {
    if (live && !G.foesOf(a).length) {
      if (!G.waveClearT) { G.waveClearT = 1.8; if (G.mode === 'waves' && G.wave < WAVES.length - 1) hud.pop(`WAVE ${G.wave + 1} 클리어`, 'gold'); }
      G.waveClearT -= dt;
      if (G.waveClearT <= 0) {
        G.waveClearT = 0;
        if (G.mode === 'waves' && G.wave < WAVES.length - 1) { G.wave++; spawnWave(); hud.announce(G.wave === WAVES.length - 1 ? '최종 웨이브' : `WAVE ${G.wave + 1}`, '', '', 1.2); }
        else { G.state = 'clear'; G.t = 0; a.state = 'win'; a.inv = 99; fcam.setFocus(a, { dist: 4.2, h: 1.5, spin: 0.15, yaw: a.yaw }); hud.announce(G.mode === 'boss' ? '보스 격파' : '토벌 완료', fmtT(G.stats.t), 'gold', 2.4); }
      }
    }
    const B = G.boss;
    if (B && !B.enraged && B.state !== 'ko' && B.hp < B.maxHp * 0.5) { B.enraged = true; hud.announce('격노', `${B.def.short} 2페이즈`, 'red', 1.6); G.setTint(B.palette.accent, 0.3); sfx('teleRed'); G.shake(0.3); }
    if (G.state === 'clear' && G.t > 2.6) { G.state = 'over'; G.t = 0; showResult(G.mode === 'boss' ? '보스 격파' : '토벌 완료', `${MODE_NAME[G.mode]} · ${stage.def.name}`); }
    if (G.state === 'fail' && G.t > 2.6) { G.state = 'over'; G.t = 0; showResult('패배', `${MODE_NAME[G.mode]} · ${stage.def.name}`); }
  }
  for (const f of G.fighters) f.update(dt * (f.team === 1 ? G.foeScale : 1), live || (!pve && G.state === 'ko' && f.state === 'act'));
  // 쓰러진 적 사라짐
  for (let i = G.fighters.length - 1; i >= 1; i--) {
    const f = G.fighters[i]; if (!pve || f.state !== 'ko') continue;
    f.goneT += dt;
    if (f.goneT > 1.1 && !f.gone) { f.gone = true; fx.burst(f.chest(), 40, [f.palette.accent, 0x000000], 5, { kind: 'glow', sk: 0.8 * f.scale }); fx.burst(f.chest(), 24, f.palette.accent, 4, { kind: 'ember' }); }
    if (f.gone) { f.root.scale.multiplyScalar(Math.exp(-dt * 6)); if (f.goneT > 1.6) { f.dispose(); G.fighters.splice(i, 1); if (G.boss === f) G.boss = null; hud.setWave(G); } }
  }
  // 몸 겹침 방지 (모든 쌍)
  const F = G.fighters;
  for (let i = 0; i < F.length; i++) for (let j = i + 1; j < F.length; j++) {
    const p = F[i], q = F[j]; if (p.held || q.held || p.state === 'ko' || q.state === 'ko' || Math.abs(p.pos.y - q.pos.y) > 1.4) continue;
    const dx = q.pos.x - p.pos.x, dz = q.pos.z - p.pos.z, d = Math.hypot(dx, dz), ov = 0.45 * (p.scale + q.scale) - d;
    if (ov > 0) { const nx = d > 1e-4 ? dx / d : 1, nz = d > 1e-4 ? dz / d : 0, wp = q.scale / (p.scale + q.scale); p.pos.x -= nx * ov * wp; p.pos.z -= nz * ov * wp; q.pos.x += nx * ov * (1 - wp); q.pos.z += nz * ov * (1 - wp); }
  }
  for (let i = G.ents.length - 1; i >= 0; i--) { const e = G.ents[i]; e.update(dt * (e.owner && e.owner.team === 1 ? G.foeScale : 1)); if (e.done) G.ents.splice(i, 1); }
  fx.update(dt, camera); camUpdate(rdt); hud.update(G, rdt);
}
function camUpdate(rdt) { fcam.update(rdt, G); if (G.mode === 'pvp') fcam2.update(rdt, G); mouse.dx = mouse.dy = 0; fadeOccluders(rdt); }
// 카메라와 캐릭터 사이를 가리는 장애물은 반투명하게
const ray = new THREE.Raycaster(), rv = new V3(), rd = new V3();
function fadeOccluders(rdt) {
  const occ = stage.world.occ; if (!occ.length) return;
  for (const m of occ) m.userData.want = 1;
  if (G.player && G.state !== 'title') for (const v of G.views()) for (const f of [G.player, G.player.opp, G.mode === 'pvp' ? G.fighters[1] : null]) {
    if (!f || f.gone) continue;
    v.cam.getWorldPosition(rv); rd.copy(f.chest(new V3())).sub(rv); const len = rd.length(); rd.normalize();
    ray.set(rv, rd); ray.far = len - 0.3; for (const h of ray.intersectObjects(occ, false)) h.object.userData.want = 0.22;
  }
  for (const m of occ) {
    const u = m.userData, f = (u.fade = damp(u.fade ?? 1, u.want, 10, rdt)), mt = m.material, tr = f < 0.98;
    mt.opacity = f; if (mt.transparent !== tr) { mt.transparent = tr; mt.depthWrite = !tr; mt.needsUpdate = true; }
  }
}

/* ---------- 렌더 (+ 궁극기 초상 패스) ---------- */
const bandColor = new THREE.Color();
function render() {
  dbgLines.visible = !!G.showHit && G.fighters.length > 0 && G.state !== 'title'; if (dbgLines.visible) drawCapsules();
  camFill.position.copy(camera.position).add(new V3(0, 3, 0)); camFill.target.position.copy(fcam.look);
  // 그림자 범위: 살아 있는 캐릭터들을 감싸도록
  if (stage.shadowFollow) {
    const fs = G.fighters.filter((f) => !f.gone); let ext = 12;
    if (fs.length) { tmpV.set(0, 0, 0); for (const f of fs) tmpV.add(f.pos); tmpV.divideScalar(fs.length); for (const f of fs) ext = Math.max(ext, Math.hypot(f.pos.x - tmpV.x, f.pos.z - tmpV.z) + 7); }
    else tmpV.copy(fcam.look);
    stage.shadowFollow(tmpV, ext);
  }
  const views = G.views(), split = views.length > 1;
  renderer.setScissorTest(split);
  for (const v of views) {
    const asp = v.w / v.h; if (Math.abs(v.cam.aspect - asp) > 1e-3) { v.cam.aspect = asp; v.cam.updateProjectionMatrix(); }
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
  const hidden = [stage.group, ...G.fighters.filter((o) => o !== f).flatMap((o) => [o.root, ...(o.model.extras || [])])], vis = hidden.map((o) => o.visible);
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
window.__setMap = (id) => setMap(id);
window.__tick = (n, dt = 1 / 60) => { for (let i = 0; i < n; i++) { update(dt); endFrame(); } };
buildSelect(); fcam.snap(); requestAnimationFrame(frame);
