# Operations

## Installation and pinned runtime

Current supported setup: macOS ARM64, Python 3.12, Node 22+ and Chrome with side-panel support. Existing device has a user LaunchAgent and unpacked extension. Do not move that checkout without re-registering it.

From the project directory:

```sh
python3.12 -m venv .venv
.venv/bin/python -m pip install -r requirements.lock
node download-runtime.mjs
node install-service.mjs
```

Then load `extension/` with Chrome's **Load unpacked** control. `requirements.lock` pins the full installed environment, including Laya 0.3.28, Torch 2.14.1 and Transformers 5.19.0. The downloader pins `convaiinnovations/laya` revision `7b928d828b7b0e022f929d9bd2e44165aa270148`, verifies large-file hashes and installs the multilingual model in `runtime/models/multilingual`. It supports resumable ranges. AI inference sets Hugging Face/Transformers offline flags. MPS is preferred; CPU is the fallback.

## Start and check

Open `start.command`, or run `npm start`. Warm-up can take a moment. Check:

```sh
curl -fsS http://127.0.0.1:4318/health
launchctl print "gui/$(id -u)/com.eros.youtubeworth"
```

`install-service.mjs` writes `~/Library/LaunchAgents/com.eros.youtubeworth.plist`, pins the current Node executable and checkout path, and registers at login. Logs are `runtime/service.log` and `runtime/service-error.log`. Do not copy logs into documentation without reviewing for sensitive data.

Restart after server, Python, profile or dependency changes:

```sh
launchctl kickstart -k "gui/$(id -u)/com.eros.youtubeworth"
```

Reload Worth at `chrome://extensions/` after extension edits. Refresh a YouTube tab if its old injected code remains. These updates require no new Chrome permissions.

## Pairing and recovery

The installer creates/reuses `.local-token` and writes `extension/local-config.js`, both mode 0600. Portable packages contain an empty config. On another device use that device's Local setup pairing code in the extension. Never share an existing device's credential.

Settings are `runtime/rules.json`. Before v1 migration the original is saved to `runtime/rules.json.v1-backup`; before each save the preceding version is saved to `runtime/rules.json.previous`. Both are local and excluded from packages. Stop/restart the service around manual restoration. Invalid files fail explicitly instead of silently losing preferences. Import/export is available from Settings and contains preferences only.

## Troubleshooting

- **Local service offline:** open start.command, inspect health and LaunchAgent paths.
- **Warming up:** wait for ready; do not repeatedly restart the model.
- **No captions / YouTube rejected request:** use original browser captions, Show transcript, or import timestamped SRT/VTT. Public requests may be blocked. No cookies/proxy/login bypass is used.
- **Large unknown coverage:** missing end times are inferred only briefly; long silent demonstrations cannot be judged from text. Do not raise limits to hide uncertainty.
- **Automatic skipping unavailable:** the recommended release must pass its evaluation and each interval must have safe boundaries. Custom questions/thresholds invalidate eligibility. The current conservative release deliberately does not enable automatic skipping.
- **Reanalysis required for sources:** rules no longer match the original analysis snapshot. Reanalyse before checking.
- **Slow long videos:** smaller excerpts increase model calls. Progress is per excerpt. Cancel works between inference calls.
- **Model failed:** verify installed lockfile, model files and service stderr. Re-run the pinned downloader; do not switch to a cloud provider.

## Packaging and update procedure

```sh
npm test
npm run docs:check
npm run package
```

`scripts/package.py` creates `YouTubeWorth.zip` from an explicit allowlist with stable archive timestamps. Includes code, docs, tests, scripts and evaluation manifests/reports. Excludes credentials, .venv, models, runtime, cache, private screenshots, raw transcripts and diagnostic logs; synthesizes empty local-config.js. Curated public UI screenshots and the real-YouTube demo GIF/MP4 in `docs/media/` are explicitly included. The package is portable source, not a store-signed extension. Install dependencies separately. See [testing.md](testing.md) for browser/release checks.
