# Emberwake Relay

A portrait island board game for one player and up to three CPU crews. Choose 10, 15 or 25 rounds. Game logic, screens and the animated board are in MainActivity.kt. The packaged launcher icon uses the supplied ferry-and-volcano artwork.

## Build using GitHub Actions

Extract the archive. Commit its contents at the repository root, including the hidden .github directory and the Gradle wrapper JAR. The build runs on push using Java 17 and Android SDK 35. No signing secrets are required for this debug build.

In Actions, open **Build Emberwake APK**, select the successful run, and download **Emberwake-Relay-debug** from **Artifacts**. Extract the artifact to get **app-debug.apk**.

## Use the existing Ship Ahead repository

For a prototype with an independent source tree, open a terminal in the freshly extracted folder outside any existing Git checkout. Run these commands once with Git credentials that can push workflow files.

```sh
git init -b compose-prototype
git add -A
git commit -m "Package Emberwake Relay Compose prototype"
git remote add origin https://github.com/Ashmaz01/ship-ahead.git
git push -u origin compose-prototype
```

This creates a branch with its own history. If the branch already exists, choose an unused branch name. For a standalone repository, substitute its URL and preferred branch name.

## Device testing

Minimum Android version is 7.0 (API 24). The application ID is com.ashmaz.shipahead.volcanicmath, shared with the WebView release. Use a spare device or emulator with a clean install to preserve your existing game and its data. Fresh CI runners can produce different debug signing keys across builds.
