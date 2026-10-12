// 파이터 시스템: 상태 머신 · 기술 실행 · 피격 판정 · 방어 · 다운 · 궁극기 연결
import * as THREE from 'three';
import { clamp, lerp, damp, rand, angDelta, angLerp, ease, sfx } from './core.js';
import { POSE_LEN, applyPose, lerpPose, addRunCycle, prepareDef } from './rig.js';
import { ARENA_R } from './stage.js';
import { PLUNGE_MIN_H } from './plunge.js';

const V3 = THREE.Vector3;
export const GRAV = 26;
// 피격 판정: 매 프레임 골격 관절 위치로 만든 캡슐들 (몸 크기·자세를 그대로 따라감)
// [시작 관절, 끝 관절(또는 'headTop'), 반경 배율(어깨 폭 기준)]
const HURT_PARTS = [['hips', 'neck', 0.95], ['neck', 'headTop', 0.72], ['shoulderL', 'elbowL', 0.36], ['elbowL', 'handL', 0.33], ['shoulderR', 'elbowR', 0.36], ['elbowR', 'handR', 0.33],
  ['hipL', 'kneeL', 0.45], ['kneeL', 'footL', 0.4], ['hipR', 'kneeR', 0.45], ['kneeR', 'footR', 0.4]];
const tA = new V3(), tB = new V3(), tC = new V3(), tD = new V3();
let UID = 0;
const PERFECT_DODGE = 0.2, PERFECT_PARRY = 0.22; // 회피·방어 입력 직후 이 시간 안에 맞으면 극한 회피 · 패리

// 선분과 선분 사이 최단 거리
function segSegDist(p1, q1, p2, q2) {
  const d1x = q1.x - p1.x, d1y = q1.y - p1.y, d1z = q1.z - p1.z, d2x = q2.x - p2.x, d2y = q2.y - p2.y, d2z = q2.z - p2.z, rx = p1.x - p2.x, ry = p1.y - p2.y, rz = p1.z - p2.z;
  const a = d1x * d1x + d1y * d1y + d1z * d1z, e = d2x * d2x + d2y * d2y + d2z * d2z, f = d2x * rx + d2y * ry + d2z * rz;
  let s, t;
  if (a < 1e-8 && e < 1e-8) { s = t = 0; }
  else if (a < 1e-8) { s = 0; t = clamp(f / e, 0, 1); }
  else {
    const c = d1x * rx + d1y * ry + d1z * rz;
    if (e < 1e-8) { t = 0; s = clamp(-c / a, 0, 1); }
    else { const b = d1x * d2x + d1y * d2y + d1z * d2z, den = a * e - b * b; s = den > 1e-8 ? clamp((b * f - c * e) / den, 0, 1) : 0; t = (b * s + f) / e;
      if (t < 0) { t = 0; s = clamp(-c / a, 0, 1); } else if (t > 1) { t = 1; s = clamp((b - c) / a, 0, 1); } }
  }
  const x = p1.x + d1x * s - (p2.x + d2x * t), y = p1.y + d1y * s - (p2.y + d2y * t), z = p1.z + d1z * s - (p2.z + d2z * t);
  return Math.sqrt(x * x + y * y + z * z);
}
// 점과 선분 사이 거리
function segDist(p, a, b) {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z, l2 = abx * abx + aby * aby + abz * abz;
  let t = l2 ? ((p.x - a.x) * abx + (p.y - a.y) * aby + (p.z - a.z) * abz) / l2 : 0; t = clamp(t, 0, 1);
  const x = a.x + abx * t - p.x, y = a.y + aby * t - p.y, z = a.z + abz * t - p.z; return Math.sqrt(x * x + y * y + z * z);
}

