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
      if (f.actName && f.actName.startsWith('light') && f.hitConfirm && Math.random() < 0.25) out.press = 'light';
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
      else if (dist > 6 && f.cd.s1 <= 0 && Math.random() < 0.4) out.press = 's1';
      else if (dist < 4 && f.cd.s2 <= 0 && Math.random() < 0.2) out.press = 's2';
      else if (dist < 2.3) out.press = Math.random() < 0.75 ? 'light' : 'heavy';
      else if (dist > 9 && Math.random() < 0.2) out.press = 'dash';
      else this.mode = Math.random() < 0.75 ? 'approach' : 'circle';
      if (!out.press && Math.random() < 0.04) out.jumpP = true;
      if (Math.random() < 0.2) this.strafe *= -1;
    }
    if (this.mode === 'approach') { out.mx = tx; out.mz = tz; }
    else if (this.mode === 'circle') { out.mx = -tz * this.strafe * 0.8 + tx * 0.2; out.mz = tx * this.strafe * 0.8 + tz * 0.2; }
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
