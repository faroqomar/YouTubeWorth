# Public caption evaluation

Read [testing](../docs/testing.md) for the rubric, exact split, limitations, commands and failed release gate.

- `cases.json`: labels/provenance/hashes, reviewed before inference; no speech text.
- `development-report.json`: bounded candidate comparison.
- `calibration-report.json`: official small type-level fit; no supported per-bucket fit, not deployed.
- `calibration-experiment.json`: official calibration payload from this device; excluded from the portable package. It can be regenerated and is not loaded by the service.
- `freeze.json`: selected experimental question family, rules, pipeline/corpus hashes before testing.
- `held-out-report.json`: 60 cases, counts and duration coverage. Experimental candidate failed; no accuracy improvement claim.

Raw public exports and reconstructed text are under ignored runtime/evaluation. Do not store private transcripts, browsing inventory or credentials here. These source URLs are an explicit research corpus, not a record of ordinary extension viewing activity.
