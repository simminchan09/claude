package com.slotbot.app;

import android.content.SharedPreferences;
import android.os.SystemClock;

import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.Arrays;

/** 화면 프레임을 분석해 멈춤 탭 시각을 계산하는 핵심 로직. 모든 좌표는 화면 픽셀 기준. */
public class Bot {
    public static final Bot I = new Bot();

    static final int TOL = 60;
    static final float LAT_MIN = -400f, LAT_MAX = 600f;

    // ---- 설정 (화면 좌표) ----
    public int[] rx = {0, 0, 0}, ry = {0, 0, 0};       // 릴별 목표 그림 색 지점
    public int[][] rcol = new int[3][3];               // 릴별 목표 색 RGB
    public int[] sx = {0, 0, 0}, sy = {0, 0, 0};       // 릴별 멈춤 버튼
    public int lx, ly;                                  // 시작(레버) 버튼
    public int top, bot, yc;                            // 릴 창 위/아래, 당첨 줄
    public int rows = 3, dir = 1;
    public boolean configured = false;

    public float latency = 80f;
    public boolean repeat = false;
    public volatile boolean running = false;
    public volatile float scale = 1f;
    public volatile boolean sampleRequest = false;

    int hits = 0, total = 0;

    // ---- 판 진행 상태 ----
    static class St {
        double prevT = -1;
        float[] prevYs = null;
        double prevSig = -1;
        float[] vs = new float[24];
        int vn = 0, vi = 0;
        ArrayList<double[]> passes = new ArrayList<double[]>(); // {t, n}
        double P = 0;
        double lastFit = 0;
        double stillSince = -1;
    }

    St[] st;
    int cur = 0;
    boolean settling = false;
    double pressT = 0;
    float pressV = 0;
    double roundStart = 0, roundDoneAt = -1, lastT = 0, frameDt = 16;

    // ---------------- 저장/불러오기 ----------------

    public void load(SharedPreferences p) {
        String s = p.getString("cfg", null);
        if (s != null) {
            try {
                String[] a = s.split(",");
                int k = 0;
                for (int i = 0; i < 3; i++) { rx[i] = Integer.parseInt(a[k++]); ry[i] = Integer.parseInt(a[k++]); }
                for (int i = 0; i < 3; i++) for (int j = 0; j < 3; j++) rcol[i][j] = Integer.parseInt(a[k++]);
                for (int i = 0; i < 3; i++) { sx[i] = Integer.parseInt(a[k++]); sy[i] = Integer.parseInt(a[k++]); }
                lx = Integer.parseInt(a[k++]); ly = Integer.parseInt(a[k++]);
                top = Integer.parseInt(a[k++]); bot = Integer.parseInt(a[k++]); yc = Integer.parseInt(a[k++]);
                rows = Integer.parseInt(a[k++]); dir = Integer.parseInt(a[k++]);
                configured = Integer.parseInt(a[k++]) == 1;
            } catch (Exception e) { configured = false; }
        }
        latency = p.getFloat("latency", 80f);
        repeat = p.getBoolean("repeat", false);
    }

