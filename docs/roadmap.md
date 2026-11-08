# Approved improvement plan

Goal: help the user understand English videos without missing useful information. Keep local Laya, existing architecture and permissions.

- [x] Capture the existing 0.3.1 baseline and historical verification.
- [x] Establish video-separated development, calibration and held-out evaluation data.
- [x] Compare bounded classifier candidates, remove the fact/opinion usefulness penalty, and record the selection.
- [x] Implement shorter caption-aware excerpts, separate surrounding context, conservative uncertainty and reliable skip boundaries.
- [x] Derive verdicts, useful-time totals, filtering and markers from the same normalized intervals.
- [x] Redesign simple settings plus collapsed Advanced, with migration, backups and explicit reliability state.
- [x] Version classifier/cache identities and protect cancellation/navigation and source-check snapshots.
- [x] Populate architecture, API, settings, operations, privacy and testing documentation.
- [x] Add drift checks and reproducible packaging.
- [x] Run automated checks and real Chrome/Laya verification; record results and unresolved limits.

## Quality checks

At least 60 held-out excerpts, including 20 useful, 20 filler and 20 mixed/context/uncertain. Target useful precision and recall >=90%, zero harmful automatic skips and >=50% identification of clear filler. Record source count, coverage and latency. These are empirical release checks, not population accuracy claims. Failure retains conservative behavior and must be documented.

## Release outcome

Implementation and regression checks are complete; final Chrome/package evidence is recorded in [the current log](log/2026-10-08.md). This checklist tracks delivered work, not a passed accuracy gate.

- **Verified failure:** five-choice experimental classifier missed useful precision/recall and clear-filler targets.
- **Implemented fallback:** existing four-choice content question without the fact/opinion penalty; automatic skipping disabled.
- **Unresolved:** independent human/visual labels, a more representative natural-window dataset, fresh held-out whole videos and a successful release gate.
- **Planned next step:** evaluate only after collecting new held-out data; do not tune on these 60 known examples. No additional provider, training pipeline or permissions are proposed.
