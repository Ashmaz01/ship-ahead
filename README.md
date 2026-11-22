# Ship Ahead: Volcano Math

The playable game is at the repository root. Its source comes from production release 12, commit `2d010561ce5565ad66630af152137d1b86e750aa`. The Phaser game starts at index.html. The separate board3d.html entry is the Three.js prototype. See [CHANGES.md](CHANGES.md) for the export adaptations.

## How to build

Use Node.js 24 and npm. From the repository root run:

```sh
npm install
npm run build
```

Copy the **contents of dist/** together, including story/. Open dist/index.html directly for pass-and-play. No server, login, network connection or environment file is needed to play locally. Installation downloads the locked build dependencies. The game bundles its images, fonts, music, scripts and styles and ships the pixel story clips alongside them. Dice, jump, UI and weather effects are synthesized by src/sound.ts.

For the Android integration, package the complete dist/ directory as WebView assets and load the local index. Enable JavaScript and DOM storage. When serving assets under a virtual HTTPS origin, route the room requests to the real backend as described in [ONLINE_PLAY.md](ONLINE_PLAY.md). A signed Android build that still points at the hosted homepage must be updated separately. The existing Android application ID is `com.ashmaz.shipahead.volcanicmath`.

Run `npm test` for game rules, school bands and room server tests. For development, `npm run dev` runs Vite. To build the production-style room service and its embedded client, run `npm run build:worker`. The worker entry is dist/server/index.js. The server needs the DB binding and migration described in ONLINE_PLAY.md.

[Dependency and tracking inventory](THIRD_PARTY.md) · [Online play and privacy](ONLINE_PLAY.md)