export class Fighter {
  constructor(def, slot, ctrl, G, palette) {
    this.def = prepareDef(def); this.slot = slot; this.ctrl = ctrl; this.G = G; this.palette = palette; this.id = ++UID; this.team = slot ? 1 : 0;
    this.model = def.createModel(palette); this.root = this.model.root; G.scene.add(this.root);
    if (this.model.attachScene) this.model.attachScene(G.scene);
    this.scale = def.scale || 1; this.root.scale.setScalar(this.scale); this.maxDaze = def.stats.daze || 0;
    this.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.pos = this.root.position; this.vel = new V3();
    this.pose = new Float32Array(POSE_LEN); this.tgt = new Float32Array(POSE_LEN);
    this.trail = G.fx.makeTrail(palette.accent); this.shield = G.fx.makeShield(palette.accent);
    this.maxHp = def.stats.hp; this.wins = 0; this.energy = 0;
    this.wb = new V3(); this.wt = new V3(); this.pwb = new V3(); this.pwt = new V3(); this.hasW = false;
    this.hurt = HURT_PARTS.map(() => ({ a: new V3(), b: new V3(), r: 0.1 }));
    this.reset(new V3(slot ? 4 : -4, 0, 0));
  }
  dispose() {
    this.model.dispose && this.model.dispose(this.G.scene);
    this.G.scene.remove(this.root); this.G.scene.remove(this.trail.mesh); this.G.scene.remove(this.shield.m);
    this.G.fx.trails.splice(this.G.fx.trails.indexOf(this.trail), 1); this.G.fx.shields.splice(this.G.fx.shields.indexOf(this.shield), 1);
  }
  reset(p) {
    this.pos.copy(p); this.vel.set(0, 0, 0); this.yaw = Math.atan2(-p.x, -p.z);
    this.hp = this.dispHp = this.maxHp; this.chipT = 0; this.state = 'idle'; this.act = null; this.at = 0; this.stun = 0; this.inv = 0;
    this.buf = null; this.jumpBuf = 0; this.cd = { heavy: 0, s1: 0, s2: 0 }; this.combo = 0; this.comboT = 0; this.held = false; this.float = false;
    this.launched = false; this.downT = 0; this.dashT = 0; this.dashCd = 0; this.blockStun = 0; this.flashT = 0; this.hitConfirm = false;
    this.onGround = true; this.runP = 0; this.groundOff = 0; this.lastHitT = 9; this.I = { mx: 0, mz: 0, guard: false };
    this.daze = 0; this.brokenT = 0; this.counterT = 0; this.dodgeT = -9; this.guardT0 = -9; this.gone = false; this.goneT = 0;
    this.pose.set(this.def._poses.base); this.root.visible = true; this.trail.clear(); this.ghostT = 0;
    this.root.rotation.y = this.yaw; this.applyRig(1 / 60); this.hasW = false; this.updateHurt();
  }
  /* ----- 좌표 헬퍼 ----- */
  fwd(out = new V3()) { return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
  right(out = new V3()) { return out.set(-Math.cos(this.yaw), 0, Math.sin(this.yaw)); }
  // [오른쪽, 위, 앞] (m) → 월드 좌표
  local(o, out = new V3()) {
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    return out.set(this.pos.x - c * o[0] + s * o[2], this.pos.y + o[1], this.pos.z + s * o[0] + c * o[2]);
  }
  chest(out = new V3()) { return out.set(this.pos.x, this.pos.y + 1.15, this.pos.z); }
  yawTo(p) { return Math.atan2(p.x - this.pos.x, p.z - this.pos.z); }
  // dt 생략 시 즉시 상대를 바라본다
  faceOpp(rate, dt) { const o = this.opp; if (!o) return; const y = this.yawTo(o.pos); this.yaw = dt === undefined ? y : angLerp(this.yaw, y, 1 - Math.exp(-rate * dt)); }
  dist() { return this.opp ? Math.hypot(this.opp.pos.x - this.pos.x, this.opp.pos.z - this.pos.z) : 99; }
  // 공격이 닿을 수 있는 상대 목록 (다수 적 지원)
  foes() { return this.G.foesOf ? this.G.foesOf(this) : this.opp ? [this.opp] : []; }
  // 골격에서 피격 캡슐 갱신 (applyRig 뒤에 호출)
  updateHurt() {
    const J = this.model.J, k = (this.def.hurtScale || 1) * this.model.dims.shW * this.scale;
    HURT_PARTS.forEach(([ja, jb, rr], i) => {
      const h = this.hurt[i]; J[ja].getWorldPosition(h.a);
      if (jb === 'headTop') J.head.localToWorld(h.b.set(0, this.model.dims.headTop ?? 0.2, 0)); else J[jb].getWorldPosition(h.b);
      h.r = rr * k;
    });
  }
  // 구(중심 p, 반경 r)가 몸에 닿는가
  hurtHit(p, r) { for (const h of this.hurt) if (segDist(p, h.a, h.b) <= r + h.r) return true; return false; }
  // 칼날 궤적 판정: 직전 프레임 → 지금 사이를 칼날 길이에 맞춰 여러 단계로 나눠 검사 (빠른 휘두르기도 놓치지 않음)
  sweepHit(t, br) {
    const n = Math.min(8, 1 + Math.ceil(this.pwt.distanceTo(this.wt) / 0.35));
    for (let k = 0; k <= n; k++) { const u = k / n; tC.lerpVectors(this.pwb, this.wb, u); tD.lerpVectors(this.pwt, this.wt, u); if (t.hurtHitSeg(tC, tD, br)) return true; }
    return false;
  }
  // 캡슐(선분 a-b, 반경 r)이 몸에 닿는가
  hurtHitSeg(a, b, r) { for (const h of this.hurt) if (segSegDist(a, b, h.a, h.b) <= r + h.r) return true; return false; }
  /* ----- 이펙트 헬퍼 (기술 정의에서 사용) ----- */
  // tilt: 0 = 수평 베기, π/2 = 수직 베기 / at: [오른쪽, 위, 앞]
  slashFx(o = {}) {
    const f = this.fwd(new V3()), r = this.right(new V3()), t = o.tilt || 0;
    const n = new V3(0, 1, 0).multiplyScalar(Math.cos(t)).addScaledVector(r, Math.sin(t));
    this.G.fx.slash(this.local(o.at || [0, 1.15, 0.35]), { fwd: f, normal: n, r: o.r || 1.3, color: o.color ?? this.palette.accent, life: o.life || 0.22, flip: o.flip });
  }
  /* ----- 입력 ----- */
  read() {
    if (!this.ctrl) return;
    const inp = this.ctrl.read(this.G, this); this.I = inp;
    if (inp.press) this.buf = { a: inp.press, t: 0.25 };
    if (inp.jumpP) this.jumpBuf = 0.15;
    if (inp.lockP && this.G.toggleLock) this.G.toggleLock(this);
  }
  canAct(a) {
    // 무기를 던져 손이 비었으면 공격 불가 (회피·점프는 가능)
    if (this.model.weaponOut && a !== 'dash') return false;
    if (a === 'ult') return this.energy >= 100 && !!this.opp;
    if (this.def.skills[a] && this.def.skills[a].cd) return (this.cd[a] || 0) <= 0;
    if (a === 'dash') return this.dashCd <= 0 && this.onGround;
    return true;
  }
  tryAction(a) {
    if (!this.canAct(a)) return false;
    if (a === 'dash') {
      // 회피: 입력 방향으로, 입력이 없으면 뒤로 물러난다. 시작 직후 맞으면 극한 회피
      const m = Math.hypot(this.I.mx, this.I.mz), back = m <= 0.2, d = back ? this.fwd(new V3()).negate() : new V3(this.I.mx / m, 0, this.I.mz / m);
      this.state = 'dash'; this.dashT = 0.26; this.dashCd = 0.45; this.vel.set(d.x * 16, 0, d.z * 16); this.inv = 0.3; this.dodgeT = this.G.time; if (!back) this.yaw = Math.atan2(d.x, d.z);
      this.G.fx.burst(this.pos.clone().setY(0.1), 10, 0x8a7a90, 3, { kind: 'dust' }); sfx('dash'); return true;
    }
    if (!this.onGround && a !== 'light' && a !== 'heavy' && a !== 'ult') return false;
    if (a === 'light' && this.counterT > 0 && this.def.moves.counter) { this.counterT = 0; this.start('counter'); return true; }
    // 공중 좌클릭 = 낙하 공격 (충분히 높이 떠 있을 때)
    if (a === 'light' && !this.onGround && this.def.moves.plunge && this.pos.y - (this.gy || 0) > PLUNGE_MIN_H && this.state !== 'act') { this.start('plunge'); return true; }
    this.start(a === 'light' ? 'light1' : a); return true;
  }
  start(name) {
    const m = this.def.moves[name]; if (!m) return;
    if (m.cd) this.cd[m.cd] = this.def.skills[m.cd].cd;
    if (this.act && this.act.end) this.act.end(this, this.opp, this.G);
    this.act = m; this.actName = name; this.at = 0; this.state = 'act'; this.wJump = true; this.evDone = 0; this.hitDone = new Set(); this.hitConfirm = false; this.trail.clear(); this.teleDone = false;
    // 자동 조준: 가까운 대상이 있으면 그쪽을 본다
    if (m.aim !== false && this.opp && (this.team === 1 || this.dist() < 10)) this.faceOpp();
    m.start && m.start(this, this.opp, this.G);
    if (m.ult) { this.energy = 0; this.inv = 99; this.G.startCine(this); }
  }
  endAct() {
    const m = this.act; this.act = null; this.trail.clear(); this.state = this.onGround ? 'idle' : 'jump';
    m && m.end && m.end(this, this.opp, this.G);
    if (this.inv > 5) this.inv = 0.25;
  }
  breakStart(att) {
    const G = this.G; this.brokenT = this.def.stats.breakTime ?? 4; this.daze = this.maxDaze;
    if (this.act && this.act.end) this.act.end(this, this.opp, G);
    this.act = null; this.trail.clear(); this.state = 'hit'; this.stun = this.brokenT;
    G.onBreak && G.onBreak(this, att);
  }
  lock() { // 궁극기 연출용 고정
    if (this.act && this.act.end) this.act.end(this, this.opp, this.G);
    this.held = true; this.act = null; this.state = 'hit'; this.stun = 99; this.vel.set(0, 0, 0); this.trail.clear(); this.launched = false;
  }
  release() { this.held = false; }
  /* ----- 피격 ----- */
  takeHit(att, h, dirIn) {
    if (this.state === 'ko' || this.gone || (att.team === this.team && !h.force)) return false;
    const G = this.G;
    // 극한 회피: 회피 시작 직후에 맞을 공격이었다
    if (this.state === 'dash' && G.time - this.dodgeT < PERFECT_DODGE && !h.force) { G.onPerfectDodge && G.onPerfectDodge(this, att); this.dodgeT = -9; return false; }
    if (this.inv > 0 && !h.force) return false;
    const dir = (dirIn ? dirIn.clone() : tC.subVectors(this.pos, att.pos)).setY(0);
    if (dir.lengthSq() < 1e-6) att.fwd(dir); dir.normalize();
    const point = this.chest(new V3()).addScaledVector(dir, -0.35);
    // 방어: 정면 공격만 막는다
    const toAtt = tD.subVectors(att.pos, this.pos).setY(0).normalize(), facing = this.fwd(new V3()).dot(toAtt);
    // 패리: 방어를 누른 직후에 막았다 (붉은 공격은 막을 수 없음)
    if (this.state === 'guard' && !h.unblock && !h.force && facing > 0.2 && this.onGround && G.time - this.guardT0 < PERFECT_PARRY && G.onParry) { G.onParry(this, att, h, point); return 'parry'; }
    if (this.state === 'guard' && !h.unblock && !h.force && facing > 0.2 && this.onGround) {
      this.hp = Math.max(1, this.hp - h.dmg * 0.12); this.chipT = 0.5; this.blockStun = 0.22;
      this.vel.addScaledVector(dir, Math.max(3, (h.kb ? h.kb[0] : 2) * 0.8));
      this.energy = Math.min(100, this.energy + 3); att.energy = Math.min(100, att.energy + 1.5);
      G.fx.burst(point, 14, [0xffffff, this.palette.accent], 7, { dir: dir.clone().negate(), spread: 0.9 }); this.shield.hit = 1;
      G.hitstop = Math.max(G.hitstop, 0.05); G.shake(0.06); sfx('block'); G.hud.damage(point, '방어', false, true); return 'block';
    }
    const comboing = this.state === 'hit' || this.held;
    att.combo = comboing ? att.combo + 1 : 1; att.comboT = 1.6;
    let dmg = h.dmg; if (!h.noScale) dmg *= Math.max(0.45, 1 - 0.085 * (att.combo - 1));
    let crit = false; if (att.team === 0 && !h.noCrit && Math.random() < (att.def.stats.crit ?? 0.2)) { dmg *= 1.6; crit = true; }
    if (this.brokenT > 0) dmg *= 1.5;
    // 그로기 게이지: 가득 차면 브레이크 (일정 시간 무력화 · 받는 피해 증가)
    if (this.maxDaze && this.brokenT <= 0) { this.daze = Math.min(this.maxDaze, this.daze + (h.daze ?? dmg * 0.55)); if (this.daze >= this.maxDaze) this.breakStart(att); }
    // 기술 중 피격 훅 (예: 방어 태세 — 피해 감소 · 경직 없음 · 반격 예약)
    const mod = this.act && this.act.onHit && !h.force ? this.act.onHit(this, att, h, dir) : null;
    if (mod) dmg *= mod.dmgK ?? 1;
    // 슈퍼아머: 브레이크 전에는 경직·넉백 없이 버틴다
    const armored = (this.def.stats.armor && this.brokenT <= 0 && !h.force && !this.held) || !!(mod && mod.armor);
    this.hp -= dmg; if ((h.nokill || G.mode === 'training') && this.hp < 1) this.hp = 1; this.chipT = 0.7; this.lastHitT = 0;
    this.energy = Math.min(100, this.energy + dmg * 0.1); att.energy = Math.min(100, att.energy + dmg * 0.14);
    att.hitConfirm = true;
    if (armored) {
      this.flashT = 0.1; this.vel.addScaledVector(dir, 0.8);
    } else {
    if (this.act && this.act.end) this.act.end(this, this.opp, G);
    this.act = null; this.trail.clear(); this.state = 'hit'; this.stun = Math.max(h.stun ?? 0.32, this.brokenT); this.flashT = 0.12; this.float = false;
    }
    if (!this.held && !armored) {
      const kb = h.kb || [2, 0], heavyBody = this.scale > 1.2, kx = kb[0] / (heavyBody ? 2 : 1), ky = heavyBody && this.brokenT > 0 ? 0 : kb[1];
      this.vel.set(dir.x * kx, ky, dir.z * kx);
      if (ky > 0) { this.onGround = false; this.launched = true; }
      else if (!this.onGround) { this.vel.y = Math.max(this.vel.y, 3); this.launched = true; }
      this.yaw = Math.atan2(-dir.x, -dir.z);
    }
    (att.def.hitFx || defaultHitFx)(G, point, dir, h, att);
    G.hitstop = Math.max(G.hitstop, h.hs ?? 0.075); G.shake(h.shake ?? 0.08); sfx(h.snd || (dmg >= 60 ? 'big' : 'hit'));
    G.hud.damage(point, Math.round(dmg), dmg >= 100, false, crit); if (crit) sfx('crit');
    if (this.hp <= 0) {
      this.hp = 0; this.state = 'ko'; this.held = false; this.launched = true;
      if (this.onGround || this.vel.y < 4) { this.vel.y = 6; this.onGround = false; }
      this.vel.x = dir.x * 6; this.vel.z = dir.z * 6; G.onKO(this, att);
    }
    return 'hit';
  }
  /* ----- 업데이트 ----- */
  update(dt, live) {
    const o = this.opp, G = this.G;
    this.inv -= dt; this.counterT -= dt; if (this.brokenT > 0) { this.brokenT -= dt; if (this.brokenT <= 0) this.daze = 0; }
    for (const k in this.cd) this.cd[k] -= dt; this.flashT -= dt; this.comboT -= dt; this.blockStun -= dt; this.dashCd -= dt; this.jumpBuf -= dt; this.lastHitT += dt;
    if (this.buf) { this.buf.t -= dt; if (this.buf.t <= 0) this.buf = null; }
    if (this.comboT <= 0) this.combo = 0;
    if (live) this.energy = Math.min(100, this.energy + dt * 1.6);
    const I = live ? this.I : { mx: 0, mz: 0, guard: false };
    const mag = Math.hypot(I.mx, I.mz), S = this.def.stats;
    let target = null;
    switch (this.state) {
      case 'act': {
        const m = this.act; this.at += dt;
        const ev = m.ev || [];
        while (this.evDone < ev.length && this.at >= ev[this.evDone][0]) { const e = ev[this.evDone++]; e[1](this, o, G); if (this.act !== m) return this.post(dt); }
        if (m.tele && !this.teleDone && this.at >= m.tele[0]) { this.teleDone = true; G.telegraph && G.telegraph(this, m.tele[1]); }
        if (m.track && this.at < m.track) this.faceOpp(14, dt);
        if (m.lunge) for (const [t0, t1, sp] of m.lunge) if (this.at >= t0 && this.at <= t1) { const f = this.fwd(tA); this.vel.x = f.x * sp; this.vel.z = f.z * sp; }
        const hits = m.hits || [];
        const foes = hits.length ? this.foes() : [];
        for (let i = 0; i < hits.length; i++) {
          const hb = hits[i]; if (this.at < hb.t0 || this.at > hb.t1) continue;
          // 무기 공격은 칼날이 지나간 경로(직전 프레임 → 지금)로, 그 외에는 구로 판정
          const weap = (hb.weapon ?? m.trail) && this.hasW, br = (hb.br ?? 0.14) * this.scale;
          if (!weap) this.local(hb.at.map((v) => v * this.scale), tB);
          for (const t of foes) {
            const key = i * 100000 + t.id; if (this.hitDone.has(key)) continue;
            const touch = weap ? this.sweepHit(t, br) : t.hurtHit(tB, hb.r * this.scale);
            if (touch && t.takeHit(this, hb)) this.hitDone.add(key);
          }
          if (this.act !== m) break;
        }
        m.tick && m.tick(this, o, G, this.at, dt);
        if (this.act === m && live && this.buf) {
          const a = this.buf.a;
          if (a === 'light' && m.next && this.at >= m.cancel) { this.buf = null; this.start(m.next); }
          else if (a !== 'light' && a !== 'dash' && this.hitConfirm && !m.ult && !m.cd && this.at >= (m.cancel ?? m.dur * 0.45) && this.canAct(a)) { this.buf = null; this.start(a); }
        }
        if (this.act === m && this.at >= m.dur) this.endAct();
        if (this.act) {
          const ks = this.act._keys; let i = 0; while (i < ks.length - 2 && this.at > ks[i + 1][0]) i++;
          const [t0, p0] = ks[i], [t1, p1] = ks[Math.min(i + 1, ks.length - 1)];
          const k = t1 > t0 ? clamp((this.at - t0) / (t1 - t0), 0, 1) : 1; lerpPose(this.tgt, p0, p1, ease.io(k)); target = this.tgt;
        }
        if (this.onGround) { const f = Math.exp(-dt * 9); this.vel.x *= f; this.vel.z *= f; }
        break;
      }
      case 'hit':
        if (this.held) this.vel.set(0, 0, 0);
        else if (this.onGround && !this.launched) { const f = Math.exp(-dt * 8); this.vel.x *= f; this.vel.z *= f; this.stun -= dt; if (this.stun <= 0) this.state = 'idle'; }
        break;
      case 'down': {
        const f = Math.exp(-dt * 10); this.vel.x *= f; this.vel.z *= f; this.downT -= dt;
        if (this.downT <= 0) { this.state = 'idle'; this.inv = 0.3; this.riseT = 0.3; G.fx.burst(this.pos.clone().setY(0.1), 6, 0x8a7a90, 2, { kind: 'dust' }); }
        break;
      }
      case 'ko': case 'win': if (this.onGround) { const f = Math.exp(-dt * 6); this.vel.x *= f; this.vel.z *= f; } if (this.state === 'win') this.faceOpp(3, dt); break;
      case 'dash':
        this.dashT -= dt; this.ghostT -= dt;
        if (this.ghostT <= 0) { this.ghostT = 0.02; G.fx.burst(this.chest(tA), 3, this.palette.accent, 1.5, { kind: 'glow', sk: 0.6, lk: 0.6 }); }
        if (this.dashT <= 0) { this.state = 'idle'; this.vel.multiplyScalar(0.3); }
        break;
      case 'jump':
        if (live && this.buf && ['light', 'heavy', 'ult'].includes(this.buf.a) && this.canAct(this.buf.a)) { const a = this.buf.a; this.buf = null; this.tryAction(a); }
        else if (mag > 0.1) { this.vel.x = damp(this.vel.x, I.mx * S.speed * 0.8, 3, dt); this.vel.z = damp(this.vel.z, I.mz * S.speed * 0.8, 3, dt); }
        break;
      default: { // idle · run · guard
        if (this.blockStun > 0) { this.state = 'guard'; const f = Math.exp(-dt * 8); this.vel.x *= f; this.vel.z *= f; break; }
        if (live && this.buf && this.canAct(this.buf.a)) { const a = this.buf.a; this.buf = null; if (this.tryAction(a)) break; }
        if (I.guard && this.onGround) { if (this.state !== 'guard') this.guardT0 = G.time; this.state = 'guard'; const f = Math.exp(-dt * 14); this.vel.x *= f; this.vel.z *= f; this.faceOpp(16, dt); break; }
        if (this.jumpBuf > 0 && this.onGround) {
          this.jumpBuf = 0; this.vel.y = S.jump; this.vel.x = I.mx * S.speed * 0.9; this.vel.z = I.mz * S.speed * 0.9; this.onGround = false; this.state = 'jump';
          G.fx.burst(this.pos.clone().setY(0.08), 8, 0x8a7a90, 2.5, { kind: 'dust' }); sfx('jump'); break;
        }
        if (mag > 0.1) {
          this.vel.x = damp(this.vel.x, I.mx * S.speed, 14, dt); this.vel.z = damp(this.vel.z, I.mz * S.speed, 14, dt);
          this.yaw = angLerp(this.yaw, Math.atan2(I.mx, I.mz), 1 - Math.exp(-dt * 14)); this.state = 'run'; this.runP += dt * 11 * mag;
        } else { const f = Math.exp(-dt * 14); this.vel.x *= f; this.vel.z *= f; this.state = 'idle'; this.faceOpp(7, dt); }
      }
    }
    return this.post(dt, target);
  }
  post(dt, target) {
    const G = this.G, P = this.def._poses;
    // 물리
    if (!this.held && !this.float && !this.onGround) this.vel.y -= GRAV * dt * (this.state === 'hit' || this.state === 'ko' ? 0.85 : 1);
    this.pos.addScaledVector(this.vel, dt);
    const W = G.stage && G.stage.world;
    // 장애물에 막힘 · 세게 날아가 부딪히면 튕겨 나온다
    if (W && !this.held) {
      const n = W.push(this.pos, 0.38 * this.scale);
      if (n) {
        const vn = this.vel.x * n.x + this.vel.z * n.z;
        if (vn < 0) {
          if ((this.state === 'hit' || this.state === 'ko') && -vn > 7) {
            this.vel.x -= 1.5 * vn * n.x; this.vel.z -= 1.5 * vn * n.z; this.vel.y = Math.max(this.vel.y, 4); this.launched = true; this.onGround = false;
            G.shake(0.16); G.fx.burst(this.chest(tA).addScaledVector(new V3(n.x, 0, n.z), -0.4), 18, 0x9a8a90, 5, { kind: 'dust', sk: 1.2 }); sfx('land');
          } else { this.vel.x -= vn * n.x; this.vel.z -= vn * n.z; }
        }
      }
    }
    // 바닥(또는 올라선 장애물 윗면)
    const gy = W ? W.groundAt(this.pos.x, this.pos.z, this.pos.y) : 0; this.gy = gy;
    if (this.pos.y <= gy && !this.float && !this.held) {
      if (!this.onGround && this.vel.y <= 0) this.land();
      this.pos.y = gy; if (this.vel.y < 0) this.vel.y = 0; this.onGround = true;
    } else if (this.pos.y > gy + 0.001) this.onGround = false;
    if (this.held) this.onGround = false;
    const r = Math.hypot(this.pos.x, this.pos.z); if (r > ARENA_R) { this.pos.x *= ARENA_R / r; this.pos.z *= ARENA_R / r; }
    // 위험 지대 (용암 등)
    if (W && W.hazards.length && this.onGround && this.state !== 'ko') {
      this.hzT = (this.hzT || 0) - dt;
      for (const hz of W.hazards) if (Math.hypot(this.pos.x - hz.x, this.pos.z - hz.z) < hz.r && this.pos.y < 0.2 && this.hzT <= 0) {
        this.hzT = 0.4; const d = hz.dps * 0.4; this.hp = Math.max(1, this.hp - d); this.chipT = 0.5; this.vel.y = 5; this.onGround = false;
        G.fx.burst(this.pos.clone().setY(0.2), 16, [hz.color, 0xffd070], 5, { dir: new V3(0, 1, 0), spread: 0.8 }); G.hud.damage(this.chest(tA), Math.round(d), false); sfx('hit');
      }
    }
    // 포즈 목표
    if (!target) {
      const s = this.state, t = this.tgt, br = Math.sin(G.time * 2.6 + this.slot);
      if (s === 'run') { t.set(P.run); addRunCycle(t, this.runP, 1); }
      else if (s === 'jump') t.set(P.jump);
      else if (s === 'guard') t.set(P.guard);
      else if (s === 'hit') t.set(this.onGround && !this.launched ? P.hit : P.air);
      else if (s === 'down' || (s === 'ko' && this.onGround)) t.set(P.down);
      else if (s === 'ko') t.set(P.air);
      else if (s === 'dash') t.set(P.dash);
      else if (s === 'win') t.set(P.win);
      else { t.set(P.base); t[2] += br * 0.03; t[0] += br * 0.01; }
      target = t;
    }
    // 일어날 때는 빠르게 자세를 되찾는다
    this.riseT = (this.riseT || 0) - dt;
    const rate = this.state === 'act' ? 40 : this.state === 'hit' ? 30 : this.state === 'run' || this.riseT > 0 ? 22 : 13;
    lerpPose(this.pose, this.pose, target, 1 - Math.exp(-dt * rate));
    this.applyRig(dt);
    // 무기 궤적
    if (this.model.weaponPts) {
      this.pwb.copy(this.wb); this.pwt.copy(this.wt); this.model.weaponPts(this.wb, this.wt);
      // 기술 시작·순간이동 등으로 크게 튀면 칼날 궤적을 잇지 않음
      if (!this.hasW || this.wJump || this.pwt.distanceToSquared(this.wt) > 9) { this.pwb.copy(this.wb); this.pwt.copy(this.wt); this.hasW = true; this.wJump = false; }
      if (this.state === 'act' && this.act.trail) {
        // 궤적은 칼날만 (모델이 trailPts 를 주면), 판정은 weaponPts 전체(자루 포함)
        if (this.model.trailPts) { this.model.trailPts(tA, tB); this.trail.push(tA, tB); } else this.trail.push(this.wb, this.wt);
      }
    }
    this.updateHurt();
    // 방어막
    const sh = this.shield, on = this.state === 'guard' ? 1 : 0; sh.k = damp(sh.k, on, 16, dt); sh.hit = Math.max(0, sh.hit - dt * 4);
    sh.m.position.set(this.pos.x, this.pos.y + 1.0, this.pos.z); sh.m.rotation.y += dt * 0.8;
    sh.m.material.opacity = sh.k * (0.35 + sh.hit * 0.6); sh.s.material.opacity = sh.k * (0.06 + sh.hit * 0.25); sh.m.visible = sh.k > 0.01;
    // 궁극기 준비 오라
    if (this.energy >= 100 && !this.def.enemy && Math.random() < 0.35 && this.root.visible)
      G.fx.p(tA.set(this.pos.x + rand(-0.4, 0.4), this.pos.y + rand(0.1, 1.8), this.pos.z + rand(-0.4, 0.4)), { vel: [0, rand(1, 2.5), 0], life: 0.6, size: 0.08, color: this.palette.accent, drag: 0, flick: 0.6 });
    if (this.model.update) this.model.update(dt, this);
  }
  applyRig(dt) {
    applyPose(this.model, this.pose);
    this.root.rotation.y = this.yaw;
    // 접지: 발이 바닥에 닿도록 몸통 높이 보정
    const b = this.model.body; b.position.y = 0; this.root.updateMatrixWorld(true);
    let want = 0;
    if (this.onGround && !this.held && this.state !== 'down' && !(this.state === 'ko' && this.onGround)) {
      const J = this.model.J, yL = J.footL.getWorldPosition(tD).y, yR = J.footR.getWorldPosition(tD).y;
      want = -(Math.min(yL, yR) - this.pos.y - (this.model.sole || 0.07));
    }
    this.groundOff = damp(this.groundOff, want, 30, dt); b.position.y = this.groundOff; this.root.updateMatrixWorld(true);
    // 모델별 후처리 (예: 무기 방향을 몸 기준으로 다시 계산)
    if (this.model.rigHook) this.model.rigHook(this);
  }
  land() {
    const G = this.G; G.fx.burst(this.pos.clone().setY(0.08), 6, 0x8a7a90, 2, { kind: 'dust' });
    if (this.state === 'hit' && this.launched) {
      this.launched = false; this.state = 'down'; this.downT = 0.38; this.inv = 0.7; this.vel.multiplyScalar(0.4); G.shake(0.08);
      G.fx.burst(this.pos.clone().setY(0.1), 16, 0x8a7a90, 4, { kind: 'dust' }); sfx('land');
    } else if (this.state === 'ko') { this.launched = false; G.shake(0.12); G.fx.burst(this.pos.clone().setY(0.1), 22, 0x8a7a90, 5, { kind: 'dust' }); sfx('land'); }
    else if (this.state === 'jump') { this.state = 'idle'; sfx('land'); }
    if (this.act && this.act.onLand) this.act.onLand(this, this.opp, G);
  }
}

export function defaultHitFx(G, p, dir, h, att) {
  const big = h.dmg >= 60, col = att.palette.accent;
  G.fx.impact(p, col, big ? 1.6 : 1, dir);
  const a = rand(0, Math.PI * 2), n = new V3(Math.cos(a) * 0.3, Math.sin(a), Math.cos(a)).normalize();
  G.fx.slash(p.clone().addScaledVector(dir, -0.3), { fwd: dir, normal: n, r: big ? 1.3 : 0.9, color: col, life: 0.18 });
}
