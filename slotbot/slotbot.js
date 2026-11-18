/**
 * 슬롯 자동 멈춤 봇 (AutoJs6 / 안드로이드 태블릿용)
 *
 * 화면을 캡처해서 각 릴의 목표 그림(예: 7)이 당첨 줄에 도착하는 시각을 계산하고,
 * 그 시각에 맞춰 멈춤 버튼을 자동으로 탭합니다.
 * 멈춘 결과를 보고 탭 타이밍(지연 시간)을 스스로 보정합니다.
 *
 * 필요한 권한: 접근성 서비스, 화면 캡처, 다른 앱 위에 표시(플로팅 창)
 */

auto.waitFor();

const STORE = storages.create("slotbot_v1");
const TOL = STORE.get("tolerance", 60);          // 색 일치 허용 오차 (RGB 차이 합)
const LAT_MIN = -400, LAT_MAX = 600;
let latency = STORE.get("latency", 80);           // 목표 도착 몇 ms 전에 탭할지 (자동 학습)

const isLand = context.getResources().getConfiguration().orientation === 2;
if (!requestScreenCapture(isLand)) {
  toast("화면 캡처 권한이 필요합니다");
  exit();
}
sleep(600);

/* ---------------- 유틸 ---------------- */

function rgbAt(img, x, y) {
  const c = images.pixel(img, x, y);
  return [colors.red(c), colors.green(c), colors.blue(c)];
}
function dist(a, b) {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
}
function sampleColor(img, x, y) {
  const s = [0, 0, 0];
  let n = 0;
  for (let dx = -2; dx <= 2; dx += 2) {
    for (let dy = -2; dy <= 2; dy += 2) {
      const c = rgbAt(img, x + dx, y + dy);
      s[0] += c[0]; s[1] += c[1]; s[2] += c[2]; n++;
    }
  }
  return [Math.round(s[0] / n), Math.round(s[1] / n), Math.round(s[2] / n)];
}
function median(a) {
  const s = a.slice().sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/* ---------------- 설정 (좌표/색 등록) ---------------- */

function makeOverlay() {
  const w = floaty.rawWindow(
    '<frame id="root" bg="#55000000">' +
    '<text id="msg" textColor="#ffffff" textSize="18sp" bg="#dd000000" padding="16" ' +
    'layout_gravity="top|center_horizontal" margin="0 30 0 0"/>' +
    '</frame>'
  );
  sleep(300);
  return w;
}

function askPoint(w, msg) {
  let res = null;
  ui.run(() => {
    w.msg.setText(msg);
    w.setSize(-1, -1);
    w.setTouchable(true);
    w.root.setOnTouchListener(function (view, e) {
      if (e.getAction() === 1) res = [Math.round(e.getRawX()), Math.round(e.getRawY())];
      return true;
    });
  });
  while (!res) sleep(30);
  ui.run(() => { w.setTouchable(false); w.setSize(1, 1); });
  sleep(400); // 오버레이가 사라진 뒤 캡처
  return res;
}

function calibrate() {
  alert("설정 시작",
    "슬롯머신 화면을 띄우고, 릴이 멈춰 있는 상태에서 진행하세요.\n\n" +
    "화면에 나오는 안내대로 위치를 하나씩 탭하면 됩니다.\n" +
    "(설정 중의 탭은 게임에 전달되지 않습니다)");
  const w = makeOverlay();
  const reels = [];
  for (let i = 0; i < 3; i++) {
    const p = askPoint(w, "[릴 " + (i + 1) + "] 목표 그림(예: 7)에서\n다른 그림에 없는 진한 색 부분을 탭하세요");
    const img = captureScreen();
    reels.push({ x: p[0], color: sampleColor(img, p[0], p[1]) });
  }
  const a = askPoint(w, "릴 창의 맨 위 가장자리를 탭하세요")[1];
  const b = askPoint(w, "릴 창의 맨 아래 가장자리를 탭하세요")[1];
  const yc = askPoint(w, "당첨 줄(가운데 줄)의 정중앙 높이를 탭하세요")[1];
  for (let i = 0; i < 3; i++) {
    reels[i].stop = askPoint(w, "릴 " + (i + 1) + "을(를) 멈추는 버튼을 탭하세요\n(버튼이 하나면 같은 곳을 탭)");
  }
  const start = askPoint(w, "슬롯을 돌리는 시작 버튼(레버)을 탭하세요");
  w.close();

  const rowsIdx = dialogs.select("릴 창에 세로로 보이는 칸 수", ["3칸", "1칸", "5칸"]);
  const rows = [3, 1, 5][Math.max(0, rowsIdx)];
  const dirIdx = dialogs.select("릴이 도는 방향", ["위에서 아래로", "아래에서 위로"]);
  const dir = dirIdx === 1 ? -1 : 1;

  const cfg = { reels, top: Math.min(a, b), bot: Math.max(a, b), yc, start, rows, dir };
  STORE.put("cfg", cfg);
  return cfg;
}

let cfg = STORE.get("cfg");
if (cfg) {
  const c = dialogs.select("저장된 설정이 있습니다", ["저장된 설정 사용", "처음부터 다시 설정", "타이밍 학습값 초기화 후 사용"]);
  if (c < 0) exit();
  if (c === 1) cfg = null;
  if (c === 2) { latency = 80; STORE.put("latency", latency); }
}
if (!cfg) cfg = calibrate();

const winH = cfg.bot - cfg.top;
const symH = winH / cfg.rows;

/* ---------------- 화면 분석 ---------------- */

// 릴 세로줄에서 목표 색 덩어리의 중심 y 좌표들을 찾음 (창 가장자리에 걸친 것은 제외)
function findBlobs(img, r) {
  const ys = [];
  let runStart = -1;
  const W = img.getWidth();
  const xs = [r.x - 4, r.x, r.x + 4].filter(x => x >= 0 && x < W);
  for (let y = cfg.top + 2; y <= cfg.bot - 2; y += 2) {
    let hit = false;
    for (let k = 0; k < xs.length; k++) {
      if (dist(rgbAt(img, xs[k], y), r.color) <= TOL) { hit = true; break; }
    }
    if (hit) {
      if (runStart < 0) runStart = y;
    } else if (runStart >= 0) {
      const end = y - 2;
      if (end - runStart >= 4 && runStart > cfg.top + 3) ys.push((runStart + end) / 2);
      runStart = -1;
    }
  }
  return ys;
}

function newState() {
  return { prev: null, vs: [], passes: [], P: null, lastPFit: 0, stillFrames: 0 };
}

// 프레임마다 릴 상태 갱신: 속도 측정 + 당첨 줄 도착 시각 기록
function updateReel(st, ys, t) {
  if (st.prev && t > st.prev.t) {
    const dt = t - st.prev.t;
    let moved = false;
    for (const y of ys) {
      let best = null;
      for (const py of st.prev.ys) {
        const d = (y - py) * cfg.dir;
        if (d > 2 && d < winH * 0.9 && (best === null || d < best)) best = d;
      }
      if (best !== null) { st.vs.push(best / dt); moved = true; }
    }
    if (st.vs.length > 20) st.vs = st.vs.slice(-20);
    const same = ys.length === st.prev.ys.length && ys.every((y, i) => Math.abs(y - st.prev.ys[i]) < 3);
    st.stillFrames = same && !moved ? st.stillFrames + 1 : 0;
  }
  st.prev = { t, ys };

  const v = speed(st);
  if (!v) return;
  // 각 덩어리가 당첨 줄에 도착하는 시각 추정 → 같은 통과끼리 묶어 평균
  const tolMs = (symH * 0.3) / v;
  for (const y of ys) {
    const tHit = t + ((cfg.yc - y) * cfg.dir) / v;
    let c = null;
    for (const p of st.passes) if (Math.abs(p.t - tHit) < tolMs) { c = p; break; }
    if (c) { c.t = (c.t * c.n + tHit) / (c.n + 1); c.n++; }
    else st.passes.push({ t: tHit, n: 1 });
  }
  const now = Date.now();
  st.passes = st.passes.filter(p => now - p.t < 12000);
  if (now - st.lastPFit > 500) { fitPeriod(st, tolMs); st.lastPFit = now; }
}

function speed(st) {
  if (st.vs.length < 5) return null;
  const v = median(st.vs.slice(-12));
  return v > 0.02 ? v : null; // px/ms
}

// 릴 한 바퀴 주기 P 추정: 모든 통과 시각이 P 간격으로 반복되는 최소 간격
function fitPeriod(st, tolMs) {
  const ps = st.passes.map(p => p.t).sort((a, b) => a - b);
  if (ps.length < 4) return;
  const tol = Math.max(tolMs, 25);
  const cands = [];
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
    const d = ps[j] - ps[i];
    if (d > 150) cands.push(d);
  }
  cands.sort((a, b) => a - b);
  for (const d of cands) {
    let ok = 0, diffs = [];
    for (const a of ps) {
      const m = ps.find(b => Math.abs(b - a - d) < tol) || ps.find(b => Math.abs(a - b - d) < tol);
      if (m !== undefined) { ok++; diffs.push(Math.abs(m - a)); }
    }
    if (ok >= ps.length * 0.8) { st.P = diffs.reduce((s, x) => s + x, 0) / diffs.length; return; }
  }
}

