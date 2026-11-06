# OTT24x7 AI for Android

Native Kotlin and Jetpack Compose client for comparing signed-in AI web panels and optional OpenAI-compatible API models.

## Build

Requirements: Android SDK (API 35), Android Studio JBR 17, and a connected Android device for installation.

1. Open this `android/` directory or use the Gradle wrapper from a terminal.
2. Set `JAVA_HOME` to the Android Studio JBR and confirm `local.properties` points to the installed SDK.
3. The checked-out workspace includes a local release signing key at `keystore/ott24x7.jks` and its ignored password file at `keystore.properties`. Keep both private.
4. Build and record the Compose screenshots:

   ```powershell
   $env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
   .\gradlew.bat test lint assembleRelease
   ```

5. The distributable release APK is copied to `dist/OTT24x7-AI-1.0.apk` after the release build.

For a debug build, run `.gradlew.bat assembleDebug`. To install the release APK over USB:

```powershell
adb install -r .\dist\OTT24x7-AI-1.0.apk
```

You can also copy the APK to the phone and open it there. Android may ask you to allow installs from the file manager.

## Screenshots

Compose preview screenshot tests use Paparazzi because this project does not ship an emulator image. Recorded screens are saved under `screenshots/`.

## API endpoints

Add an OpenAI-compatible base URL, key, and model ID in Settings. The app stores endpoint records in EncryptedSharedPreferences backed by Android Keystore. A PDF is sent using the OpenAI-compatible `file` content block when an endpoint supports it; image uploads use an `image_url` data URL.
