package com.slotbot.app;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;

import java.nio.ByteBuffer;
import java.util.ArrayList;

/** 진단 기록: 한 판 동안 세 릴의 가운데 세로줄을 시간 순서로 이어 붙인 이미지 + 탭/판정 표시. */
public class Diag {
    static final int MAX_FRAMES = 1500;
    final Bot b;
    final double t0;
    final int y0c, lenC;           // 캡처 좌표 기준 릴 창 범위
    final float sc;
    final ArrayList<Double> times = new ArrayList<Double>();
    final ArrayList<int[]> cols = new ArrayList<int[]>();      // 프레임별 3릴 세로줄 ARGB
    final ArrayList<float[][]> blob = new ArrayList<float[][]>();
    final ArrayList<Object[]> events = new ArrayList<Object[]>(); // {t, reel, text}
    final String header;

    Diag(Bot b, double t0) {
        this.b = b; this.t0 = t0; this.sc = b.scale;
        y0c = Math.max(0, (int) (b.top * sc) - 6);
        lenC = Math.max(1, (int) ((b.bot - b.top) * sc) + 12);
        header = "scale=" + sc + " 창 " + b.top + "~" + b.bot + " 당첨줄 " + b.yc + " 칸수 " + b.rows + " 방향 " + b.dir
                + " 허용치 " + b.tplThr[0] + "/" + b.tplThr[1] + "/" + b.tplThr[2] + " 지연 " + Math.round(b.latency) + "ms 반복 " + b.repeat;
    }

    void frame(ByteBuffer buf, int rs, int ps, int w, int h, double t) {
        if (times.size() >= MAX_FRAMES) return;
        int[] c = new int[lenC * 3];
        int lim = buf.limit();
        for (int r = 0; r < 3; r++) {
            int cx = Math.min(w - 1, Math.max(0, (int) (b.rx[r] * sc)));
            for (int i = 0; i < lenC; i++) {
                int y = Math.min(h - 1, y0c + i);
                int off = y * rs + cx * ps;
                if (off + 2 >= lim) continue;
                c[r * lenC + i] = 0xFF000000 | ((buf.get(off) & 0xff) << 16) | ((buf.get(off + 1) & 0xff) << 8) | (buf.get(off + 2) & 0xff);
            }
        }
        times.add(t);
        cols.add(c);
        blob.add(new float[3][]);
    }

    void blobs(int reel, float[] ys) {
        if (blob.isEmpty()) return;
        blob.get(blob.size() - 1)[reel] = ys;
    }

    void event(double t, int reel, String text) { events.add(new Object[]{t, reel, text}); }

    Bitmap render() {
        int n = times.size();
        int colW = n > 900 ? 1 : 2;
        int gap = 14, headH = 40, logH = 22 * (events.size() + 3);
        int W = Math.max(900, n * colW + 60), H = headH + 3 * (lenC + gap) + logH;
        Bitmap bm = Bitmap.createBitmap(W, H, Bitmap.Config.ARGB_8888);
        Canvas cv = new Canvas(bm);
        cv.drawColor(0xFF101018);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setTextSize(16);
        p.setColor(0xFFFFFFFF);
        cv.drawText(header, 6, 18, p);
        double dur = n > 1 ? times.get(n - 1) - times.get(0) : 0;
        cv.drawText("프레임 " + n + "개, " + Math.round(dur) + "ms, 평균 " + (n > 1 ? String.format("%.1f", dur / (n - 1)) : "-") + "ms/프레임", 6, 36, p);
        int x0 = 50;
        int ycC = (int) (b.yc * sc) - y0c;
        for (int r = 0; r < 3; r++) {
            int yb = headH + r * (lenC + gap);
            p.setColor(0xFFFFCF3F);
            cv.drawText("릴" + (r + 1), 4, yb + lenC / 2f, p);
            for (int f = 0; f < n; f++) {
                int[] c = cols.get(f);
                for (int i = 0; i < lenC; i++) {
                    int col = c[r * lenC + i];
                    for (int k = 0; k < colW; k++) bm.setPixel(x0 + f * colW + k, yb + i, col);
                }
                float[] ys = blob.get(f)[r];
                if (ys != null) for (float y : ys) {
                    int yy = yb + (int) (y * sc) - y0c;
                    if (yy >= yb && yy < yb + lenC) for (int k = 0; k < colW; k++) bm.setPixel(x0 + f * colW + k, yy, 0xFF00FF66);
                }
            }
            p.setColor(0x885AB4FF);
            cv.drawLine(x0, yb + ycC, x0 + n * colW, yb + ycC, p);
        }
        // 1초 눈금
        p.setColor(0x55FFFFFF);
        if (n > 1) for (double s = 0; s <= dur; s += 1000) {
            int f = frameAt(times.get(0) + s);
            cv.drawLine(x0 + f * colW, headH - 4, x0 + f * colW, headH, p);
        }
        // 이벤트
        int ly = headH + 3 * (lenC + gap) + 20;
        int k = 1;
        for (Object[] e : events) {
            double t = (Double) e[0];
            int reel = (Integer) e[1];
            int f = frameAt(t);
            int yb = headH + reel * (lenC + gap);
            p.setColor(((String) e[2]).startsWith("탭") ? 0xFFFF4F7A : 0xFFFFCF3F);
            cv.drawLine(x0 + f * colW, yb, x0 + f * colW, yb + lenC, p);
            cv.drawText(String.valueOf(k), x0 + f * colW + 2, yb + 14, p);
            p.setColor(0xFFF3EEFC);
            cv.drawText(k + ". [" + Math.round(t - t0) + "ms] 릴" + (reel + 1) + " " + e[2], 6, ly, p);
            ly += 22; k++;
        }
        return bm;
    }

    int frameAt(double t) {
        int best = 0;
        for (int i = 0; i < times.size(); i++) if (times.get(i) <= t) best = i;
        return best;
    }
}