// 다음 탭 시각 계산 (현재 보이는 덩어리 직접 예측 우선, 없으면 주기 예측)
function nextPress(st, ys, t, minLead) {
  const v = speed(st);
  if (!v) return null;
  const now = Date.now();
  let best = null;
  for (const y of ys) {
    const press = t + ((cfg.yc - y) * cfg.dir) / v - latency;
    if (press > now + minLead && (best === null || press < best)) best = press;
  }
  if (best === null && st.P) {
    for (const p of st.passes) {
      if (p.n < 2) continue;
      let k = Math.ceil((now + minLead + latency - p.t) / st.P);
      const press = p.t + k * st.P - latency;
      if (best === null || press < best) best = press;
    }
  }
  return best;
}

/* ---------------- 실행 ---------------- */

const mode = dialogs.select("실행 방식", ["한 판만 (시작 버튼은 직접 누름)", "자동 반복 (시작 버튼도 자동)"]);
if (mode < 0) exit();
let rounds = 1;
if (mode === 1) rounds = parseInt(dialogs.rawInput("몇 판 반복할까요?", "20"), 10) || 20;

const ctl = floaty.window(
  '<vertical bg="#dd1f1830" padding="8">' +
  '<text id="st" textColor="#ffffff" textSize="13sp" text="준비"/>' +
  '<button id="quit" text="중지" w="90" h="44"/>' +
  '</vertical>'
);
ui.run(() => ctl.setPosition(10, 10));
ctl.quit.click(() => { STORE.put("latency", latency); exit(); });
function status(s) { ui.run(() => ctl.st.setText(s)); }

