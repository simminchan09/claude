package com.slotbot.app;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.media.projection.MediaProjectionManager;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

public class MainActivity extends Activity {
    static final int REQ = 7;
    TextView state;

    int dp(float v) { return Math.round(v * getResources().getDisplayMetrics().density); }

    TextView text(String s, float size, int color) {
        TextView t = new TextView(this);
        t.setText(s); t.setTextSize(size); t.setTextColor(color);
        t.setLineSpacing(0, 1.3f);
        t.setPadding(0, dp(6), 0, dp(6));
        return t;
    }

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        LinearLayout l = new LinearLayout(this);
        l.setOrientation(LinearLayout.VERTICAL);
        l.setPadding(dp(20), dp(24), dp(20), dp(24));
        l.setBackgroundColor(0xFF14101F);

        l.addView(text("슬롯봇", 26, 0xFFFFCF3F));
        state = text("", 15, 0xFF4FE0A8);
        l.addView(state);

        Button a = new Button(this);
        a.setText("1. 접근성 설정 열기");
        a.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)); }
        });
        l.addView(a);
        l.addView(text("접근성 → 설치된 앱(또는 설치된 서비스) → 슬롯봇 → 켜기.\n'제한된 설정'이라고 막히면: 태블릿 설정 → 애플리케이션 → 슬롯봇 → 오른쪽 위 ⋮ → '제한된 설정 허용' 후 다시 켜세요.", 13, 0xFFA79CC2));

        Button c = new Button(this);
        c.setText("2. 봇 켜기 (화면 녹화 허용)");
        c.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                if (BotService.instance == null) {
                    Toast.makeText(MainActivity.this, "먼저 1번에서 접근성 권한을 켜 주세요", Toast.LENGTH_LONG).show();
                    return;
                }
                MediaProjectionManager m = (MediaProjectionManager) getSystemService(MEDIA_PROJECTION_SERVICE);
                startActivityForResult(m.createScreenCaptureIntent(), REQ);
            }
        });
        l.addView(c);
        l.addView(text("허용 창이 뜨면 '전체 화면'을 고르고 '시작'을 누르세요. 그다음 게임으로 가면 조작 창이 떠 있습니다.", 13, 0xFFA79CC2));

        l.addView(text("사용법", 17, Color.WHITE));
        l.addView(text(
                "① 게임코너 슬롯 앞에 앉아, 가운데 줄에 7이 보이는 화면에서 조작 창의 '위치 설정'을 누릅니다. (7이 다른 줄에 있어도 됩니다. 7이 보이기만 하면 됩니다)\n" +
                "② 빨간 동그라미 1·2·3을 각 릴의 7 한가운데에 놓습니다.\n" +
                "③ 초록 '탭'은 봇이 누를 곳입니다. 오른쪽 검은 화면처럼 아무 버튼도 없는 곳에 두세요. 왼쪽 B 버튼(그만두기) 위는 안 됩니다.\n" +
                "④ 노란 선 두 개를 릴 창 위끝·아래끝에, 파란 선을 가운데 줄(1번 줄)에 맞춥니다.\n" +
                "⑤ '설정 완료' → '봇 시작'. 자동 반복을 켜면 돌리기까지 봇이 계속 합니다.\n\n" +
                "봇이 멈춘 결과를 보고 타이밍을 스스로 보정하므로 처음 몇 판은 한 칸씩 어긋날 수 있습니다. " +
                "게임이 결과를 미리 정하고 릴을 미는 방식이면 정확히 눌러도 매번 맞지는 않습니다.", 14, 0xFFF3EEFC));

        ScrollView sv = new ScrollView(this);
        sv.setBackgroundColor(0xFF14101F);
        sv.addView(l);
        setContentView(sv);
    }

    @Override
    protected void onResume() {
        super.onResume();
        String s = (BotService.instance != null ? "✔ 접근성 켜짐" : "✘ 접근성 꺼짐") + "   " +
                (CaptureService.instance != null ? "✔ 봇 실행 중" : "✘ 봇 꺼짐");
        state.setText(s);
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        if (req != REQ) return;
        if (res != RESULT_OK || data == null) {
            Toast.makeText(this, "화면 녹화를 허용해야 봇이 화면을 볼 수 있습니다", Toast.LENGTH_LONG).show();
            return;
        }
        Intent i = new Intent(this, CaptureService.class);
        i.putExtra("code", res);
        i.putExtra("data", data);
        startForegroundService(i);
        Toast.makeText(this, "봇이 켜졌습니다. 게임으로 이동하세요", Toast.LENGTH_LONG).show();
        moveTaskToBack(true);
    }
}
