# Architecture

## Components

| File / directory | Responsibility |
|---|---|
| `extension/manifest.json` | Manifest V3 side panel; existing activeTab, scripting, storage and sidePanel permissions |
| `extension/worker.js` | Opens the side panel on an explicit toolbar gesture |
| `extension/panel.*` | Caption acquisition, analysis progress, viewing map, optional source comparison and per-video playback controls |
| `extension/content.js` | Self-contained injected readers, native seeking, optional skipping, green useful-only markers |
| `extension/common.js` | Timestamp parsing, transcript import and shared display helpers |
| `extension/rules.js` | Typed settings catalog, defaults, validation, v1 migration, cache projection and recommended-profile checks |
| `extension/dashboard.*` | Simple settings and collapsed Advanced; draft/save/discard/import/export |
| `server.mjs` | Loopback HTTP, authentication, bounded job concurrency, snapshots, cache, progress and cancellation |
| `lib/analysis.mjs` | Input validation, caption coverage normalization, final totals/verdict, independent skip gate |
| `lib/rules-store.mjs` | Atomic local settings persistence and migration backups |
| `lib/laya-client.mjs` | Persistent Python child and correlated NDJSON requests |
| `lib/evidence.mjs` | Optional Wikipedia retrieval and constrained source comparison |
| `worth_analysis.py` | Caption deduplication/windows, bounded content questions, conservative decision mapping |
| `laya-worker.py` | Worker queue/cancellation, local checkpoint loading, source comparison, public captions fallback |
| `classifier-config.json` | Version, pinned checkpoint, selected question family, calibration identity and release gate |
| `evaluation/` | Public source/label manifests, development/calibration/test reports and pre-test freeze; no transcript text |
| `scripts/` | Evaluation reconstruction, local model evaluation, documentation checks and packaging |
| `test/` | Unit, worker fixture, API, browser and real local-model checks |
| `runtime/` | Ignored installation, model, settings and diagnostic files; never packaged |
| `docs/` | Architecture, contracts, operations, evidence and append-only project change history |

## Data flow

1. Clicking Worth grants the existing activeTab access. The panel captures the active video identity and a job generation.
2. Read video metadata, original player captions in the page's MAIN world, then the visible transcript panel. Optionally request public captions from the local service. Manual SRT/VTT is the final fallback.
3. Fetch a settings snapshot. The panel uses caption/presentation preferences; the service takes the authoritative analysis snapshot when it accepts the request.
4. Validate and fingerprint input plus analysis settings and classifier identity. A presentation-only change can reuse a matching judgment.
5. Queue one local Laya request. Python splits actual covered speech and reports progress. Caption text is classification data, not executable instructions.
6. The service intersects judgments with caption coverage, inserts unknown gaps, checks skip eligibility and derives all summary values.
7. The panel renders results. Only `keep` intervals appear in Useful only and in the non-intercepting native player overlay.
8. Source comparison uses a matching cached analysis and its starting rules. A changed source-check configuration requires reanalysis.

## Lifecycle

A panel generation guard rejects stale async completions. Navigation aborts requests and disables skipping. Injected controls validate the current video ID; markers remove themselves on navigation, hide during ads and survive closing the panel. Native seek hit targets remain untouched. The worker checks cancellation between excerpts; an in-flight model call completes before the next cancellation check. The server removes progress only for the job that owns it.

The service is single-process and local. Restarting it clears in-memory analyses. There is no database, cloud AI, training service or frame/audio pipeline.
