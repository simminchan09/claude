// 기술에서 쓰는 범용 오브젝트: 투사체 · 범위 판정
import * as THREE from 'three';

const V3 = THREE.Vector3;

export class Projectile {
  // o: { owner, pos, vel, r, hit(피격 데이터), color, homing(유도 세기), life, onHit }
  constructor(G, o) {
    this.G = G; this.owner = o.owner; this.pos = o.pos.clone(); this.vel = o.vel.clone(); this.r = o.r ?? 0.35; this.h = o.hit;
    this.life = o.life ?? 2.2; this.color = o.color ?? 0xffffff; this.homing = o.homing ?? 0; this.onHit = o.onHit; this.t = 0; this.done = false;
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(this.r * 0.5, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    this.halo = new THREE.Mesh(new THREE.SphereGeometry(this.r, 16, 12), new THREE.MeshBasicMaterial({ color: this.color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.mesh.add(this.halo); this.mesh.position.copy(this.pos); G.scene.add(this.mesh);
  }
  update(dt) {
    const G = this.G, tgt = this.owner.opp; this.t += dt;
    if (this.homing && tgt) { const sp = this.vel.length(), d = tgt.chest(new V3()).sub(this.pos).normalize().multiplyScalar(sp); this.vel.lerp(d, 1 - Math.exp(-this.homing * dt)); }
    this.pos.addScaledVector(this.vel, dt); this.mesh.position.copy(this.pos); this.halo.scale.setScalar(1 + 0.18 * Math.sin(this.t * 45));
    G.fx.p(this.pos, { size: this.r * 2.6, size1: this.r * 0.6, life: 0.22, color: this.color, alpha: 0.7, drag: 0 });
    G.fx.burst(this.pos, 1, this.color, 1.5, { lk: 0.6 });
    for (const t of this.owner.foes()) if (t.hurtHit(this.pos, this.r)) {
      const r = t.takeHit(this.owner, this.h, this.vel.clone().setY(0).normalize());
      if (r) { G.fx.impact(this.pos, this.color, 1.4); this.onHit && this.onHit(this, r); return this.kill(); }
    }
    const W = G.stage && G.stage.world;
    if (this.t > this.life || this.pos.y < 0.05 || (W && W.solidAt(this.pos, this.r * 0.6)) || Math.hypot(this.pos.x, this.pos.z) > 40) { G.fx.impact(this.pos, this.color, 0.8); this.kill(); }
  }
  kill() { this.done = true; this.G.scene.remove(this.mesh); this.mesh.geometry.dispose(); this.halo.geometry.dispose(); }
}

// 원형 범위 판정 (지면 충격파 등). 맞으면 피격 결과를 돌려준다
export function areaHit(att, center, radius, h, maxY = 0.6) { // maxY: 이보다 높이 뜬 상대는 맞지 않음 (지면 충격파)
  let any = false;
  for (const o of att.foes()) {
    const dx = o.pos.x - center.x, dz = o.pos.z - center.z, d = Math.hypot(dx, dz);
    if (d > radius + 0.42 * o.scale || o.pos.y - center.y > maxY) continue;
    const dir = d > 0.01 ? new V3(dx / d, 0, dz / d) : att.fwd(new V3());
    any = o.takeHit(att, h, dir) || any;
  }
  return any;
}
