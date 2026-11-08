# Decisions

## 2026-10-07 — Preserve understanding before compressing watch time

**Implemented.** Separate usefulness from source agreement. Removed the fact/opinion usefulness penalty, story-word downgrade and redundant word-similarity setting. Meaningful recommendations may be useful. Exact later repetition is identified conservatively as context because it may reinforce an explanation. Missing coverage remains unknown.

Alternative rejected: treating every factual claim as protected and every uncertain opinion as optional. Baseline inspection found that this can demote practical conclusions. The historical diagnostic examples were exploratory, not fresh release evidence.

## 2026-10-07 — Bounded questions and measured selection

**Implemented; measured on development samples.** Compare four content types without the penalty against the same choices plus Opinion or recommendation. Select by useful-content recall, then precision, then filler recall, using development only. Broader usefulness questions were rejected after exploratory examples behaved worse. The new five-choice option improves development recall but reduces precision; no universal accuracy improvement is claimed. See [development report](../evaluation/development-report.json).

Follow [Laya question and confidence guidance](https://nandhakishorm.github.io/laya/questions-and-answers/), [evaluation guidance](https://nandhakishorm.github.io/laya/evals/) and [staged adoption](https://nandhakishorm.github.io/laya/staged-adoption/). Use `answer_confidence`, not entropy-based `confidence`.

## 2026-10-07 — Calibration is evidence, not a bypass

**Implemented experimental calibration, not deployed.** Use the installed official calibration helper with unchanged minimums: 10 samples for a type-level fit, 2,000 for a per-options bucket. Eighteen calibration excerpts from one separate video support only a small type-level experiment. No per-bucket fit was produced. The experiment is saved separately; shipping identity remains checkpoint-default-uncalibrated. Do not call this reliable skip calibration. See [calibration report](../evaluation/calibration-report.json).

## 2026-10-07 — Gate playback actions independently

**Implemented.** Server and content script require explicit eligibility, with the release gate off by default. User-defined questions or thresholds are unvalidated. No setting can turn the release gate on. Restoring defaults restores the recommended profile, not a claim that the current release passed. All intervals still remain manually seekable.

## 2026-10-07 — Keep settings compact

**Implemented.** Five everyday preferences and collapsed Advanced. Keep search and draft actions. Remove the large introduction and artificial verdict preview. Use existing warm background/green palette. Version the catalog and migrate compatible preferences, replacing incompatible v1 timing/compression controls with safe defaults. Back up before migration and every save.

## 2026-10-07 — One coverage model and stable identity

**Implemented.** Normalize actual transcript coverage first; compute all summaries from those intervals. Include classifier/checkpoint/question/calibration identity and analysis settings in cache keys. Presentation and retention changes reuse judgments; source changes require matching reanalysis. Jobs finish with starting snapshots; navigation and cancellation invalidate panel generations.

## 2026-10-07 — Reject the experimental classifier for release

**Verified failure; conservative fallback implemented.** The selected five-choice candidate failed held-out checks: useful precision 17/37 (45.9%), recall 17/20 (85%), clear filler 0/20. Context examples were often highlighted. No automatic skips were enabled. Retain the existing four-choice content-type question without the harmful fact/opinion penalty, along with timing/coverage fixes. The four-choice fallback has not passed a new independent held-out evaluation; no accuracy improvement is claimed. The frozen five-choice experiment and failed results remain unchanged. New question/threshold work needs new whole-video held-out data.
