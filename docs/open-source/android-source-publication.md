# Android source and build

The repository includes the `android-test/` native project and publishes the 0.1.4 **debug test APK** through `public/downloads/`. Use the source files below to build your own test APK; generated assets, local SDK paths and signing keys are excluded.

## Exact Android allowlist

These are the 14 Android project files included in the source publication:

```bash
git add -- \
  android-test/.gitignore \
  android-test/app/build.gradle \
  android-test/app/src/main/AndroidManifest.xml \
  android-test/app/src/main/java/work/cjchan/pos/test/MainActivity.java \
  android-test/app/src/main/res/drawable/app_icon.png \
  android-test/app/src/main/res/xml/data_extraction_rules.xml \
  android-test/app/src/main/res/xml/share_paths.xml \
  android-test/build.gradle \
  android-test/gradle.properties \
  android-test/gradle/wrapper/gradle-wrapper.jar \
  android-test/gradle/wrapper/gradle-wrapper.properties \
  android-test/gradlew \
  android-test/gradlew.bat \
  android-test/settings.gradle
```

On PowerShell, use a single line with the same paths, or use the PowerShell backtick as its line continuation character. Review the staged names with `git diff --cached --name-only` before committing. Do not use `git add -A` in this working tree: several unrelated local output and QA directories are untracked.

`android-test/.gitignore` excludes `.gradle/`, `build/`, `app/build/`, generated `app/src/main/assets/`, `local.properties`, `*.jks` and `*.keystore`. Keep generated `dist-android/` files and signing keys outside source commits.

## Build from a clean checkout

Requires Node.js 20+, JDK 17, Android SDK platform 34 and a working Android SDK location (`ANDROID_HOME`/`ANDROID_SDK_ROOT` or an untracked `android-test/local.properties`). The checked-in Gradle wrapper uses Gradle 8.14.5. The Android project declares Android Gradle Plugin 8.4.2 and `androidx.webkit:webkit:1.11.0`.

First run `npm ci`. Set `VITE_ANDROID_APP=true`, `VITE_PUBLIC_DEMO=true` and `VITE_BASE=/` for the current test variant, then build the web assets into `dist-android` and run `:app:assembleDebug` from `android-test`:

```powershell
$env:VITE_ANDROID_APP = 'true'
$env:VITE_PUBLIC_DEMO = 'true'
$env:VITE_BASE = '/'
npm run build -- --outDir dist-android
./android-test/gradlew.bat -p android-test :app:assembleDebug --console=plain
```

The generated test APK is `android-test/app/build/outputs/apk/debug/app-debug.apk`. It is debug-signed and debuggable; a reproducible public release/signing process has not been established. A contributor's own debug certificate usually differs from the published test APK, so that build will not install as an update over the published APK. Test it on a separate emulator. Back up existing merchant data before changing installations; uninstalling removes app data. The web bundle is included from `dist-android`, and the Android build embeds the source-controlled `public/assets/` and `public/icon-options/` images. Those images need a separate rights review before a repository-wide media license is asserted.

`AndroidManifest.xml` declares HTTPS VIEW/App Links for `/receive` on `pos.cj-chan.work`, with a debug certificate fingerprint in `public/.well-known/assetlinks.json`. The exact 0.1.4 APK and web/file import flow were tested, but automatic App Link association on a real phone has **not** been verified.

## Keep out of the source commit

- `android-test/.gradle/`, `android-test/build/`, `android-test/app/build/`, `android-test/app/src/main/assets/`, `dist-android/` and `releases/android/` are generated outputs.
- `android-test/local.properties`, any keystore or signing configuration are local machine or private signing material.
- `docs/releases/`, `output/`, `video-production/`, `.qa-public-release-*` and `*.zip` are local QA/release material in this working tree; review separately rather than staging wholesale. The Excel QA file includes synthetic customer contact fields and request IDs.
- The sibling `android-qa-logs/` directory is outside this repository and contains device snapshots, backups and test orders. It is not part of the open-source set.
