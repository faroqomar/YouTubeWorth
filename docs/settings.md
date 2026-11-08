# Settings reference

Generated from `extension/rules.js` (schema 2). Edit the catalog, then run `npm run docs:generate`; `npm run docs:check` rejects drift. Defaults below are storage units; percentages are shown ×100 in the UI.

Five everyday controls: viewing goal, player highlights, sponsors, empty intros/outros and exact repetition. Advanced is collapsed by default; search reveals matches. All changes are drafts until Save. Discard restores saved values. Restore defaults also stays a draft. Export includes the current validated draft, no credentials or transcripts. Import supports v1 and v2 and requires Save.

## Compatibility and reliability

Version 1 migration preserves recognized compatible preferences and custom questions, removes retired fact/opinion/story penalties and redundant similarity/divisor controls, and replaces windowMin/windowMax/gapSeconds/maxSegments with safe v2 defaults. Unknown keys and unsupported versions are rejected. A local v1 backup is created once before migration; a previous-settings backup is written before each save. New preferences receive defaults. Version 2 imports must be complete.

Custom classifier questions, segmentation and decision thresholds mark the configuration unvalidated. Restoring recommended defaults restores profile eligibility only when the independent release gate has also passed. Current gate status is exposed in Advanced. No control changes the provider, pinned checkpoint, authentication or Chrome permissions. Jobs use starting snapshots. Presentation-only changes apply when Worth next opens; other analysis changes require reanalysis.

Global constraints: selectiveRatio ≤ worthRatio; minConfidence ≤ keepConfidence; windowMin ≤ windowMax; claimMinChars ≤ claimMaxChars; quoteMinChars ≤ quoteMaxChars. Original language must be a valid short language code. Lists are trimmed and deduplicated. Blank goal means understand the whole topic.

## Everyday settings

| Setting | Purpose | Default | Constraints | Effect | Dependencies |
|---|---|---|---|---|---|
| `defaultViewingGoal` — Default viewing goal | Optional. Leave blank to understand the whole topic. | `""` | 0–300 characters | Default for next analysis; blank = whole topic | See purpose and global constraints below |
| `skipPromotion` — Identify sponsors and promotions | Advertisements and subscription requests within the spoken content. | `true` | true / false | Analysis; reanalyse | Identification only; does not enable skipping |
| `skipIntro` — Identify empty intros and outros | A strong classification is still required; introductions are not automatically filler. | `true` | true / false | Analysis; reanalyse | Identification only; does not enable skipping |
| `skipRepetition` — Identify exact repetition | Requires matching the previous excerpt and enough distinct words. | `true` | true / false | Analysis; reanalyse | Identification only; does not enable skipping |
| `showImportantOnPlayer` — Highlight useful moments on the player | Marks only Watch segments in green above YouTube’s progress bar after analysis. Applies when Worth next opens; existing judgments are reused. | `true` | true / false | Presentation; reuse judgments on next open | Needs a completed analysis and native player bar |

## Video verdict

| Setting | Purpose | Default | Constraints | Effect | Dependencies |
|---|---|---|---|---|---|
| `worthRatio` — Useful time needed for “Worth watching” | Share of the full video classified as useful, after unknown gaps are included. | `0.7` | 0.1–1; decimal; percent | Analysis; reanalyse | Custom analysis rules are unvalidated; release gate is independent |
| `selectiveRatio` — Useful time needed for “Watch selectively” | Below this, the verdict stays uncertain unless filler dominates. | `0.15` | 0–0.9; decimal; percent | Analysis; reanalyse | Custom analysis rules are unvalidated; release gate is independent |
| `skipRatio` — Filler needed for “You can skip it” | Based on classified intervals, not promotional words alone. | `0.7` | 0.1–1; decimal; percent | Analysis; reanalyse | Custom analysis rules are unvalidated; release gate is independent |
| `unknownRatio` — Unknown time that makes a verdict uncertain | The verdict becomes uncertain above this share of unanalysed time. | `0.2` | 0–1; decimal; percent | Analysis; reanalyse | Custom analysis rules are unvalidated; release gate is independent |
| `minConfidence` — Minimum classification confidence | Anything below this becomes unknown. | `0.5` | 0.3–0.95; decimal; percent | Analysis; reanalyse | Custom analysis rules are unvalidated; release gate is independent |
| `keepConfidence` — High confidence for useful explanation | Lower confidence keeps the explanation at medium confidence. | `0.85` | 0.5–1; decimal; percent | Analysis; reanalyse | Custom analysis rules are unvalidated; release gate is independent |

