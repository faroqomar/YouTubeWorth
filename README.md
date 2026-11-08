# Worth · YouTube viewing maps with local AI (Alpha)

Worth is a Chrome extension that turns timestamped YouTube captions into a viewing map. Review useful passages, preserve context, and click timestamps to seek. A local Node.js service runs inference through a persistent Python worker using the pinned Laya multilingual model.

**Experimental alpha · version 0.4.0. This is a work-in-progress research tool, not a production-ready product.** Automatic skipping is disabled because the classifier failed its held-out evaluation. Suggestions need human judgment. Missing captions and visual-only demonstrations limit what Worth can assess.

## Demo

The demo uses the installed extension on [Theo's 39:22 discussion, “How does Claude Code actually work?”](https://www.youtube.com/watch?v=I82j7AzMU80). It shows opening Worth, live caption analysis, green highlights above YouTube's timeline, useful-only filtering and a manual jump to 4:52. The edited capture sequence shortens the analysis wait; it does not represent real-time processing speed.

![Worth on a real YouTube video: analysis, highlights and timestamp seeking](docs/media/demo.gif)

[Watch the sharper MP4 version](docs/media/demo.mp4).

Worth suggested **33:06 useful** and **6:16 optional context** from 1,188 caption timestamps. These are model outputs, not measured time savings or independently verified labels. Automatic skipping remained disabled.

![Real YouTube video with Worth's useful highlights and viewing map](docs/media/viewing-map.png)

![Manual timestamp jump with useful-only passages and native green highlights](docs/media/useful-only.png)

<details>
<summary>Settings dashboard</summary>

![Worth settings dashboard](docs/media/settings.png)

</details>

## Features

- Caption-bounded segments with useful, filler, optional-context and unknown coverage.
- Clickable timestamps and green useful-passage markers above YouTube's player bar.
- An optional viewing goal, keep-only filtering, and timestamped SRT/VTT import when captions are unavailable.
- Draft settings with validation, Save/Discard, defaults and versioned import/export.
- Local model inference; optional public-source comparison for quoted claims.

## Install on macOS

Supported setup: Apple Silicon macOS, **Node.js 22+**, **Python 3.12**, and **Chrome 116+**. Other platforms have not been verified. Initial dependency/model downloads require internet access and several gigabytes of free space. YouTube and optional source retrieval also use the network; AI inference runs locally.

### 1. Get the source

Clone the repository:

```sh
git clone https://github.com/faroqomar/YouTubeWorth.git
cd YouTubeWorth
```

Alternatively, download and extract the source ZIP, then open Terminal in the `YouTubeWorth` folder. Keep it in a permanent location: the login service records its absolute path.

### 2. Install Python dependencies and the model

```sh
python3.12 -m venv .venv
.venv/bin/python -m pip install -r requirements.lock
node download-runtime.mjs
```

The lockfile pins Laya and its dependencies. The downloader fetches a pinned model revision and verifies large-file hashes. It supports resuming interrupted downloads. The Node service uses built-in modules, so it needs no `npm install` for normal operation.

### 3. Register and start the local service

```sh
node install-service.mjs
curl -fsS http://127.0.0.1:4318/health
```

The installer registers a per-user macOS LaunchAgent, starts the service and pairs the unpacked extension on this device. Wait for `"ready":true` in the health response. First startup needs model warm-up. Use `start.command` or `npm start` if the login service is not running; avoid starting a second service on the same port.

### 4. Load the Chrome extension

1. Open `chrome://extensions/`.
2. Enable **Developer mode**.
3. Click **Load unpacked**, then select this project's `extension` folder.
4. Pin Worth from Chrome's Extensions menu.
5. Open a regular YouTube video with captions and click Worth.

If Worth asks for pairing, open [Local setup](http://127.0.0.1:4318/setup), copy this device's pairing code, and paste it into the extension's connection settings. Keep that code private.

## Use Worth

Open a captioned video, click Worth, and wait for the viewing map. Click a timestamp to jump to a passage; choose **Useful only** to filter the list. Open **Settings** to set a viewing goal or change identification preferences, then save. Analysis changes require reanalysis.

For a quick interface tour after starting the service, open [the sample-data demo](http://127.0.0.1:4318/?demo=1). This demo does not run inference. The [settings dashboard](http://127.0.0.1:4318/dashboard) controls your local preferences.

## Development and verification

```sh
npm test
npm run test:api
npm run test:settings
npm run docs:check
npm run package
```

`npm test` requires the Python environment above. Browser checks also require Playwright and Chrome; the current settings runner uses the standard macOS Chrome application path. `npm run test:api` uses mocked inference/retrieval. `npm run test:settings` uses an isolated service and worker fixture.

To check the installed real model with synthetic English and Arabic speech:

```sh
node test/live-laya-check.mjs
```

Verified on 2026-11-08: 21 automated tests, API fixture checks, 22 settings browser checks, and English/Arabic inference through the installed local Laya model. This run did not verify a fresh installation on another machine or platform. Live YouTube caption retrieval, green player highlights and manual seeking were verified in the later demo capture. See [the verification log](docs/log/2026-11-08.md).

`npm run package` creates `YouTubeWorth.zip`, an allowlisted source archive with documentation and the curated demo media. It excludes device credentials, models, virtual environments, runtime data and private captures. Install dependencies on the destination machine. Share the generated ZIP rather than copying this installed working folder.

## Architecture

| Component | Responsibility |
| --- | --- |
| `extension/` | Manifest V3 side panel, caption capture, player integration and settings UI |
| `server.mjs`, `lib/` | Loopback HTTP API, authentication, caching and normalized coverage |
| `laya-worker.py`, `worth_analysis.py` | Persistent local inference, caption windows and conservative classifications |
| `test/`, `evaluation/` | Regression checks, controlled fixtures and evaluation provenance/reports |

## Limitations and privacy

Uncertain, mixed, truncated and uncovered speech stays visible as context or unknown. Model confidence does not guarantee correctness. The experimental classifier failed the 60-excerpt evaluation; automatic skipping remains unavailable. Optional source comparisons do not establish universal truth.

Keep `.local-token`, `extension/local-config.js`, `runtime/` and private transcripts out of source control. The package builder checks for the local credential and supplies an empty extension config. See [privacy and limitations](docs/privacy-and-limitations.md).

## Documentation

- [Documentation index](docs/README.md)
- [Installation, pairing, restart and recovery](docs/operations.md)
- [Architecture](docs/architecture.md) · [Analysis contract](docs/analysis.md)
- [Settings reference](docs/settings.md) · [API](docs/api.md)
- [Tests and evaluation](docs/testing.md)
- [Laya upstream project](https://github.com/NandhaKishorM/laya)
