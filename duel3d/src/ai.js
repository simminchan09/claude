// CPU 컨트롤러 · 훈련용 더미
import { rand } from './core.js';

export class AICtrl {
  constructor() { this.t = 0; this.guardT = 0; this.strafe = 1; this.mode = null; this.human = false; }
  read(G, f) {
    const o = f.opp, out = { mx: 0, mz: 0, guard: false, jumpP: false, press: null }, dt = G.rdt || 1 / 60;
    this.t -= dt; this.guardT -= dt;
    if (G.state !== 'fight' || !o) return out;
    const dx = o.pos.x - f.pos.x, dz = o.pos.z - f.pos.z, dist = Math.hypot(dx, dz) || 1, tx = dx / dist, tz = dz / dist;
    if (this.guardT > 0) { out.guard = true; return out; }
    if (f.state === 'act') {
      if (f.actName && f.actName.startsWith('light') && (f.hitConfirm || (f.def.aiRange && dist < f.def.aiRange[1] + 2)) && Math.random() < 0.25) out.press = 'light';
      if (f.def.aiRange && dist < f.def.aiRange[0]) { out.mx = -tx; out.mz = -tz; } // 원거리: 쏘면서 뒤로 물러난다
      if (f.actName === 'light3' && f.hitConfirm && Math.random() < 0.08) out.press = 'heavy';
      return out;
    }
    if (this.t <= 0) {
      this.t = rand(0.1, 0.25); this.mode = null;
      const threat = o.state === 'act' && !o.act.ult && dist < 3.5;
      const custom = f.def.aiPick && f.def.aiPick(f, o, dist);
      if (threat && Math.random() < 0.45) { this.guardT = rand(0.25, 0.5); out.guard = true; return out; }
      if (o.state === 'down' || o.held) this.mode = dist > 3 ? 'approach' : 'circle';
      else if (f.energy >= 100 && dist < 12 && Math.random() < 0.4) out.press = 'ult';
      else if (custom) out.press = custom;
      else if (f.def.aiRange) { // 원거리: 사거리 안에서 쏘고, 너무 가까우면 물러나거나 회피
        const [mn, mx] = f.def.aiRange;
        if (dist < mn * 0.55 && Math.random() < 0.3) { out.press = 'dash'; out.mx = -tx; out.mz = -tz; }
        else if (dist <= mx && Math.random() < 0.7) out.press = Math.random() < 0.85 ? 'light' : 'heavy';
        this.mode = dist < mn ? 'retreat' : dist > mx ? 'approach' : Math.random() < 0.6 ? 'circle' : 'hold';
      }
      else if (dist > 6 && f.cd.s1 <= 0 && Math.random() < 0.4) out.press = 's1';
      else if (dist < 4 && f.cd.s2 <= 0 && Math.random() < 0.2) out.press = 's2';
      else if (dist < 2.3) out.press = Math.random() < 0.75 ? 'light' : 'heavy';
      else if (dist > 9 && Math.random() < 0.2) out.press = 'dash';
      else this.mode = Math.random() < 0.75 ? 'approach' : 'circle';
      if (!out.press && Math.random() < 0.04) out.jumpP = true;
      if (Math.random() < 0.2) this.strafe *= -1;
    }
    if (this.mode === 'approach') { out.mx = tx; out.mz = tz; }
    else if (this.mode === 'circle') { const k = f.def.aiRange ? 0 : 0.2; out.mx = -tz * this.strafe * 0.8 + tx * k; out.mz = tx * this.strafe * 0.8 + tz * k; }
    else if (this.mode === 'retreat') { out.mx = -tx * 0.85 - tz * this.strafe * 0.5; out.mz = -tz * 0.85 + tx * this.strafe * 0.5; }
    // 장애물 회피: 앞이 막히면 낮은 건 뛰어넘고, 높은 건 옆으로 돌아간다
    const W = G.stage && G.stage.world;
    if (W && (out.mx || out.mz)) {
      const h = W.blockedAhead(f.pos, out.mx, out.mz, 1.8);
      if (h > 0) {
        if (h < 1.5 && f.onGround) out.jumpP = true;
        else for (const a of [0.8 * this.strafe, -0.8 * this.strafe, 1.6 * this.strafe, -1.6 * this.strafe]) {
          const c = Math.cos(a), s = Math.sin(a), x = out.mx * c - out.mz * s, z = out.mx * s + out.mz * c;
          if (!W.blockedAhead(f.pos, x, z, 1.8)) { out.mx = x; out.mz = z; break; }
        }
      }
    }
    return out;
  }
}