## Filler & context

| Setting | Purpose | Default | Constraints | Effect | Dependencies |
|---|---|---|---|---|---|
| `skipConfidence` — Confidence required to mark filler | Only high-confidence filler is eligible for optional automatic skipping. | `0.9` | 0.5–1; decimal; percent | Analysis; reanalyse | Custom analysis rules are unvalidated; release gate is independent |
| `repetitionWords` — Minimum distinct words for repetition | Short excerpts are not treated as repetitive. | `20` | 5–100; integer; words | Analysis; reanalyse | Custom analysis rules are unvalidated; release gate is independent |
| `fillerWords` — Filler words and phrases | One phrase per line. A match alone is not enough to mark filler. | `["sponsor","subscribe","subscription","promo code","discount code","thanks for watching","welcome back"]` | 0–100 phrases; 1–120 characters each | Analysis; reanalyse | Custom analysis rules are unvalidated; release gate is independent |

## Original captions

| Setting | Purpose | Default | Constraints | Effect | Dependencies |
|---|---|---|---|---|---|
| `preferredLanguage` — Preferred original language | Language code such as en or ar. Uses an available original track if missing; no translation. | `"en"` | 1–600 characters | Analysis; reanalyse | See purpose and global constraints below |
| `preferManual` — Prefer authored captions | When several original tracks are available in the preferred language. | `true` | true / false | Analysis; reanalyse | See purpose and global constraints below |
| `publicFallback` — Try public captions if browser reading fails | Contacts YouTube only. YouTube can reject this request. | `true` | true / false | Analysis; reanalyse | See purpose and global constraints below |
| `panelWaitMs` — Transcript panel wait | Maximum wait; returns sooner when caption rows stabilise. | `15000` | 2000–45000; integer; ms | Analysis; reanalyse | See purpose and global constraints below |
| `captionTimeoutMs` — Player caption request timeout | Original captions fetched within your Chrome session. | `12000` | 2000–45000; integer; ms | Analysis; reanalyse | See purpose and global constraints below |

## Fact checking

