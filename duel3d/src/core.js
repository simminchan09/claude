// 공용 유틸 · 입력 · 사운드
export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (a) => a[(Math.random() * a.length) | 0];
export const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
export const ease = {
  out: (t) => 1 - (1 - t) ** 3,
  io: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  back: (t) => { const c = 1.9; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; },
};
export function angDelta(a, b) { return ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI; }
export function angLerp(a, b, t) { return a + angDelta(a, b) * t; }

/* ---------------- 입력 ---------------- */
export const keys = {};
export const pressed = {};
const BLOCK = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Slash', 'Quote', 'Semicolon', 'Tab', 'ShiftLeft', 'ShiftRight', 'ControlRight']);
addEventListener('keydown', (e) => {
  if (BLOCK.has(e.code)) e.preventDefault();
  if (!keys[e.code]) pressed[e.code] = true;
  keys[e.code] = true;
  audioInit();
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
export function endFrame() { for (const k in pressed) delete pressed[k]; }

// 키 배치. 1P 단독(CPU·훈련) 모드에서는 방향키도 이동에 쓸 수 있다.
export const MAPS = {
  p1solo: { up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], jump: ['Space'], dash: ['ShiftLeft', 'ShiftRight'], guard: ['KeyL'], light: ['KeyJ'], heavy: ['KeyK'], s1: ['KeyU'], s2: ['KeyI'], ult: ['KeyO'] },
  p1: { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], jump: ['Space'], dash: ['ShiftLeft'], guard: ['KeyL'], light: ['KeyJ'], heavy: ['KeyK'], s1: ['KeyU'], s2: ['KeyI'], ult: ['KeyO'] },
  p2: { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], jump: ['Numpad0', 'ControlRight'], dash: ['NumpadDecimal', 'ShiftRight'], guard: ['Numpad3', 'Slash'], light: ['Numpad1', 'Comma'], heavy: ['Numpad2', 'Period'], s1: ['Numpad4', 'Semicolon'], s2: ['Numpad5', 'Quote'], ult: ['Numpad6', 'BracketRight'] },
};
export const ACTIONS = ['ult', 's1', 's2', 'heavy', 'light', 'dash'];
export function keyName(code) {
  return code.replace('Key', '').replace('Numpad', 'Num').replace('Comma', ',').replace('Period', '.').replace('Slash', '/')
    .replace('Semicolon', ';').replace('Quote', "'").replace('BracketRight', ']').replace('ShiftLeft', 'Shift').replace('ShiftRight', 'RShift')
    .replace('ControlRight', 'RCtrl').replace('NumDecimal', 'Num.');
}

// 카메라 기준 이동: W = 화면 안쪽, D = 화면 오른쪽
export class KeyCtrl {
  constructor(map) { this.m = map; this.human = true; }
  read(G) {
    const h = (k) => this.m[k].some((c) => keys[c]);
    const p = (k) => this.m[k].some((c) => pressed[c]);
    const ix = (h('right') ? 1 : 0) - (h('left') ? 1 : 0);
    const iy = (h('up') ? 1 : 0) - (h('down') ? 1 : 0);
    const f = G.camFwd;
    let mx = f.x * iy - f.z * ix, mz = f.z * iy + f.x * ix;
    const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; }
    return { mx, mz, guard: h('guard'), jumpP: p('jump'), press: ACTIONS.find(p) || null };
  }
}

/* ---------------- 사운드 (합성) ---------------- */
let AC = null, master = null, nbuf = null, muted = false;
export function setMuted(m) { muted = m; }
export function isMuted() { return muted; }
export function audioInit() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain(); master.gain.value = 0.45; master.connect(AC.destination);
    nbuf = AC.createBuffer(1, AC.sampleRate * 1.5, AC.sampleRate);
    const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { AC = null; }
}
function noise(dur, type, f0, f1, gain, q = 1, delay = 0) {
  if (!AC || muted) return; const t = AC.currentTime + delay;
  const s = AC.createBufferSource(); s.buffer = nbuf; const fl = AC.createBiquadFilter(); fl.type = type; fl.Q.value = q;
  fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = AC.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(fl); fl.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + dur + 0.05);
}
function tone(f0, f1, dur, type, gain, delay = 0) {
  if (!AC || muted) return; const t = AC.currentTime + delay;
  const o = AC.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
}
const SFX = {
  swing() { noise(0.16, 'bandpass', 2600, 500, 0.3, 1.4); },
  heavy() { noise(0.28, 'bandpass', 1400, 260, 0.4, 1.1); },
  hit() { tone(170, 55, 0.16, 'sine', 0.55); noise(0.07, 'highpass', 2500, 1500, 0.35); },
  big() { tone(120, 38, 0.32, 'sine', 0.7); noise(0.22, 'lowpass', 3000, 300, 0.5); },
  block() { tone(1300, 900, 0.07, 'square', 0.08); noise(0.06, 'highpass', 4000, 3000, 0.3); },
  zap() { noise(0.12, 'highpass', 6000, 2000, 0.35); tone(1800, 300, 0.12, 'square', 0.05); },
  shot() { tone(600, 1400, 0.18, 'sawtooth', 0.08); noise(0.2, 'bandpass', 1800, 4000, 0.2, 2); },
  boom() { tone(95, 28, 0.8, 'sine', 0.8); noise(1, 'lowpass', 1800, 60, 0.75, 0.6); },
  charge() { tone(200, 1200, 0.6, 'sawtooth', 0.06); noise(0.6, 'bandpass', 400, 4000, 0.2, 3); },
  ult() { tone(180, 900, 0.5, 'sawtooth', 0.08); tone(270, 1350, 0.5, 'sawtooth', 0.06); noise(0.9, 'bandpass', 300, 5000, 0.25, 0.8); },
  ko() { tone(220, 40, 1.2, 'sawtooth', 0.18); noise(1.4, 'lowpass', 1500, 60, 0.6); },
  dash() { noise(0.14, 'bandpass', 900, 3200, 0.25, 1.2); },
  jump() { noise(0.1, 'bandpass', 600, 1400, 0.15, 1); },
  land() { tone(90, 50, 0.1, 'sine', 0.25); },
  ui() { tone(880, 1320, 0.07, 'triangle', 0.12); },
};
export function sfx(n) { try { SFX[n] && SFX[n](); } catch (e) { /* 소리 실패는 무시 */ } }
