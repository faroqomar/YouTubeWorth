# Ten-video production audit

Started 2026-10-08; report completed 2026-10-09. This is a fresh audit of Worth 0.4.0's deployed four-choice fallback, using original English captions. It is separate from the earlier five-choice experiment.

**Assessment: useful for navigating videos, but not reliable enough to watch only the green highlights or automatically skip.** Highlight precision was strong in this sample, but useful-content recall and filler identification missed the requested targets.

## Method

Ten public videos: four coding overviews, two AI discussions, two product reviews and two explainers. Total duration 66:04, with 1,629 caption cues. Seven are Fireship videos, two are Marques Brownlee reviews and one is a 3Blue1Brown lesson. The selection is therefore concentrated in a few creators and is not representative of all YouTube.

The implementing agent reviewed the complete transcripts before inference, assigning continuous `keep / context / skip / unknown` reference intervals for the goal **understand the whole topic**. Teaching stories, opinions, product comparisons and meaningful recommendations remain useful. Mixed sponsor explanations remain context. Pure calls to action and housekeeping are filler. Non-speech and unreviewed visuals remain unknown.

The [review labels](../evaluation/ten-video-2026-10-08/review.json), [source manifest](../evaluation/ten-video-2026-10-08/sources.json) and [configuration freeze](../evaluation/ten-video-2026-10-08/freeze.json) were saved before model inference. The labels were not changed after seeing predictions. Questions, thresholds, calibration and the application were not tuned for this audit.

Each whole transcript was sent to the installed local service's `/api/analyze` endpoint, the same endpoint used by the extension. All ten responses were fresh (`cached:false`), from real pinned Laya on MPS. Every analysis identity was checked against its input and frozen production configuration. These are production API results, not mocked outputs or ten newly verified Chrome panel sessions. The panel/player mechanics have separate live and fixture evidence in [the previous release log](log/2026-10-08.md). A new UI spot check was attempted during this audit, but the active Chrome window changed during user interaction; no new panel result is claimed here.

Primary overlap metrics measure seconds within the union of caption ranges. Uncaptioned gaps do not count as classified speech. Unknown reference regions are excluded from precision and recall, with their highlights reported separately. This avoids treating missing or unreviewed visual content as a known usefulness error. All reference labels come from one agent's transcript review, not independent human or visual ground truth. No factual source checking was performed.

## Results

| Measure | Result | Interpretation |
|---|---:|---|
| Useful highlight precision | 3,084.316 / 3,161.474 seconds = **97.6%** | Fraction of highlighted, known-reference speech reviewed as useful |
| Useful highlight recall | 3,084.316 / 3,505.518 seconds = **88.0%** | Fraction of reviewed useful speech included in green highlights |
| Useful speech absent from green | **421.202 seconds (7:01)** | 418.749 seconds stayed as context; 2.453 seconds fell inside skip intervals |
| Clear filler identified as skip | 9.467 / 98.384 seconds = **9.6%** | Most filler remained context rather than being identified as skip |
| Clear filler highlighted green | **9.277 seconds** | Incorrect useful highlights |
| Unknown-reference content highlighted | **7.927 seconds** | Excluded from primary precision; no usefulness claim can be validated from the review |
| Caption-covered duration | **3,804.489 / 3,964 seconds (96.0%)** | Remaining timeline is outside caption coverage |
| Total green time | **52:49 / 66:04** | Includes all keep intervals, including unknown-reference highlights |
| Exact whole-video verdict agreement | **8 / 10** | Two worthwhile videos received the more cautious selective verdict |
| Automatic skips executed | **0; feature disabled** | Does not establish safe automatic skipping |
| Warm-service analysis time | **11.057 seconds for ten requests** | Excludes transcript collection, model startup and manual review |

All ten selected videos contained substantial relevant content and were reviewed as worth watching for their topic. This sample cannot measure whether Worth correctly rejects wholly low-value videos. The 8/10 verdict result is therefore positive-video agreement, not general verdict accuracy.

## Per-video comparison

Times below use the same floor-to-whole-seconds presentation as the extension. Precision and recall are time-weighted caption overlap, not percentages of excerpt counts.

