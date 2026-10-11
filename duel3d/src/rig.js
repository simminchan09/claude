// 휴머노이드 관절 리그 + 포즈 시스템
//
// 포즈 = { hipY: 골반 높이 보정(m), 관절이름: [x, y, z] 회전(rad) }
// 회전 규칙 (캐릭터는 +Z를 바라봄, 오른쪽 = -X):
//   팔·다리 x 음수 = 앞으로 들기,  무릎 x 양수 = 정강이 뒤로 접기,  팔꿈치 x 음수 = 앞팔 굽히기
//   spine/chest x 양수 = 앞으로 숙이기,  y 양수 = 왼쪽으로 비틀기
//   왼팔 z 양수 / 오른팔 z 음수 = 바깥으로 벌리기
//   weapon = 오른손에 붙은 무기 관절 (무기는 +Z 방향으로 뻗음)
import * as THREE from 'three';

export const JOINTS = ['hips', 'spine', 'chest', 'neck', 'head', 'shoulderL', 'elbowL', 'handL', 'shoulderR', 'elbowR', 'handR', 'hipL', 'kneeL', 'footL', 'hipR', 'kneeR', 'footR', 'weapon'];
export const JI = Object.fromEntries(JOINTS.map((j, i) => [j, 1 + i * 3])); // x 성분 인덱스
export const POSE_LEN = 1 + JOINTS.length * 3;

export function flat(p) {
  const a = new Float32Array(POSE_LEN); a[0] = p.hipY || 0;
  JOINTS.forEach((j, i) => { const v = p[j]; if (v) { a[1 + i * 3] = v[0]; a[2 + i * 3] = v[1]; a[3 + i * 3] = v[2]; } });
  return a;
}
export function lerpPose(out, a, b, t) { for (let i = 0; i < POSE_LEN; i++) out[i] = a[i] + (b[i] - a[i]) * t; }

// 캐릭터 정의를 런타임용으로 변환: 포즈를 평탄화하고 기술 키프레임을 누적 포즈로 만든다
export function prepareDef(def) {
  if (def._ready) return def;
  const base = def.poses.base;
  def._poses = {};
  for (const k in def.poses) def._poses[k] = flat({ ...base, ...def.poses[k] });
  for (const name in def.moves) {
    const m = def.moves[name]; let cur = { ...base };
    m._keys = m.keys.map(([t, o]) => {
      if (o === 'base') cur = { ...base };
      else if (typeof o === 'string') cur = { ...base, ...def.poses[o] };
      else cur = { ...cur, ...o };
      return [t, flat(cur)];
    });
  }
  def._ready = true; return def;
}

export function buildHumanoid(d) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const J = {};
  const mk = (name, parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); J[name] = g; return g; };
  mk('hips', body, 0, d.hipH, 0); mk('spine', J.hips, 0, 0.08, 0); mk('chest', J.spine, 0, d.spineL, 0);
  mk('neck', J.chest, 0, d.chestL, 0); mk('head', J.neck, 0, d.neckL, 0);
  mk('shoulderL', J.chest, d.shW, d.chestL - 0.06, 0); mk('elbowL', J.shoulderL, 0, -d.uArm, 0); mk('handL', J.elbowL, 0, -d.lArm, 0);
  mk('shoulderR', J.chest, -d.shW, d.chestL - 0.06, 0); mk('elbowR', J.shoulderR, 0, -d.uArm, 0); mk('handR', J.elbowR, 0, -d.lArm, 0);
  mk('weapon', J.handR, 0, -0.06, 0);
  mk('hipL', J.hips, d.hipW, -0.04, 0); mk('kneeL', J.hipL, 0, -d.thigh, 0); mk('footL', J.kneeL, 0, -d.shin, 0);
  mk('hipR', J.hips, -d.hipW, -0.04, 0); mk('kneeR', J.hipR, 0, -d.thigh, 0); mk('footR', J.kneeR, 0, -d.shin, 0);
  return { root, body, J, dims: d };
}

export function applyPose(model, a) {
  const J = model.J; J.hips.position.y = model.dims.hipH + a[0];
  for (let i = 0; i < JOINTS.length; i++) J[JOINTS[i]].rotation.set(a[1 + i * 3], a[2 + i * 3], a[3 + i * 3]);
}

// 달리기 사이클 (포즈 배열에 더한다)
export function addRunCycle(out, phase, amt) {
  const s = Math.sin(phase), c = Math.cos(phase);
  out[JI.hipL] += -0.85 * s * amt; out[JI.hipR] += 0.85 * s * amt;
  out[JI.kneeL] += (0.25 + 1.1 * Math.max(0, c)) * amt; out[JI.kneeR] += (0.25 + 1.1 * Math.max(0, -c)) * amt;
  out[JI.shoulderL] += 0.7 * s * amt; out[JI.shoulderR] += -0.35 * s * amt;
  out[JI.spine] += 0.28 * amt; out[JI.hips + 1] += 0.18 * s * amt;
  out[0] += Math.abs(c) * 0.05 * amt;
}