// 훈련 모드 상대: 가만히 · 방어 · CPU
export const DUMMY_MODES = ['stand', 'guard', 'cpu'];
export const DUMMY_LABEL = { stand: '가만히', guard: '항상 방어', cpu: 'CPU 반격' };
export class DummyCtrl {
  constructor() { this.mode = 'stand'; this.ai = new AICtrl(); this.human = false; }
  cycle() { this.mode = DUMMY_MODES[(DUMMY_MODES.indexOf(this.mode) + 1) % DUMMY_MODES.length]; }
  read(G, f) {
    if (this.mode === 'cpu') return this.ai.read(G, f);
    return { mx: 0, mz: 0, guard: this.mode === 'guard', jumpP: false, press: null };
  }
}

// 몬스터 AI: 다가가기 · 주위 돌기 · 공격 (동시에 공격하는 수를 G.takeToken 으로 제한)
// 적 정의의 ai: { range, keep, cdMin, cdMax, pick(f, o, dist) -> 기술 이름 | null, chain }
export class EnemyAI {
  constructor() { this.t = rand(0.2, 0.8); this.cool = rand(0.8, 1.8); this.mode = 'approach'; this.strafe = Math.random() < 0.5 ? 1 : -1; this.human = false; }
  read(G, f) {
    const out = { mx: 0, mz: 0, guard: false, jumpP: false, press: null }, dt = (G.rdt || 1 / 60) * (G.foeScale ?? 1), A = f.def.ai;
    this.t -= dt; this.cool -= dt;
    const o = f.opp; if (G.state !== 'fight' || !o || o.state === 'ko') return out;
    if (f.state === 'act') { if (f.def.moves[f.actName] && f.def.moves[f.actName].next && Math.random() < (A.chain ?? 0.5) * 0.1) out.press = 'light'; return out; }
    if (f.state !== 'idle' && f.state !== 'run') return out;
    const dx = o.pos.x - f.pos.x, dz = o.pos.z - f.pos.z, dist = Math.hypot(dx, dz) || 1, tx = dx / dist, tz = dz / dist;
    if (this.t <= 0) {
      this.t = rand(0.15, 0.35);
      if (this.cool <= 0 && dist < A.range + 0.6 && G.takeToken(f)) {
        const mv = A.pick(f, o, dist);
        if (mv && f.canAct(mv)) { out.press = mv; this.cool = rand(A.cdMin, A.cdMax) * (f.enraged ? 0.65 : 1); return out; }
      }
      this.mode = dist > A.range ? 'approach' : Math.random() < 0.65 ? 'circle' : 'hold';
      if (Math.random() < 0.25) this.strafe *= -1;
    }
    if (this.mode === 'approach') { out.mx = tx; out.mz = tz; }
    else if (this.mode === 'circle') { const away = dist < (A.keep ?? 1.2) ? -0.6 : 0.15; out.mx = (-tz * this.strafe + tx * away) * 0.55; out.mz = (tx * this.strafe + tz * away) * 0.55; }
    const W = G.stage && G.stage.world;
    if (W && (out.mx || out.mz)) {
      const l = Math.hypot(out.mx, out.mz), ux = out.mx / l, uz = out.mz / l;
      if (W.blockedAhead(f.pos, ux, uz, 1.8 * f.scale)) for (const a of [0.9 * this.strafe, -0.9 * this.strafe, 1.7 * this.strafe]) {
        const c = Math.cos(a), s = Math.sin(a), x = ux * c - uz * s, z = ux * s + uz * c;
        if (!W.blockedAhead(f.pos, x, z, 1.8 * f.scale)) { out.mx = x * l; out.mz = z * l; break; }
      }
    }
    return out;
  }
}
