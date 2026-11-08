# Privacy and limitations

## Data destinations

- **Local only:** transcript classification, rule persistence, Laya model inference and source-text comparison. No OpenAI or other remote AI provider is called.
- **YouTube:** original captions are fetched in the current browser session, with an optional public-caption fallback. Signed caption URLs stay in the browser; login cookies are not exported to the server.
- **Wikipedia:** only after the user requests source comparison, derived claim search terms are sent for retrieval. Public source text is compared locally. Search terms may reveal the claim being checked.
- **Installation:** official pinned Python packages and model artifacts are downloaded from PyPI/Hugging Face.

Ordinary analyses/results live in server memory with bounded count and TTL, never disk. Disabling cache reuse retains only the current result for optional source comparison. Settings, local credentials, installed model files and service diagnostics persist locally. Development evaluation explicitly stores public exports under ignored `runtime/evaluation/`; these are separate from ordinary extension behavior and are not packaged. Documentation contains public evaluation provenance and aggregate results, no private transcripts or browsing inventory.

## Judgment limits

A classifier score is not a factual accuracy score. Opinions, examples and teaching stories can be useful; factual statements can be irrelevant. Forced-choice labels may be wrong even at high confidence. The multilingual checkpoint does not ship a task-specific fitted temperature map. The small calibration experiment does not establish generalization.

Worth reads captions, not frames or audio. Silent demonstrations, code on screen, misrecognized speech, absent captions, timing drift, interrupted speech and omitted endings can change meaning. Only explicit caption end times can contribute to skip eligibility; inferred end times cannot. A caption row longer than the duration or token budget is left unknown. Native YouTube ads are separate from spoken sponsorships.

Source comparison is limited to a small number of verbatim candidate quotes and retrieved Wikipedia excerpts. Early claims can exhaust the quote budget. Wikipedia may omit niche or current information. Agreement with a retrieved source is not proof, missing evidence is not falsehood, and two sources are not necessarily independent. It does not audit every statement, code behavior or statistical claim.

## Evaluation limits

Development, calibration and testing are separated by whole public video. Labels were reviewed by the implementing agent from available transcript context, not independently by the user or a domain expert; visual playback was not reviewed for every evaluation excerpt. Several filler excerpts are short boundaries and are correlated within a video. Reported sample counts cannot establish universal accuracy. A failed or incomplete release gate keeps automatic skipping disabled. See [testing.md](testing.md) and the [held-out report](../evaluation/held-out-report.json).
