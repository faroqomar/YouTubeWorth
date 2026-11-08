# Worth contributor instructions

- Read docs/README.md and docs/analysis.md before changing behavior.
- Keep the UI and documentation English. AI inference stays local in pinned Laya; no new provider or Chrome permission without a concrete requirement.
- Preserve useful information. Mixed, uncertain, uncovered and truncated speech must never become an automatic skip.
- Every behavior change updates the relevant docs and appends an entry to docs/log/YYYY-MM-DD.md: problem, components, behavior, verification, compatibility and open issues. Distinguish planned, implemented and verified.
- Do not put tokens, private transcripts, browsing history or runtime logs in docs, fixtures or release packages. Runtime evaluation data is ignored; use provenance manifests and aggregate reports for reproducibility.
- Run the relevant tests, npm run docs:check and npm run package before delivery. Record whether tests use mocks, synthetic text or live YouTube/Laya.
- Never describe model confidence or a small benchmark as a guarantee of accuracy. Do not tune on the held-out set.