| Setting | Purpose | Default | Constraints | Effect | Dependencies |
|---|---|---|---|---|---|
| `maxClaims` — Maximum claims to check | Zero disables claim extraction and the fact-check button. | `5` | 0–15; integer; claims | Source checking / quote selection; reanalyse | Source comparison is optional; maxClaims=0 disables quotes |
| `claimConfidence` — Confidence for identifying a factual passage | The claim is quoted from the transcript, never generated. | `0.8` | 0.5–1; decimal; percent | Source checking / quote selection; reanalyse | Source comparison is optional; maxClaims=0 disables quotes |
| `compareConfidence` — Confidence required to support or contradict | Lower confidence remains unverified even with a retrieved source. | `0.9` | 0.5–1; decimal; percent | Source checking / quote selection; reanalyse | Source comparison is optional; maxClaims=0 disables quotes |
| `maxSources` — Wikipedia sources per claim | Number of retrieved articles; not a guarantee of independence or accuracy. | `2` | 1–5; integer; sources | Source checking / quote selection; reanalyse | Source comparison is optional; maxClaims=0 disables quotes |
| `searchTerms` — Search words per claim | After filtering common words. | `6` | 3–12; integer; words | Source checking / quote selection; reanalyse | Source comparison is optional; maxClaims=0 disables quotes |
| `excerptChars` — Maximum source excerpt length | The two closest paragraphs are selected; long text may exceed model capacity. | `4000` | 500–8000; integer; chars | Source checking / quote selection; reanalyse | Source comparison is optional; maxClaims=0 disables quotes |
| `sourceTimeoutMs` — Source request timeout | Missing evidence remains unverified. | `12000` | 2000–30000; integer; ms | Source checking / quote selection; reanalyse | Source comparison is optional; maxClaims=0 disables quotes |
| `claimMinChars` — Minimum sentence quote length | Quotes are selected from the original speech. | `25` | 10–100; integer; chars | Source checking / quote selection; reanalyse | Source comparison is optional; maxClaims=0 disables quotes |
| `claimMaxChars` — Maximum sentence quote length | Keeps comparisons short and readable. | `350` | 100–600; integer; chars | Source checking / quote selection; reanalyse | Source comparison is optional; maxClaims=0 disables quotes |
| `quoteMinChars` — Minimum unpunctuated quote length | For automatic captions without sentence punctuation. | `40` | 10–100; integer; chars | Source checking / quote selection; reanalyse | Source comparison is optional; maxClaims=0 disables quotes |
| `quoteMaxChars` — Maximum unpunctuated quote length | Combines consecutive speech from the same excerpt. | `320` | 100–600; integer; chars | Source checking / quote selection; reanalyse | Source comparison is optional; maxClaims=0 disables quotes |

## Video segments

| Setting | Purpose | Default | Constraints | Effect | Dependencies |
|---|---|---|---|---|---|
| `windowMin` — Target excerpt duration | Splits at transcript timestamps. | `25` | 20–30; integer; seconds | Analysis; reanalyse | Custom analysis rules are unvalidated; release gate is independent |
| `windowMax` — Maximum excerpt duration | Longer excerpts separate filler less precisely. | `40` | 30–40; integer; seconds | Analysis; reanalyse | Custom analysis rules are unvalidated; release gate is independent |
| `windowChars` — Maximum excerpt text length | Starts a new excerpt when this text budget is reached. | `1100` | 300–2000; integer; chars | Analysis; reanalyse | Custom analysis rules are unvalidated; release gate is independent |
| `gapSeconds` — Maximum inferred caption duration | Only used when end times are missing. Inferred boundaries cannot enable automatic skipping. | `5` | 1–10; integer; seconds | Analysis; reanalyse | Custom analysis rules are unvalidated; release gate is independent |
| `maxWindows` — Maximum analysis excerpts | Videos exceeding this need to be split. | `600` | 50–1000; integer; segments | Analysis; reanalyse | Custom analysis rules are unvalidated; release gate is independent |
| `maxSegments` — Maximum analysis intervals | Excess intervals fail explicitly; judgments are never merged across missing coverage. | `1000` | 100–1000; integer; segments | Analysis; reanalyse | Custom analysis rules are unvalidated; release gate is independent |

## Laya questions

