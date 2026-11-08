# HTTP and worker API

Base address: `http://127.0.0.1:4318`. The server binds loopback only. JSON APIs require `Authorization: Bearer <local-pairing-code>` and POST bodies require `Content-Type: application/json`. Never commit a real code. Host must be `127.0.0.1:PORT` or `localhost:PORT`; permitted browser origins are the exact 127.0.0.1 origin and Chrome extension origins. Pairing remains required for extensions. Setup/dashboard HTML cannot be read cross-origin.

## Routes

| Method / route | Request | Response / behavior |
|---|---|---|
| GET `/health` | None; unauthenticated | `{ready, provider:"Laya", model, device, status, local:true}` |
| GET `/setup` | Local top-level page | Pairing/setup page; sensitive token is shown only locally |
| GET `/dashboard` | Local top-level page | Settings page, with local pairing metadata removed from DOM by its module |
| GET `/api/rules` | Auth | `{version:2, rules, notes, classifier, recommended}` |
| POST `/api/rules` | `{version:2,rules:{…}}`; unversioned complete rules retained for API compatibility | Validated settings, persisted atomically; v1 accepted through migration |
| POST `/api/transcript` | `{input:{videoId,duration,title}}` | `{cues:[{start,end,text}],language}`; original public captions only |
| POST `/api/analyze` | `{input:{videoId,duration,title,goal,cues}}` | `{result,cached}` |
| GET `/api/progress?videoId=abcdefghijk` | Auth | `{completed,total}` or `{}` |
| POST `/api/verify` | `{input,analysisId}` | `{checks:[{segmentIndex,status,note,sources}]}`; optional analysisId preserves older clients |

Static panel/demo/settings modules remain available for local preview. HTTP `/local-config.js` always returns an empty credential. `/api/configure` does not exist.

## Analysis example (synthetic)

```json
{"input":{"videoId":"abcdefghijk","duration":12,"title":"Example lesson","goal":"","cues":[{"start":0,"end":12,"text":"A worked example explains the concept."}]}}
```

Result shape (illustrative, not a model prediction):

```json
{"result":{"videoId":"abcdefghijk","title":"Example lesson","duration":12,"verdict":"worth","reason":"Useful passages cover 100% of the video.","segments":[{"start":0,"end":12,"kind":"keep","confidence":"high","title":"Useful explanation","reason":"Explains the topic.","claim":"","facts":null,"autoSkipEligible":false}],"totals":{"keep":12,"context":0,"skip":0,"unknown":0},"transcriptOnly":true,"provider":"Laya","local":true,"analysisId":"sha256 fingerprint","classifierIdentity":"sha256 fingerprint","reliability":{"recommended":true,"automaticSkippingValidated":false}},"cached":false}
```

`keep / context / skip / unknown` remain compatible. New metadata is additive. Verdict is `worth / selective / skip / uncertain`. Source statuses are `supported / contradicted / context / unverified`, describing retrieved-source agreement rather than universal truth.

## Errors, cancellation and concurrency

Errors are `{error:"English explanation"}`: 400 invalid input/settings, unavailable model/captions or missing matching analysis; 401 pairing; 403 host/origin; 404 route; 429 another request is running. Body ceiling is 1.5 MB. Configurable validation has additional duration/cue/text ceilings. Client disconnect aborts the worker request. There is no separate cancel route. The panel cancels with AbortController. Request timeout is 300 seconds; model inference cannot be interrupted mid-forward-pass.

## Worker protocol

stdin/stdout are NDJSON. stdout is protocol-only; dependencies write diagnostics to stderr.

```json
{"id":1,"type":"analyze","data":{"videoId":"abcdefghijk","duration":12,"cues":[],"rules":{},"recommended":true}}
{"id":1,"event":"progress","completed":1,"total":3}
{"id":1,"result":{"verdict":"uncertain","reason":"Normalized by service","segments":[]}}
{"type":"cancel","id":1}
```

The incomplete `cues` and `rules` above illustrate framing only. Real requests carry validated complete inputs. Types: `analyze`, `transcript`, `compare`; startup emits `ready` or `fatal`. Failures emit `{id,error,errorType}`. Comparison data contains `items` with claim, text, segmentIndex and sourceIndex. Correlated IDs prevent a canceled result from resolving another request.
