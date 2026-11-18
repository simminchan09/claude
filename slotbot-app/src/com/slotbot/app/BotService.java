package com.slotbot.app;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.Looper;
import android.util.DisplayMetrics;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.view.accessibility.AccessibilityEvent;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

/** 접근성 서비스: 화면 위 조작 창/터치 지점 표시, 자동 탭 실행. */
public class BotService extends AccessibilityService {
    public static volatile BotService instance;

    WindowManager wm;
    Handler main;
    Handler tapHandler;
    HandlerThread tapThread;
    SharedPreferences prefs;

    LinearLayout panel;
    WindowManager.LayoutParams panelLp;
    TextView statusView;
    Button bSetup, bRun, bRepeat, bRows, bDir;
    LinearLayout setupRow;

    boolean setupMode = false;
    Marker[] markers;          // 0..2 릴 색 지점, 3..5 멈춤 버튼, 6 레버, 7 위끝, 8 당첨줄, 9 아래끝
    WindowManager.LayoutParams[] markerLp;

    @Override
    protected void onServiceConnected() {
        instance = this;
        wm = (WindowManager) getSystemService(WINDOW_SERVICE);
        main = new Handler(Looper.getMainLooper());
        tapThread = new HandlerThread("tap");
        tapThread.start();
        tapHandler = new Handler(tapThread.getLooper());
        prefs = getSharedPreferences("slotbot", MODE_PRIVATE);
        Bot.I.load(prefs);
        if (CaptureService.instance != null) showPanel();
    }

    @Override public void onAccessibilityEvent(AccessibilityEvent e) {}
    @Override public void onInterrupt() {}

    @Override
    public boolean onUnbind(android.content.Intent i) {
        Bot.I.running = false;
        hidePanel();
        instance = null;
        if (tapThread != null) tapThread.quitSafely();
        return super.onUnbind(i);
    }

    int dp(float v) { return Math.round(v * getResources().getDisplayMetrics().density); }

    // ---------------- 자동 탭 ----------------

    public void tapAt(final int x, final int y, double atMs) {
        Runnable r = new Runnable() {
            @Override public void run() {
                Path p = new Path();
                p.moveTo(x, y);
                GestureDescription.StrokeDescription sd = new GestureDescription.StrokeDescription(p, 0, 40);
                dispatchGesture(new GestureDescription.Builder().addStroke(sd).build(), null, null);
            }
        };
        if (atMs <= 0) tapHandler.post(r);
        else tapHandler.postAtTime(r, (long) atMs);
    }

    public void saveLatency(float l) { prefs.edit().putFloat("latency", l).apply(); }

    public void setStatus(final String s) {
        main.post(new Runnable() { @Override public void run() { if (statusView != null) statusView.setText(s); } });
    }

    public void onBotStopped() {
        main.post(new Runnable() { @Override public void run() { refreshButtons(); } });
    }

    public void onSampled() {
        Bot.I.save(prefs);
        main.post(new Runnable() {
            @Override public void run() {
                int[] c = Bot.I.rcol[0];
                statusView.setText("설정 저장됨 (릴1 색 " + c[0] + "," + c[1] + "," + c[2] + ")\n'봇 시작'을 누르세요");
                refreshButtons();
            }
        });
    }

    // ---------------- 조작 창 ----------------

    WindowManager.LayoutParams overlayLp(int w, int h, boolean touchable) {
        WindowManager.LayoutParams lp = new WindowManager.LayoutParams(w, h,
                WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                        | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                        | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
                        | (touchable ? 0 : WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE),
                PixelFormat.TRANSLUCENT);
        lp.gravity = Gravity.TOP | Gravity.LEFT;
        return lp;
    }

