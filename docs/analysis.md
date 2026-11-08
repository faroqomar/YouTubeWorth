# Analysis contract

## Baseline 0.3.1 (historical code inspection)

The worker grouped captions into 40–100 second windows, asked a four-choice content-type question and a fact/opinion/request question, then mapped explanation to keep. A non-factual answer could downgrade a useful explanation. Caption windows could extend to the next window or video end. The server inserted some unknown gaps but retained the worker's earlier verdict. Useful-only included context. These are baseline findings, not desired behavior. Historical checks are in [verification-history.md](verification-history.md).

## Intended 0.4 behavior

Useful speech explains the topic, demonstrates a method, presents evidence or comparisons, or gives a meaningful conclusion or opinion. Stories that teach are useful. A product mention, opinion, instruction, correction or negation is not evidence of filler. Mixed content and uncertain judgments are preserved as context. Uncovered or truncated material is unknown. Source comparison is separate and optional.

Caption boundaries define target intervals. Neighbouring speech may inform relevance but never receives the target's timestamps. Target length is 20–30 seconds, ceiling 40 seconds; token capacity takes precedence. Overlapping rolling captions are deduplicated; genuine later repeated speech is not removed as a caption artifact.

Automatic skipping requires a validated recommended classifier, a high-confidence clear-filler decision and reliable boundaries, then explicit per-video consent. It remains unavailable if the release gate fails. Visual demonstrations cannot be judged from missing captions.

The final normalized intervals are the sole basis of verdict, totals, the Useful only filter and green player markers. Only keep intervals count as useful highlights.

Intervals shorter than one second display as “Under 1s at …” in the panel, avoiding identical rounded start/end labels. Their exact boundaries still determine seeking and coverage.

Implementation and fresh verification will be recorded here as completed. See [roadmap.md](roadmap.md).

## Implemented pipeline (0.4.0)

`worth_analysis.py` holds the importable production pipeline. It keeps original speech endpoints, deduplicates rolling captions only when their explicit time ranges overlap, and clips overlaps to maintain non-overlapping target intervals. Later repeated speech is preserved. Windows target 25 seconds (configurable 20–30), ceiling 40. A gap over one second starts a new window; smaller gaps may supply adjacent context but remain unknown after normalization. A single overlong cue is unknown, not cut at invented timestamps. Text must fit both the character limit and the actual tokenizer budget, reserving 512 tokens for question/context overhead. Actual model truncation is a final unknown guard.

The deployed fallback asks **What type of text is this?** with Technical explanation, Advertisement, Personal anecdote and Greeting. Explanation maps to keep unless promotion is mixed in. Story maps to context. A low answer_confidence maps to context; truncation maps to unknown. Filler needs an enabled category, explicit phrase, high confidence and matching filler classifications for both excerpt halves. Negation, correction and explanatory conjunctions conservatively block filler. This lexical protection is imperfect and intentionally abstains frequently; it is not semantic proof. Exact repetition remains context and is never auto-skipped.

When a viewing goal is nonblank, a separate relevance question receives target text, video title and at most 160 characters from each neighbour. Strong off-goal relevance or truncated relevance becomes context. The content-type question receives target text only. The question state never grants neighbouring times a keep or skip judgment. Blank goal means the full topic; no relevance downgrade is applied.

The fact/opinion/request question now only selects verbatim quotes, capped by maxClaims. It cannot downgrade useful opinions or promote claims to truth. The source question is used only after a separate user action. It compares retrieved text with a quote; no generated explanation or tools are controlled by transcript instructions.

The server intersects each judgment with the union of caption ranges and fills every uncovered gap as unknown. Missing end times are inferred no farther than gapSeconds (5 seconds by default), never sufficient for skip eligibility. It then computes totals and verdict: unknown share above unknownRatio → uncertain; otherwise enough keep → worth/selective; otherwise enough skip → skip; otherwise uncertain. The explanation is generated from these final totals, not the worker's preliminary output.

## Reliability status

The selected experimental five-choice question failed the held-out checks. See [testing](testing.md). Production retains the four-choice fallback, checkpoint-default uncalibrated probabilities and a false release gate. No automatic skipping is currently eligible. This is a conservative behavior release, not a verified accuracy improvement. Recommended settings still expose usefulness suggestions and manual timestamps. Custom questions/thresholds remain explicitly unvalidated. A future passed release needs new independent evidence before enabling automatic skipping.
