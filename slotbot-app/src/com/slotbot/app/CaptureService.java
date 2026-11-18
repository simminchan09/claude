package com.slotbot.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.content.res.Configuration;
import android.graphics.PixelFormat;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.Image;
import android.media.ImageReader;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.os.SystemClock;
import android.util.DisplayMetrics;
import android.view.WindowManager;

/** 화면 캡처(포그라운드 서비스). 매 프레임을 Bot에 전달한다. */
public class CaptureService extends Service {
    public static volatile CaptureService instance;

    MediaProjection mp;
    VirtualDisplay vd;
    ImageReader reader;
    HandlerThread thread;
    Handler handler;
    int curW, curH;

    @Override public IBinder onBind(Intent i) { return null; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        nm.createNotificationChannel(new NotificationChannel("bot", "슬롯봇", NotificationManager.IMPORTANCE_LOW));
        Notification n = new Notification.Builder(this, "bot")
                .setContentTitle("슬롯봇 실행 중")
                .setContentText("화면을 보고 멈춤 버튼을 누릅니다")
                .setSmallIcon(android.R.drawable.ic_media_play)
                .build();
        if (Build.VERSION.SDK_INT >= 29) startForeground(1, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION);
        else startForeground(1, n);

        if (intent == null || mp != null) return START_NOT_STICKY;
        int code = intent.getIntExtra("code", 0);
        Intent data = intent.getParcelableExtra("data");
        MediaProjectionManager mpm = (MediaProjectionManager) getSystemService(MEDIA_PROJECTION_SERVICE);
        mp = mpm.getMediaProjection(code, data);
        if (mp == null) { stopSelf(); return START_NOT_STICKY; }

        thread = new HandlerThread("capture");
        thread.start();
        handler = new Handler(thread.getLooper());
        mp.registerCallback(new MediaProjection.Callback() {
            @Override public void onStop() { stopSelf(); }
        }, handler);

        instance = this;
        setupDisplay();
        BotService s = BotService.instance;
        if (s != null) s.showPanel();
        return START_NOT_STICKY;
    }

    void setupDisplay() {
        DisplayMetrics dm = new DisplayMetrics();
        ((WindowManager) getSystemService(WINDOW_SERVICE)).getDefaultDisplay().getRealMetrics(dm);
        int w = dm.widthPixels, h = dm.heightPixels;
        if (w == curW && h == curH && vd != null) return;
        curW = w; curH = h;
        float scale = Math.max(w, h) > 1800 ? 0.5f : 1f;
        final int cw = Math.round(w * scale), ch = Math.round(h * scale);
        ImageReader old = reader;
        reader = ImageReader.newInstance(cw, ch, PixelFormat.RGBA_8888, 3);
        reader.setOnImageAvailableListener(new ImageReader.OnImageAvailableListener() {
            @Override public void onImageAvailable(ImageReader r) {
                Image img = null;
                try {
                    img = r.acquireLatestImage();
                    if (img == null) return;
                    Image.Plane p = img.getPlanes()[0];
                    double t = img.getTimestamp() / 1e6;
                    double up = SystemClock.uptimeMillis();
                    if (Math.abs(t - up) > 1000) t = up;
                    Bot.I.onFrame(p.getBuffer(), p.getRowStride(), p.getPixelStride(), img.getWidth(), img.getHeight(), t);
                } catch (Exception ignored) {
                } finally {
                    if (img != null) img.close();
                }
            }
        }, handler);
        Bot.I.scale = scale;
        if (vd == null) {
            vd = mp.createVirtualDisplay("slotbot", cw, ch, dm.densityDpi,
                    DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR, reader.getSurface(), null, handler);
        } else {
            vd.resize(cw, ch, dm.densityDpi);
            vd.setSurface(reader.getSurface());
        }
        if (old != null) old.close();
    }

    @Override
    public void onConfigurationChanged(Configuration c) {
        super.onConfigurationChanged(c);
        if (mp != null && handler != null) {
            handler.postDelayed(new Runnable() { @Override public void run() { setupDisplay(); } }, 300);
        }
    }

    @Override
    public void onDestroy() {
        instance = null;
        Bot.I.running = false;
        BotService s = BotService.instance;
        if (s != null) s.hidePanel();
        if (vd != null) vd.release();
        if (reader != null) reader.close();
        if (mp != null) mp.stop();
        if (thread != null) thread.quitSafely();
        super.onDestroy();
    }
}