    public void save(SharedPreferences p) {
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < 3; i++) b.append(rx[i]).append(',').append(ry[i]).append(',');
        for (int i = 0; i < 3; i++) for (int j = 0; j < 3; j++) b.append(rcol[i][j]).append(',');
        for (int i = 0; i < 3; i++) b.append(sx[i]).append(',').append(sy[i]).append(',');
        b.append(lx).append(',').append(ly).append(',').append(top).append(',').append(bot).append(',').append(yc)
         .append(',').append(rows).append(',').append(dir).append(',').append(configured ? 1 : 0);
        p.edit().putString("cfg", b.toString()).putFloat("latency", latency).putBoolean("repeat", repeat).apply();
    }

    // ---------------- 제어 ----------------

    public void start() {
        if (!configured) { status("먼저 '위치 설정'을 해 주세요"); return; }
        hits = 0; total = 0;
        newRound(SystemClock.uptimeMillis(), true);
        running = true;
        status(repeat ? "자동 반복 시작" : "대기 중 · 슬롯을 돌리면 자동으로 멈춥니다");
    }

    public void stop(String msg) {
        running = false;
        if (msg != null) status(msg);
        BotService s = BotService.instance;
        if (s != null) s.onBotStopped();
    }

    void newRound(double t, boolean first) {
        st = new St[]{new St(), new St(), new St()};
        cur = 0; settling = false; roundStart = t; roundDoneAt = -1;
        if (repeat) tap(lx, ly, 0);
    }

    // ---------------- 프레임 처리 (캡처 스레드) ----------------

    public void onFrame(ByteBuffer buf, int rs, int ps, int w, int h, double t) {
        if (sampleRequest) { sample(buf, rs, ps, w, h); sampleRequest = false; }
        if (!running || !configured || st == null) return;
        if (lastT > 0) frameDt = frameDt * 0.9 + Math.min(200, t - lastT) * 0.1;
        lastT = t;

        if (cur >= 3) {
            if (repeat) { if (t - roundDoneAt > 2500) newRound(t, false); }
            else newRound(t, false);
            return;
        }
        if (repeat && !settling && st[cur].vn == 0 && t - roundStart > 20000) {
            stop("20초 동안 릴이 돌지 않아 멈췄습니다");
            return;
        }

        float[][] ys = new float[3][];
        double[] sig = new double[1];
        for (int i = cur; i < 3; i++) {
            ys[i] = findBlobs(buf, rs, ps, w, h, i, sig);
            update(st[i], ys[i], sig[0], t);
        }
        St s = st[cur];
        if (!settling) {
            double press = nextPress(s, ys[cur], t, 8);
            double now = SystemClock.uptimeMillis();
            if (press > 0 && press - now < frameDt * 1.5 + 15) {
                tap(sx[cur], sy[cur], press);
                settling = true; pressT = press; pressV = speed(s);
                status("릴 " + (cur + 1) + " 멈춤 탭");
            }
        } else if (t > pressT + 120) {
            boolean done = (s.stillSince > 0 && t - s.stillSince >= 250) || t - pressT > 2500;
            if (done) evaluate(ys[cur], t, s);
        }
    }

    void evaluate(float[] ys, double t, St s) {
        float symH = (bot - top) / (float) rows;
        float near = Float.NaN;
        for (float y : ys) if (Float.isNaN(near) || Math.abs(y - yc) < Math.abs(near - yc)) near = y;
        String msg;
        if (!Float.isNaN(near)) {
            float err = (near - yc) * dir;
            int steps = Math.round(err / symH);
            if (steps == 0 && Math.abs(err) < symH * 0.4f) { msg = "맞음"; hits++; }
            else if (Math.abs(steps) <= 2 && pressV > 0) {
                latency = clamp(latency + steps * (symH / pressV) * 0.5f, LAT_MIN, LAT_MAX);
                msg = (steps > 0 ? steps + "칸 늦음" : (-steps) + "칸 빠름") + " → 보정";
            } else msg = coarse(s) ? "많이 어긋남 → 멈춘 시각으로 보정" : "판정 불가";
        } else msg = coarse(s) ? "7이 창 밖 → 멈춘 시각으로 보정" : "목표 그림 안 보임";
        total++;
        BotService svc = BotService.instance;
        if (svc != null) svc.saveLatency(latency);
        status("릴 " + (cur + 1) + ": " + msg + "\n적중 " + hits + "/" + total + " · 지연 " + Math.round(latency) + "ms");
        cur++;
        settling = false;
        if (cur >= 3) roundDoneAt = t;
    }

    // 7이 안 보일 만큼 어긋났을 때: 탭 후 릴이 실제로 멈춘 시각으로 지연을 직접 추정
    boolean coarse(St s) {
        if (s.stillSince <= 0) return false;
        double stopT = s.stillSince - frameDt / 2;
        double lag = stopT - pressT;          // 탭 → 릴 정지까지 걸린 시간
        if (lag < -50 || lag > 1500) return false;
        latency = clamp(latency * 0.3f + (float) lag * 0.7f, LAT_MIN, LAT_MAX);
        return true;
    }

    // 릴 세로줄에서 목표 색 덩어리 중심(y, 화면 좌표)을 찾고, 정지 판정용 줄 밝기 합도 계산
    float[] findBlobs(ByteBuffer b, int rs, int ps, int w, int h, int reel, double[] sigOut) {
        float sc = scale;
        int cx = (int) (rx[reel] * sc);
        int y0 = (int) (top * sc) + 2, y1 = Math.min(h - 1, (int) (bot * sc) - 2);
        int step = sc >= 0.75f ? 2 : 1;
        int dx = Math.max(1, (int) (4 * sc));
        int[] xs = {cx - dx, cx, cx + dx};
        int[] c = rcol[reel];
        float minRun = 4 * sc;
        float[] out = new float[16];
        int n = 0, runStart = -1;
        double sig = 0;
        int lim = b.limit();
        for (int y = y0; y <= y1; y += step) {
            boolean hit = false;
            for (int k = 0; k < 3; k++) {
                int x = xs[k];
                if (x < 0 || x >= w) continue;
                int off = y * rs + x * ps;
                if (off + 2 >= lim) continue;
                int r = b.get(off) & 0xff, g = b.get(off + 1) & 0xff, bl = b.get(off + 2) & 0xff;
                if (k == 1) sig += r + g + bl;
                if (Math.abs(r - c[0]) + Math.abs(g - c[1]) + Math.abs(bl - c[2]) <= TOL) hit = true;
            }
            if (hit) {
                if (runStart < 0) runStart = y;
            } else if (runStart >= 0) {
                int end = y - step;
                if (end - runStart >= minRun && runStart > y0 && n < out.length) out[n++] = ((runStart + end) / 2f) / sc;
                runStart = -1;
            }
        }
        sigOut[0] = sig;
        return Arrays.copyOf(out, n);
    }

    void update(St s, float[] ys, double sig, double t) {
        float winH = bot - top;
        if (s.prevYs != null && t > s.prevT) {
            double dt = t - s.prevT;
            for (float y : ys) {
                float best = -1;
                for (float py : s.prevYs) {
                    float d = (y - py) * dir;
                    if (d > 2 && d < winH * 0.9f && (best < 0 || d < best)) best = d;
                }
                if (best > 0) {
                    s.vs[s.vi] = (float) (best / dt);
                    s.vi = (s.vi + 1) % s.vs.length;
                    if (s.vn < s.vs.length) s.vn++;
                }
            }
            boolean still = s.prevSig > 0 && Math.abs(sig - s.prevSig) < s.prevSig * 0.004;
            if (still) { if (s.stillSince < 0) s.stillSince = t; } else s.stillSince = -1;
        }
        s.prevYs = ys; s.prevT = t; s.prevSig = sig;

        float v = speed(s);
        if (v <= 0) return;
        float symH = winH / rows;
        double tolMs = symH * 0.3 / v;
        for (float y : ys) {
            double tHit = t + ((yc - y) * dir) / v;
            double[] c = null;
            for (double[] p : s.passes) if (Math.abs(p[0] - tHit) < tolMs) { c = p; break; }
            if (c != null) { c[0] = (c[0] * c[1] + tHit) / (c[1] + 1); c[1]++; }
            else s.passes.add(new double[]{tHit, 1});
        }
        for (int i = s.passes.size() - 1; i >= 0; i--) if (t - s.passes.get(i)[0] > 12000) s.passes.remove(i);
        if (t - s.lastFit > 500) { fitPeriod(s, tolMs); s.lastFit = t; }
    }

    float speed(St s) {
        if (s.vn < 5) return 0;
        int m = Math.min(s.vn, 12);
        float[] a = new float[m];
        for (int i = 0; i < m; i++) a[i] = s.vs[(s.vi - 1 - i + s.vs.length) % s.vs.length];
        Arrays.sort(a);
        float v = m % 2 == 1 ? a[m / 2] : (a[m / 2 - 1] + a[m / 2]) / 2f;
        return v > 0.02f ? v : 0;
    }

    // 릴 한 바퀴 주기: 모든 통과 시각이 같은 간격으로 반복되는 가장 짧은 간격
    void fitPeriod(St s, double tolMs) {
        int n = s.passes.size();
        if (n < 4) return;
        double[] ps = new double[n];
        for (int i = 0; i < n; i++) ps[i] = s.passes.get(i)[0];
        Arrays.sort(ps);
        double tol = Math.max(tolMs, 25);
        ArrayList<Double> cands = new ArrayList<Double>();
        for (int i = 0; i < n; i++) for (int j = i + 1; j < n; j++) { double d = ps[j] - ps[i]; if (d > 150) cands.add(d); }
        java.util.Collections.sort(cands);
        double last = ps[n - 1];
        for (Double dd : cands) {
            double d = dd;
            int ok = 0, eligible = 0; double sum = 0;
            for (double a : ps) {
                if (a + d > last + tol) continue;          // 관측 범위 밖은 판단 제외
                eligible++;
                for (double b : ps) if (Math.abs(b - a - d) < tol) { ok++; sum += b - a; break; }
            }
            if (eligible >= 2 && ok >= eligible * 0.8) { s.P = sum / ok; return; }
        }
    }

    double nextPress(St s, float[] ys, double t, double minLead) {
        float v = speed(s);
        if (v <= 0) return -1;
        double now = SystemClock.uptimeMillis();
        double best = -1;
        for (float y : ys) {
            double press = t + ((yc - y) * dir) / v - latency;
            if (press > now + minLead && (best < 0 || press < best)) best = press;
        }
        if (best < 0 && s.P > 0) {
            for (double[] p : s.passes) {
                if (p[1] < 2) continue;
                double k = Math.ceil((now + minLead + latency - p[0]) / s.P);
                double press = p[0] + k * s.P - latency;
                if (best < 0 || press < best) best = press;
            }
        }
        return best;
    }

    void sample(ByteBuffer b, int rs, int ps, int w, int h) {
        float sc = scale;
        for (int i = 0; i < 3; i++) {
            int cx = (int) (rx[i] * sc), cy = (int) (ry[i] * sc);
            long r = 0, g = 0, bl = 0; int n = 0;
            for (int dy = -2; dy <= 2; dy++) for (int dx = -2; dx <= 2; dx++) {
                int x = cx + dx, y = cy + dy;
                if (x < 0 || y < 0 || x >= w || y >= h) continue;
                int off = y * rs + x * ps;
                r += b.get(off) & 0xff; g += b.get(off + 1) & 0xff; bl += b.get(off + 2) & 0xff; n++;
            }
            if (n > 0) { rcol[i][0] = (int) (r / n); rcol[i][1] = (int) (g / n); rcol[i][2] = (int) (bl / n); }
        }
        configured = true;
        BotService s = BotService.instance;
        if (s != null) s.onSampled();
    }

    // ---------------- 헬퍼 ----------------

    void tap(int x, int y, double atMs) {
        BotService s = BotService.instance;
        if (s != null) s.tapAt(x, y, atMs);
    }

    void status(String m) {
        BotService s = BotService.instance;
        if (s != null) s.setStatus(m);
    }

    static float clamp(float v, float lo, float hi) { return Math.max(lo, Math.min(hi, v)); }
}
