# Third-party inventory

The main game uses Phaser and its eventemitter3 dependency. The separate 3D demo uses Three.js. Lilita One and Atkinson Hyperlegible come from Fontsource and are bundled from src/assets/fonts with their OFL licences. The game uses browser Web Audio, HTML media, local storage and the optional native share/clipboard APIs.

The game source loads no remotely hosted third-party scripts, font services, analytics libraries, ad SDKs or tracking pixels. Registry URLs in the lockfile are install-time downloads. The online hosting providers and network metadata are covered in ONLINE_PLAY.md.

## Packages in the lockfile

Includes build and test tools, transitive dependencies and optional platform binaries; presence here does not mean a package runs on a player's device.

| Package path | Version | Scope in lockfile |
|---|---|---|
| @dimforge/rapier3d-compat | 0.12.0 | Development |
| @emnapi/core | 2.0.0-beta.2 | Development (optional) |
| @emnapi/runtime | 2.0.0-beta.2 | Development (optional) |
| @emnapi/wasi-threads | 2.2.0 | Development (optional) |
| @fontsource/atkinson-hyperlegible | 5.3.0 | Runtime dependency |
| @fontsource/lilita-one | 5.3.0 | Runtime dependency |
| @jridgewell/resolve-uri | 3.1.3 | Development |
| @jridgewell/sourcemap-codec | 1.6.0 | Development |
| @jridgewell/trace-mapping | 0.3.31 | Development |
| @napi-rs/wasm-runtime | 1.2.6 | Development (optional) |
| @oxc-project/types | 0.156.0 | Development |
| @rolldown/binding-android-arm-eabi | 1.2.19 | Development (optional) |
| @rolldown/binding-android-arm64 | 1.2.19 | Development (optional) |
| @rolldown/binding-darwin-arm64 | 1.2.19 | Development (optional) |
| @rolldown/binding-darwin-x64 | 1.2.19 | Development (optional) |
| @rolldown/binding-freebsd-x64 | 1.2.19 | Development (optional) |
| @rolldown/binding-linux-arm-gnueabihf | 1.2.19 | Development (optional) |
| @rolldown/binding-linux-arm64-gnu | 1.2.19 | Development (optional) |
| @rolldown/binding-linux-arm64-musl | 1.2.19 | Development (optional) |
| @rolldown/binding-linux-ppc64-gnu | 1.2.19 | Development (optional) |
| @rolldown/binding-linux-s390x-gnu | 1.2.19 | Development (optional) |
| @rolldown/binding-linux-x64-gnu | 1.2.19 | Development (optional) |
| @rolldown/binding-linux-x64-musl | 1.2.19 | Development (optional) |
| @rolldown/binding-openharmony-arm64 | 1.2.19 | Development (optional) |
| @rolldown/binding-wasm32-wasi | 1.2.19 | Development (optional) |
| @rolldown/binding-win32-arm64-msvc | 1.2.19 | Development (optional) |
| @rolldown/binding-win32-x64-msvc | 1.2.19 | Development (optional) |
| @rolldown/pluginutils | 1.1.1 | Development |
| @tweenjs/tween.js | 23.1.3 | Development |
| @tybys/wasm-util | 0.10.5 | Development (optional) |
| @types/chai | 5.2.3 | Development |
| @types/deep-eql | 4.0.2 | Development |
| @types/estree | 1.0.10 | Development |
| @types/stats.js | 0.17.4 | Development |
| @types/three | 0.187.0 | Development |
| @types/webxr | 0.5.24 | Development |
| @vitest/mocker | 5.1.1 | Development |
| @vitest/spy | 5.1.1 | Development |
| assertion-error | 2.0.1 | Development |
| chai | 6.3.0 | Development |
| detect-libc | 2.1.2 | Development |
| es-module-lexer | 2.3.2 | Development |
| estree-walker | 3.0.3 | Development |
| eventemitter3 | 5.0.4 | Runtime dependency |
| expect-type | 1.4.0 | Development |
| fdir | 6.5.0 | Development |
| fflate | 0.8.3 | Development |
| fsevents | 2.3.3 | Development (optional) |
| lightningcss | 1.33.0 | Development |
| lightningcss-android-arm64 | 1.33.0 | Development (optional) |
| lightningcss-darwin-arm64 | 1.33.0 | Development (optional) |
| lightningcss-darwin-x64 | 1.33.0 | Development (optional) |
| lightningcss-freebsd-x64 | 1.33.0 | Development (optional) |
| lightningcss-linux-arm-gnueabihf | 1.33.0 | Development (optional) |
| lightningcss-linux-arm64-gnu | 1.33.0 | Development (optional) |
| lightningcss-linux-arm64-musl | 1.33.0 | Development (optional) |
| lightningcss-linux-x64-gnu | 1.33.0 | Development (optional) |
| lightningcss-linux-x64-musl | 1.33.0 | Development (optional) |
| lightningcss-win32-arm64-msvc | 1.33.0 | Development (optional) |
| lightningcss-win32-x64-msvc | 1.33.0 | Development (optional) |
| magic-string | 1.4.5 | Development |
| meshoptimizer | 1.1.1 | Development |
| nanoid | 3.3.20 | Development |
| obug | 3.0.0 | Development |
| phaser | 4.2.1 | Runtime dependency |
| picocolors | 1.1.1 | Development |
| picomatch | 4.0.7 | Development |
| postcss | 8.5.33 | Development |
| rolldown | 1.2.19 | Development |
| source-map-js | 1.2.4 | Development |
| std-env | 4.3.0 | Development |
| three | 0.187.0 | Runtime dependency |
| tinybench | 6.2.4 | Development |
| tinyexec | 1.3.1 | Development |
| tinyglobby | 0.2.17 | Development |
| tslib | 2.9.1 | Development (optional) |
| typescript | 5.9.3 | Development |
| vite | 8.3.8 | Development |
| vitest | 5.1.1 | Development |
| why-is-node-running | 3.2.1 | Development |