let hits = 0, total = 0;

for (let round = 1; round <= rounds; round++) {
  const states = [newState(), newState(), newState()];
  let cur = 0, phase = "track", pressT = 0, pressV = 0;
  let lastT = 0, frameDt = 60;
  const roundStart = Date.now();

  if (mode === 1) { click(cfg.start[0], cfg.start[1]); sleep(400); }
  status("판 " + round + "/" + rounds + " · 릴 1 측정 중");

  while (cur < 3) {
    if (Date.now() - roundStart > 60000) { status("시간 초과: 릴이 감지되지 않음"); break; }
    const img = captureScreen();
    const t = Date.now();
    if (lastT) frameDt = frameDt * 0.8 + (t - lastT) * 0.2;
    lastT = t;

    const ysAll = cfg.reels.map(r => findBlobs(img, r));
    for (let i = cur; i < 3; i++) updateReel(states[i], ysAll[i], t);

    const st = states[cur];
    if (phase === "track") {
      const press = nextPress(st, ysAll[cur], t, 10);
      if (press !== null && press - Date.now() < frameDt * 1.5 + 15) {
        const w = press - Date.now();
        if (w > 0) sleep(w);
        click(cfg.reels[cur].stop[0], cfg.reels[cur].stop[1]);
        pressT = Date.now(); pressV = speed(st);
        phase = "settle";
        status("릴 " + (cur + 1) + " 멈춤 확인 중");
      }
    } else {
      // 멈춘 뒤 결과 확인 → 타이밍 학습
      if (st.stillFrames >= 3 || Date.now() - pressT > 2500) {
        const ys = ysAll[cur];
        let near = null;
        for (const y of ys) if (near === null || Math.abs(y - cfg.yc) < Math.abs(near - cfg.yc)) near = y;
        let msg;
        if (near !== null) {
          const err = (near - cfg.yc) * cfg.dir;          // +면 지나침(늦음), -면 덜 옴(빠름)
          const steps = Math.round(err / symH);
          if (steps === 0 && Math.abs(err) < symH * 0.4) { msg = "맞음"; hits++; }
          else if (Math.abs(steps) <= 2 && pressV) {
            latency = clamp(latency + steps * (symH / pressV) * 0.5, LAT_MIN, LAT_MAX);
            msg = (steps > 0 ? steps + "칸 늦음" : -steps + "칸 빠름") + " → 보정";
          } else msg = "판정 불가 (게임 미끄러짐)";
        } else msg = "목표 그림 안 보임";
        total++;
        STORE.put("latency", latency);
        status("릴 " + (cur + 1) + ": " + msg + " · 지연 " + Math.round(latency) + "ms · 적중 " + hits + "/" + total);
        cur++; phase = "track";
      }
    }
  }
  if (round < rounds) sleep(2500);
}

status("완료 · 적중 " + hits + "/" + total + " · 지연 " + Math.round(latency) + "ms");
toast("완료: 적중 " + hits + "/" + total);
sleep(4000);
exit();
