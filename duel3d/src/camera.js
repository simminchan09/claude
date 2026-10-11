// 카메라: 대전 프레이밍 · 타이틀 공전 · 궁극기 시네마틱 · KO/승리 연출
import * as THREE from 'three';
import { clamp, damp, ease, lerp, rand } from './core.js';

const V3 = THREE.Vector3;
const tP = new V3(), tL = new V3(), tF = new V3(), tR = new V3();

export class FightCam {
  constructor(camera) {
    this.c = camera; this.pos = new V3(0, 6, 22); this.look = new V3(0, 1, 0); this.side = new V3(0, 0, 1);
    this.mode = 'orbit'; this.t = 0; this.fov = 50; this.cine = null; this.focus = null; this.shake = 0;
  }
  // 궁극기 카메라: keys = [[t, { ref: 'self'|'target', p: [오른쪽, 위, 앞], l: [...], fov }]]
  // 좌표는 시전자가 궁극기를 시작할 때 바라보던 방향 기준
  playCine(f, keys) { if (keys && keys.length) this.cine = { f, keys, t: 0, yaw: f.yaw }; }
  stopCine() { this.cine = null; }
  setFocus(target, o = {}) { this.focus = { target, dist: o.dist ?? 5, h: o.h ?? 1.6, t: 0, spin: o.spin ?? 0.25, yaw: o.yaw }; }
  snap() { this.c.position.copy(this.pos); this.c.lookAt(this.look); }
  framePoint(ref, yaw, o, out) {
    const s = Math.sin(yaw), c = Math.cos(yaw);
    return out.set(ref.x - c * o[0] + s * o[2], ref.y + o[1], ref.z + s * o[0] + c * o[2]);
  }
  update(dt, G) {
    this.t += dt; let fov = 48, k = 5;
    const F = G.fighters;
    if (this.mode === 'orbit' || !F.length) {
      // 타이틀: 중앙의 미리보기 캐릭터를 화면 오른쪽에 두고 천천히 공전
      const a = 0.35 + Math.sin(this.t * 0.12) * 0.55, R = 7.2; tP.set(Math.sin(a) * R, 2.1, Math.cos(a) * R); tL.set(0, 1.15, 0);
      tF.subVectors(tL, tP).setY(0).normalize(); tR.set(-tF.z, 0, tF.x); tP.addScaledVector(tR, -2.3); tL.addScaledVector(tR, -2.3); fov = 40; k = 3;
    } else if (this.cine) {
      const C = this.cine; C.t += dt; const ks = C.keys;
      let i = 0; while (i < ks.length - 2 && C.t > ks[i + 1][0]) i++;
      const [t0, a] = ks[i], [t1, b] = ks[Math.min(i + 1, ks.length - 1)], u = t1 > t0 ? ease.io(clamp((C.t - t0) / (t1 - t0), 0, 1)) : 1;
      const refA = a.ref === 'target' ? C.f.opp.pos : C.f.pos, refB = b.ref === 'target' ? C.f.opp.pos : C.f.pos;
      tP.lerpVectors(this.framePoint(refA, C.yaw, a.p, tF), this.framePoint(refB, C.yaw, b.p, tR), u);
      tL.lerpVectors(this.framePoint(refA, C.yaw, a.l, tF), this.framePoint(refB, C.yaw, b.l, tR), u);
      fov = lerp(a.fov ?? 50, b.fov ?? 50, u); k = 12;
      if (C.t > ks[ks.length - 1][0]) this.cine = null;
    } else if (this.focus) {
      const f = this.focus, p = f.target.pos; f.t += dt; const yaw = (f.yaw ?? f.target.yaw) + f.t * f.spin;
      tP.set(p.x + Math.sin(yaw) * f.dist, p.y + f.h, p.z + Math.cos(yaw) * f.dist); tL.set(p.x, p.y + 1.1, p.z); fov = 42; k = 4;
    } else {
      const a = F[0].pos, b = F[1].pos, M = tL.set((a.x + b.x) / 2, 0, (a.z + b.z) / 2);
      let dx = b.x - a.x, dz = b.z - a.z; const d = Math.hypot(dx, dz) || 0.001; dx /= d; dz /= d;
      tR.set(-dz, 0, dx); if (tR.dot(this.side) < 0) tR.negate();
      this.side.lerp(tR, 1 - Math.exp(-dt * 2.2)).normalize();
      const dist = 6.8 + d * 0.62, h = 2.5 + d * 0.17;
      tP.copy(M).addScaledVector(this.side, dist).setY(h + Math.max(a.y, b.y) * 0.4);
      M.y = 1.05 + Math.max(a.y, b.y) * 0.5; k = 5;
    }
    this.pos.set(damp(this.pos.x, tP.x, k, dt), damp(this.pos.y, tP.y, k, dt), damp(this.pos.z, tP.z, k, dt));
    this.look.set(damp(this.look.x, tL.x, k * 1.4, dt), damp(this.look.y, tL.y, k * 1.4, dt), damp(this.look.z, tL.z, k * 1.4, dt));
    this.fov = damp(this.fov, fov, 6, dt);
    this.shake *= Math.exp(-dt * 10);
    const s = this.shake;
    this.c.position.set(this.pos.x + rand(-s, s), this.pos.y + rand(-s, s), this.pos.z + rand(-s, s));
    this.c.lookAt(this.look);
    if (Math.abs(this.c.fov - this.fov) > 0.01) { this.c.fov = this.fov; this.c.updateProjectionMatrix(); }
  }
}
