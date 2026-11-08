# Testing and release evidence

## Commands

Run from the project root with a working Node 22+ on PATH:

```sh
npm test
node test/server-check.mjs
node test/dashboard-check.mjs
WORTH_CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node test/browser-check.mjs
node test/panel-race-check.mjs
npm run docs:check
npm run package
```

`test/*.test.mjs`: unit tests, including Python production functions with controlled predictions. `server-check.mjs`: isolated service/worker and source retrieval fixtures; validates authentication, origins, persistence, presentation cache reuse, analysis invalidation, starting snapshots and cancellation. `dashboard-check.mjs`: isolated service and headless Chrome; English, drafts, inline errors, migration/import/export, responsive widths 320/650/1000, reliability state. `browser-check.mjs`: demo plus real injected functions against DOM fixtures, not live YouTube/model accuracy. It covers native seeking, ads, pause, cleanup and keep-only markers. Headless installed Chrome does not load MV3 in that test; the installed extension is checked separately through Chrome UI.

The optional `node test/live-laya-check.mjs` is a historical synthetic smoke test, not an accuracy benchmark. It assumes the old long-window behavior and is not the 0.4 release gate. Use the evaluation runner and live checks below for current model evidence.

## Reviewed evaluation

Files: [cases](../evaluation/cases.json), [development report](../evaluation/development-report.json), [calibration report](../evaluation/calibration-report.json), [pre-test freeze](../evaluation/freeze.json), [held-out report](../evaluation/held-out-report.json).

Six public English videos, separated by whole video: one development video (21 excerpts), one calibration video (19 excerpts, 18 with a supported content-type label), four held-out videos (60 excerpts). Test labels: 20 useful, 20 clear filler, 20 mixed/context/uncertain. Coding, model reviews, AI discussion and an explainer interview are represented. Labels were assigned from transcript context by the implementing agent before model inference, not from prior model predictions. This is not independent human/visual ground truth. Useful includes methods, examples, evidence, meaningful assessments and teaching stories. Filler excludes useful explanations even inside sponsorships. Gameplay/visual gaps are preserved as context or unknown.

Public source text stays in `runtime/evaluation/`. Packaged manifests store IDs, timestamps, rationale and hashes, not transcripts. To reconstruct, export original captions for each public source listed in `scripts/build-evaluation.py` into `runtime/evaluation/VIDEO_ID.txt` using the documented timestamped export format, then:

```sh
python3 scripts/build-evaluation.py
.venv/bin/python scripts/evaluate.py development
.venv/bin/python scripts/evaluate.py calibrate
.venv/bin/python scripts/evaluate.py test
```

Do not rerun calibration/development to retune a question against known held-out failures. Preserve existing reports and collect new whole-video test data for the next candidate. The runner checks frozen case and pipeline hashes before testing. Caption changes can prevent exact reproduction; manifests include transcript/text hashes. Calibration uses official `records_from_labeled` and `fit_temperatures`, retaining minimum type=10 and bucket=2000. It does not train weights. The fitted global type temperature (18 excerpts, one video) is experimental and not deployed; no bucket reached 2000.

## Metrics and result, 2026-10-07

Development selection prioritised useful recall: content-4 retained 8/11 useful examples, precision 8/10; content-5 retained 10/11, precision 10/15. Both detected 0/5 clear filler. The selected five-choice candidate and thresholds were frozen before held-out prediction.

| Held-out metric | Result | Target |
|---|---:|---:|
| Useful-highlight precision | 17/37 = 45.9% | >=90% |
| Useful-highlight recall | 17/20 = 85% | >=90% |
| Clear filler found | 0/20 = 0% | >=50% |
| Harmful filler decisions | 0 | 0 harmful automatic skips |
| Automatic skips executed | 0; feature disabled | Only after validation |
| Classified keep/skip coverage | 37/60 = 61.7% | Report denominator |
| Evaluated duration | 1,060 seconds | Report duration |
| Useful seconds correctly highlighted | 442 seconds | Report duration |

**FAILED.** Zero harmful executed skips is not a successful safety result because the feature was disabled. These results do not establish improved accuracy. The experimental five-choice question was rejected for deployment; the existing four-choice question is retained without its harmful fact/opinion penalty, with independent safety fixes. This fallback has not passed a new independent held-out evaluation.

Filler cases are short boundary-level excerpts; they are not representative of all automatic 25-second windows. All excerpts from one video are correlated. Small sample size, agent-reviewed labels and missing visual review limit generalization. A future release needs independent reviewed labels, longer natural filler runs and new held-out videos.

## Regression and live checks

The [ten-video production audit](ten-video-audit.md), started 2026-10-08 and completed 2026-10-09, evaluates the deployed four-choice fallback on complete fresh transcripts. It uses time-weighted caption overlap, unlike the historical excerpt-count experiment above. It preserves frozen reference reviews, source/configuration hashes and sanitized results. It does not tune the model or pass the release gate. Use `scripts/ten-video-audit.py` for reproduction; retained speech stays in ignored runtime storage.

Fresh automated and live results are recorded in [the dated log](log/2026-10-08.md). The [0.3.1 history](verification-history.md) is preserved verbatim and must not be described as freshly rerun.

Release checklist: unit/API/UI tests; unsafe skip and unknown-gap invariants; settings migration/backup/import/export; cache identity and snapshots; navigation/cancellation; service-offline behavior; keyboard access and narrow layouts; real YouTube player seeking/markers/closed panel; documentation links/catalog completeness; credential and private-file package exclusions. Accuracy failure keeps the independent automatic-skip gate off.
