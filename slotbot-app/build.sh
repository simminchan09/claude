#!/bin/bash
# 빌드: aapt + javac + dx + apksigner (Ubuntu 패키지와 android-34 android.jar 사용)
set -e
cd "$(dirname "$0")"
JAR=${ANDROID_JAR:-/root/asdk/android-34.jar}
rm -rf build && mkdir -p build/gen build/classes build/apk
aapt package -f -m -J build/gen -M AndroidManifest.xml -S res -I "$JAR" -F build/apk/base.apk
javac -nowarn -encoding UTF-8 -source 8 -target 8 -bootclasspath "$JAR" -d build/classes $(find src build/gen -name '*.java') 2>&1 | grep -v 'bootstrap\|warning' || true
dalvik-exchange --dex --min-sdk-version=26 --output=build/apk/classes.dex build/classes
(cd build/apk && zip -q base.apk classes.dex)
zipalign -f 4 build/apk/base.apk build/aligned.apk
[ -f debug.keystore ] || keytool -genkeypair -keystore debug.keystore -storepass android -keypass android -alias key -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=slotbot" >/dev/null 2>&1
apksigner sign --ks debug.keystore --ks-pass pass:android --key-pass pass:android --out slotbot.apk build/aligned.apk
apksigner verify slotbot.apk && ls -l slotbot.apk