    Button btn(String text, View.OnClickListener l) {
        Button b = new Button(this);
        b.setText(text);
        b.setTextSize(13);
        b.setAllCaps(false);
        b.setMinWidth(0); b.setMinimumWidth(0); b.setMinHeight(0); b.setMinimumHeight(0);
        b.setPadding(dp(10), dp(6), dp(10), dp(6));
        b.setOnClickListener(l);
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1);
        p.setMargins(dp(2), dp(2), dp(2), dp(2));
        b.setLayoutParams(p);
        return b;
    }

    LinearLayout row() {
        LinearLayout r = new LinearLayout(this);
        r.setOrientation(LinearLayout.HORIZONTAL);
        return r;
    }

    public void showPanel() {
        main.post(new Runnable() { @Override public void run() { showPanelNow(); } });
    }

    void showPanelNow() {
        if (panel != null) return;
        panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setPadding(dp(8), dp(6), dp(8), dp(8));
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(0xEE1F1830);
        bg.setCornerRadius(dp(12));
        bg.setStroke(dp(1), 0xFF3A2F55);
        panel.setBackground(bg);

        TextView title = new TextView(this);
        title.setText("☰ 슬롯봇  (여기를 끌어서 이동)");
        title.setTextColor(0xFFFFCF3F);
        title.setTextSize(13);
        title.setPadding(dp(4), dp(4), dp(4), dp(6));
        panel.addView(title);

        statusView = new TextView(this);
        statusView.setTextColor(0xFFF3EEFC);
        statusView.setTextSize(12);
        statusView.setMaxWidth(dp(250));
        statusView.setPadding(dp(4), 0, dp(4), dp(6));
        statusView.setText(Bot.I.configured ? "준비됨 · '봇 시작'을 누르세요" : "'위치 설정'부터 하세요");
        panel.addView(statusView);

        LinearLayout r1 = row();
        bSetup = btn("위치 설정", new View.OnClickListener() { @Override public void onClick(View v) { toggleSetup(); } });
        bRun = btn("봇 시작", new View.OnClickListener() {
            @Override public void onClick(View v) {
                if (Bot.I.running) Bot.I.stop("정지함"); else Bot.I.start();
                refreshButtons();
            }
        });
        r1.addView(bSetup); r1.addView(bRun);
        panel.addView(r1);

        LinearLayout r2 = row();
        bRepeat = btn("", new View.OnClickListener() {
            @Override public void onClick(View v) { Bot.I.repeat = !Bot.I.repeat; Bot.I.save(prefs); refreshButtons(); }
        });
        Button bQuit = btn("종료", new View.OnClickListener() {
            @Override public void onClick(View v) {
                Bot.I.running = false;
                if (CaptureService.instance != null) CaptureService.instance.stopSelf();
                hidePanel();
            }
        });
        r2.addView(bRepeat); r2.addView(bQuit);
        panel.addView(r2);

        setupRow = row();
        bRows = btn("", new View.OnClickListener() {
            @Override public void onClick(View v) {
                Bot.I.rows = Bot.I.rows == 3 ? 5 : Bot.I.rows == 5 ? 1 : 3; refreshButtons();
            }
        });
        bDir = btn("", new View.OnClickListener() {
            @Override public void onClick(View v) { Bot.I.dir = -Bot.I.dir; refreshButtons(); }
        });
        setupRow.addView(bRows); setupRow.addView(bDir);
        setupRow.setVisibility(View.GONE);
        panel.addView(setupRow);

        panelLp = overlayLp(WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT, true);
        panelLp.x = dp(12); panelLp.y = dp(12);
        title.setOnTouchListener(new Drag(panel, panelLp, false));
        wm.addView(panel, panelLp);
        refreshButtons();
    }

    void refreshButtons() {
        if (panel == null) return;
        bRun.setText(Bot.I.running ? "봇 정지" : "봇 시작");
        bRun.setEnabled(!setupMode);
        bSetup.setText(setupMode ? "설정 완료" : "위치 설정");
        bSetup.setEnabled(!Bot.I.running);
        bRepeat.setText(Bot.I.repeat ? "자동 반복: 켬" : "자동 반복: 끔");
        bRows.setText("보이는 칸: " + Bot.I.rows);
        bDir.setText(Bot.I.dir > 0 ? "회전: 아래로" : "회전: 위로");
        setupRow.setVisibility(setupMode ? View.VISIBLE : View.GONE);
    }

    public void hidePanel() {
        main.post(new Runnable() {
            @Override public void run() {
                removeMarkers();
                setupMode = false;
                if (panel != null) { try { wm.removeView(panel); } catch (Exception ignored) {} panel = null; }
            }
        });
    }

    // ---------------- 위치 설정 (터치 지점 표시) ----------------

    void toggleSetup() {
        if (!setupMode) {
            Bot.I.running = false;
            setupMode = true;
            showMarkers();
            statusView.setText("릴이 멈춘 화면에서 표시를 끌어 놓으세요\n1·2·3: 릴의 7(목표 그림) 진한 색 위\nS1·S2·S3: 멈춤 버튼, 레버: 시작 버튼\n선: 릴 창 위끝·당첨 줄·아래끝");
        } else {
            readMarkers();
            removeMarkers();
            setupMode = false;
            statusView.setText("색 읽는 중…");
            main.postDelayed(new Runnable() { @Override public void run() { Bot.I.sampleRequest = true; } }, 400);
        }
        refreshButtons();
    }

    void showMarkers() {
        DisplayMetrics dm = new DisplayMetrics();
        wm.getDefaultDisplay().getRealMetrics(dm);
        int W = dm.widthPixels, H = dm.heightPixels;
        Bot b = Bot.I;
        boolean has = b.top > 0 && b.bot > b.top;
        String[] labels = {"1", "2", "3", "S1", "S2", "S3", "레버", "릴 창 위끝", "당첨 줄", "릴 창 아래끝"};
        int[] colors = {0xFFFF4F7A, 0xFFFF4F7A, 0xFFFF4F7A, 0xFF4FE0A8, 0xFF4FE0A8, 0xFF4FE0A8, 0xFF5AB4FF, 0xFFFFCF3F, 0xFFFF4F7A, 0xFFFFCF3F};
        int[][] pos = new int[10][2];
        for (int i = 0; i < 3; i++) {
            pos[i] = has ? new int[]{b.rx[i], b.ry[i]} : new int[]{(int) (W * (0.35 + 0.15 * i)), (int) (H * 0.45)};
            pos[3 + i] = has ? new int[]{b.sx[i], b.sy[i]} : new int[]{(int) (W * (0.35 + 0.15 * i)), (int) (H * 0.8)};
        }
        pos[6] = has ? new int[]{b.lx, b.ly} : new int[]{(int) (W * 0.85), (int) (H * 0.55)};
        pos[7] = new int[]{0, has ? b.top : (int) (H * 0.3)};
        pos[8] = new int[]{0, has ? b.yc : (int) (H * 0.45)};
        pos[9] = new int[]{0, has ? b.bot : (int) (H * 0.6)};

        markers = new Marker[10];
        markerLp = new WindowManager.LayoutParams[10];
        int ms = dp(56), lh = dp(36);
        // 선을 먼저 추가해 동그라미 표시가 위에 오도록
        for (int k = 7; k <= 9; k++) addMarker(k, labels[k], colors[k], true, pos[k], W, lh);
        for (int k = 0; k <= 6; k++) addMarker(k, labels[k], colors[k], false, pos[k], ms, ms);
        // 조작 창을 맨 위로
        try { wm.removeView(panel); wm.addView(panel, panelLp); } catch (Exception ignored) {}
    }

    void addMarker(int k, String label, int color, boolean line, int[] p, int w, int h) {
        Marker m = new Marker(this, label, color, line);
        WindowManager.LayoutParams lp = overlayLp(line ? WindowManager.LayoutParams.MATCH_PARENT : w, h, true);
        lp.x = line ? 0 : p[0] - w / 2;
        lp.y = p[1] - h / 2;
        m.setOnTouchListener(new Drag(m, lp, line));
        wm.addView(m, lp);
        markers[k] = m;
        markerLp[k] = lp;
    }

    int[] center(int k) {
        int[] loc = new int[2];
        markers[k].getLocationOnScreen(loc);
        return new int[]{loc[0] + markers[k].getWidth() / 2, loc[1] + markers[k].getHeight() / 2};
    }

    void readMarkers() {
        if (markers == null) return;
        Bot b = Bot.I;
        for (int i = 0; i < 3; i++) {
            int[] c = center(i); b.rx[i] = c[0]; b.ry[i] = c[1];
            int[] s = center(3 + i); b.sx[i] = s[0]; b.sy[i] = s[1];
        }
        int[] l = center(6); b.lx = l[0]; b.ly = l[1];
        int a = center(7)[1], c = center(9)[1];
        b.top = Math.min(a, c); b.bot = Math.max(a, c);
        b.yc = center(8)[1];
    }

    void removeMarkers() {
        if (markers == null) return;
        for (Marker m : markers) if (m != null) { try { wm.removeView(m); } catch (Exception ignored) {} }
        markers = null;
    }

    class Drag implements View.OnTouchListener {
        final View target; final WindowManager.LayoutParams lp; final boolean vertOnly;
        float sx, sy; int ox, oy;
        Drag(View target, WindowManager.LayoutParams lp, boolean vertOnly) { this.target = target; this.lp = lp; this.vertOnly = vertOnly; }
        @Override public boolean onTouch(View v, MotionEvent e) {
            switch (e.getActionMasked()) {
                case MotionEvent.ACTION_DOWN:
                    sx = e.getRawX(); sy = e.getRawY(); ox = lp.x; oy = lp.y; return true;
                case MotionEvent.ACTION_MOVE:
                    if (!vertOnly) lp.x = ox + Math.round(e.getRawX() - sx);
                    lp.y = oy + Math.round(e.getRawY() - sy);
                    wm.updateViewLayout(target, lp);
                    return true;
            }
            return true;
        }
    }

    /** 터치 지점 표시: 가운데가 비어 있는 동그라미(아래 그림이 보이도록) 또는 가로선 */
    static class Marker extends View {
        final String label; final int color; final boolean line;
        final Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        Marker(Context c, String label, int color, boolean line) { super(c); this.label = label; this.color = color; this.line = line; }
        @Override protected void onDraw(Canvas cv) {
            float d = getResources().getDisplayMetrics().density;
            int w = getWidth(), h = getHeight();
            if (line) {
                p.setStyle(Paint.Style.FILL);
                p.setColor(color);
                cv.drawRect(0, h / 2f - d, w, h / 2f + d, p);
                p.setTextSize(13 * d);
                float tw = p.measureText(label);
                p.setColor(0xCC000000);
                cv.drawRect(8 * d, h / 2f - 22 * d, 16 * d + tw, h / 2f - 3 * d, p);
                p.setColor(color);
                cv.drawText(label, 12 * d, h / 2f - 7 * d, p);
            } else {
                float r = Math.min(w, h) / 2f - 3 * d;
                p.setStyle(Paint.Style.STROKE);
                p.setStrokeWidth(3 * d);
                p.setColor(color);
                cv.drawCircle(w / 2f, h / 2f, r, p);
                p.setStrokeWidth(1.5f * d);
                cv.drawLine(w / 2f - r, h / 2f, w / 2f - 6 * d, h / 2f, p);
                cv.drawLine(w / 2f + 6 * d, h / 2f, w / 2f + r, h / 2f, p);
                cv.drawLine(w / 2f, h / 2f - r, w / 2f, h / 2f - 6 * d, p);
                cv.drawLine(w / 2f, h / 2f + 6 * d, w / 2f, h / 2f + r, p);
                p.setStyle(Paint.Style.FILL);
                p.setTextSize(11 * d);
                float tw = p.measureText(label);
                p.setColor(0xDD000000);
                cv.drawRect(w / 2f - tw / 2 - 3 * d, h - 15 * d, w / 2f + tw / 2 + 3 * d, h - 2 * d, p);
                p.setColor(Color.WHITE);
                cv.drawText(label, w / 2f - tw / 2, h - 5 * d, p);
            }
        }
    }
}