| Setting | Purpose | Default | Constraints | Effect | Dependencies |
|---|---|---|---|---|---|
| `typeQuestion` — Content-type question | Changing wording can change Laya accuracy. Keep questions short. | `"What type of text is this?"` | 1–600 characters | Analysis; reanalyse | Custom analysis rules are unvalidated; release gate is independent |
| `explanationChoice` — Useful explanation option | Description of the internal explanation choice. | `"Technical explanation"` | 1–600 characters | Analysis; reanalyse | Custom analysis rules are unvalidated; release gate is independent |
| `advertisementChoice` — Advertisement option | Description of the internal advertisement choice. | `"Advertisement"` | 1–600 characters | Analysis; reanalyse | Custom analysis rules are unvalidated; release gate is independent |
| `storyChoice` — Story option | Stories are preserved; this content-type option is not a filler label. | `"Personal anecdote"` | 1–600 characters | Analysis; reanalyse | Custom analysis rules are unvalidated; release gate is independent |
| `greetingChoice` — Greeting option | Introductions still need to pass the filler rules. | `"Greeting"` | 1–600 characters | Analysis; reanalyse | Custom analysis rules are unvalidated; release gate is independent |
| `recommendationChoice` — Opinion or recommendation option | Meaningful assessments can be useful even when they are not factual claims. | `"Opinion or recommendation"` | 1–600 characters | Analysis; reanalyse | Custom analysis rules are unvalidated; release gate is independent |
| `factQuestion` — Fact or opinion question | Only selects quotes for optional source comparison; never affects usefulness. | `"What kind of statement is this?"` | 1–600 characters | Analysis; reanalyse | Custom analysis rules are unvalidated; release gate is independent |
| `factChoice` — Factual statement option | Description of the internal fact choice. | `"Factual statement"` | 1–600 characters | Analysis; reanalyse | Custom analysis rules are unvalidated; release gate is independent |
| `opinionChoice` — Personal opinion option | Description of the internal opinion choice. | `"Personal opinion"` | 1–600 characters | Analysis; reanalyse | Custom analysis rules are unvalidated; release gate is independent |
| `requestChoice` — Request option | Description of the internal request choice. | `"Request"` | 1–600 characters | Analysis; reanalyse | Custom analysis rules are unvalidated; release gate is independent |
| `relevanceQuestion` — Goal relevance question | Only used when you enter a viewing goal in the side panel. | `"Which topic matches this excerpt?"` | 1–600 characters | Analysis; reanalyse | Only with a nonblank viewing goal |
| `unrelatedChoice` — Unrelated topic option | Your viewing goal is entered in the side panel. | `"Unrelated topic"` | 1–600 characters | Analysis; reanalyse | Only with a nonblank viewing goal |
| `compareQuestion` — Source comparison question | Uses Supported, Contradicted, and Not enough information choices. | `"Does the source support or contradict the claim?"` | 1–600 characters | Source checking / quote selection; reanalyse | Source comparison is optional; maxClaims=0 disables quotes |
| `analyzeTokens` — Laya analysis token budget | Excerpts truncated by the model stay unknown. | `2048` | 512–4096; integer; tokens | Analysis; reanalyse | Custom analysis rules are unvalidated; release gate is independent |
| `compareTokens` — Laya comparison token budget | Larger budgets use more memory and processing time. | `4096` | 1024–8192; integer; tokens | Source checking / quote selection; reanalyse | Source comparison is optional; maxClaims=0 disables quotes |

## Limits & memory

| Setting | Purpose | Default | Constraints | Effect | Dependencies |
|---|---|---|---|---|---|
| `maxDuration` — Maximum video duration | The supported upper limit is six hours. | `21600` | 60–21600; integer; seconds | Analysis; reanalyse | See purpose and global constraints below |
| `maxCues` — Maximum caption timestamps | Limits transcript size. | `20000` | 100–20000; integer; cues | Analysis; reanalyse | See purpose and global constraints below |
| `maxTextChars` — Maximum video transcript length | Text budget supported by this version. | `160000` | 1000–160000; integer; chars | Analysis; reanalyse | See purpose and global constraints below |
| `maxCueChars` — Maximum single caption length | Protects reading large transcript files. | `12000` | 500–12000; integer; chars | Analysis; reanalyse | See purpose and global constraints below |
| `cacheEntries` — Analysis results kept in memory | Zero disables reuse; the current result remains available for fact checking. | `20` | 0–100; integer; videos | Memory retention; no reclassification | See purpose and global constraints below |
| `cacheHours` — Analysis retention time | Memory only. Transcripts are never written to disk. | `6` | 1–24; integer; hours | Memory retention; no reclassification | See purpose and global constraints below |