| Video | Transcript review | Worth verdict | Worth green time / duration | Useful precision | Useful recall | Clear filler found |
|---|---|---|---:|---:|---:|---:|
| [React in 100 Seconds](https://www.youtube.com/watch?v=Tn6-PIqc4UM) | Worth | Worth | 1:44 / 2:08 | 100.0% | 95.8% | 0.0% |
| [Python in 100 Seconds](https://www.youtube.com/watch?v=x7X9w_GIm1s) | Worth | Worth | 2:08 / 2:23 | 100.0% | 97.0% | 0.0% |
| [Linux in 100 Seconds](https://www.youtube.com/watch?v=rrB13utjYV4) | Worth | Worth | 2:35 / 2:41 | 96.3% | 100.0% | 77.5% |
| [Docker in 100 Seconds](https://www.youtube.com/watch?v=Gjnup-PuquQ) | Worth | Worth | 1:44 / 2:07 | 100.0% | 97.0% | 0.0% |
| [Anthropic researchers are quitting... and now we know why](https://www.youtube.com/watch?v=7r4ikZHm9AI) | Worth | Selective | 4:19 / 6:16 | 91.7% | 80.0% | 0.0% |
| [A $6.3 billion open-weight model just got embarrassed by the French...](https://www.youtube.com/watch?v=WrCjAAl9okA) | Worth | Worth | 4:19 / 6:10 | 90.2% | 74.9% | 0.0% |
| [The M4 Mac Mini is Incredible!](https://www.youtube.com/watch?v=z19HM7ANZlo) | Worth | Worth | 10:42 / 11:45 | 99.4% | 95.6% | 53.0% |
| [iPhone 17 Review: No Asterisks!](https://www.youtube.com/watch?v=rng_yUSwrgU) | Worth | Worth | 8:19 / 11:20 | 98.0% | 75.7% | 0.0% |
| [Machine Learning Explained in 100 Seconds](https://www.youtube.com/watch?v=PeMlggyqz0Y) | Worth | Selective | 1:44 / 2:34 | 100.0% | 73.6% | 0.0% |
| [But what is a neural network?](https://www.youtube.com/watch?v=aircAruvnKk) | Worth | Worth | 15:09 / 18:40 | 98.8% | 95.0% | 0.0% |

## Errors that matter

- **Machine-learning explainer, 0:25.359–0:51.239:** classification examples, prediction, data collection and data quality were labeled possible promotion and kept as context. This was useful teaching, so Useful only misses it.
- **iPhone review:** much of the opening teaching skit became greeting/promotion context. The skit demonstrates why a buyer with money may still prefer the base model. The 9:31.360–9:58.080 comparison also became promotion context, and the final recommendation shared a window with the farewell, making the whole window context. Product discussion and recommendation still confuse the content-type question.
- **Mac mini review, 7:17.070–7:43.470:** the explanation of upgrade pricing became promotion context, despite being relevant purchasing advice. Its final skip window also overlaps 2.453 caption-covered seconds labeled useful in the frozen review. Those seconds contain a short repeated closing appraisal, not a lost technical lesson; this is a reference-boundary discrepancy and must not be presented as proof of a harmful executed skip. A further 3.583 seconds of music were classified skip despite the reference being unknown.
- **Open-model discussion:** useful release framing and the privacy rationale were preserved as promotion/story context. Conditional model recommendations were mostly retained. Sponsor technical explanations occasionally appeared green, reducing precision.
- **Short coding videos:** most core explanations were highlighted correctly. Outro windows often mixed the last useful sentence with housekeeping; preserving the complete window as context protects speech but loses some green recall and fails to identify the pure filler inside it.
- **Neural-network lesson:** most mathematical explanation and the late correction about modern activation functions were highlighted. Some surrounding discussion remained context. Caption gaps were preserved as unknown instead of inventing coverage.

## Decision and next work

This audit does **not** pass the sample targets: useful recall is below 90%, filler identification is below 50%, and reference useful time overlaps skip intervals. The strong precision result applies only to this sample and cannot be claimed as universal accuracy or compared directly with the earlier differently sampled five-choice result.

Keep automatic skipping disabled. Worth currently helps locate explanations, but a user who follows only green sections can miss teaching stories, comparative opinions and conclusions. Filler identification is too weak to promise meaningful time savings.

Before changing the classifier, address the observed distinction between relevant recommendation and promotion, and the loss of useful content in mixed ending windows. Treat these ten videos as known diagnostic data from now on. Any future accuracy claim requires newly reviewed whole videos, more creators, clearly low-value videos, and independent review. No fixes or threshold changes were deployed in this audit.

## Reproduction and retained artifacts

Public original captions and complete responses are retained locally in ignored `runtime/evaluation/ten-video-2026-10-08/`. They are excluded from source packaging. The portable audit contains metadata, label rationales, hashes, sanitized interval decisions and aggregate results only.

```sh
.venv/bin/python scripts/ten-video-audit.py collect
# review.json and freeze.json must already exist before inference.
.venv/bin/python scripts/ten-video-audit.py analyze
.venv/bin/python scripts/ten-video-audit.py report
```

`collect` reuses retained inputs; missing inputs are fetched from public YouTube captions through the installed service. `analyze` resumes existing responses rather than overwriting evidence. `report` checks frozen input, label, source, pipeline and classifier hashes, current rules, every production cache identity, full timeline totals and continuity. Rebuilding changed captions may fail those hashes; preserve the existing audit and create a new run instead of changing frozen labels.

[Machine-readable report](../evaluation/ten-video-2026-10-08/report.json) includes every video and sanitized interval. [Current change log](log/2026-10-09.md) records verification and packaging.
