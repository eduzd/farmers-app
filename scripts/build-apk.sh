set -euo pipefail
sudo apt-get update -qq && sudo apt-get install -y -qq faketime
npm ci --no-audit --no-fund || npm install --no-audit --no-fund
node scripts/apk-prepare.mjs
npx expo prebuild -p android --clean --no-install
printf '\nreactNativeArchitectures=arm64-v8a,armeabi-v7a\norg.gradle.jvmargs=-Xmx6g -XX:MaxMetaspaceSize=1g\n' >> android/gradle.properties
cd android
./gradlew assembleRelease --no-daemon
cd ..
node scripts/apk-key.mjs
if [ -f scripts/farmers-release-cert.der ]; then cp scripts/farmers-release-cert.der cert.der; else faketime '2026-11-24 00:00:00' openssl req -x509 -new -key key.pem -sha256 -days 18250 -set_serial 109 -subj "/CN=Farmers/O=Farmers/C=BD" -outform DER -out cert.der; fi
BT=$(ls -d "$ANDROID_HOME"/build-tools/* | sort -V | tail -1)
mkdir -p out
"$BT/apksigner" sign --key key.pk8 --cert cert.der --out out/Farmers-v1.0.9.apk android/app/build/outputs/apk/release/app-release.apk
rm -f key.pem key.pk8
"$BT/apksigner" verify --verbose --print-certs out/Farmers-v1.0.9.apk
echo "New server URL count:"; (unzip -p out/Farmers-v1.0.9.apk assets/index.android.bundle | grep -a -o 'farmers-8y5j.onrender.com' | wc -l) || true
echo "Old server URL count:"; (unzip -p out/Farmers-v1.0.9.apk assets/index.android.bundle | grep -a -o 'farmers-2ybg' | wc -l) || true
if [ ! -f scripts/farmers-release-cert.der ]; then cp cert.der scripts/farmers-release-cert.der; git config user.name "farmers-apk-bot"; git config user.email "41898282+github-actions[bot]@users.noreply.github.com"; git add scripts/farmers-release-cert.der; git commit -m "Save public APK signing certificate [skip ci]"; git push; fi
echo "GoFile upload:"; curl -s -F "file=@out/Farmers-v1.0.9.apk" https://upload.gofile.io/uploadfile; echo
