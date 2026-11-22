# Ship Ahead: Volcanic (Math)

The Android app loads the game bundled in assets/game. Pass-and-play works offline and only online rooms require the server. The Gradle preBuild task runs npm ci and npm run build at the repository root and packages dist/ into the app automatically using Node.js 24. Package ID: `com.ashmaz.shipahead.volcanicmath`.

Download the Ship-Ahead-Android artifact from the completed Android Actions run. Extract and install app-debug.apk for device testing. The release AAB is unsigned unless ANDROID_UPLOAD_KEYSTORE_BASE64, ANDROID_UPLOAD_STORE_PASSWORD, ANDROID_UPLOAD_KEY_ALIAS and ANDROID_UPLOAD_KEY_PASSWORD are configured as repository Actions secrets. The workflow does not submit a release to Play Console.
