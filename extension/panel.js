import { labels, time, parseTranscript } from './common.js';
import { readVideo, readBrowserCaptions, seekVideo, setSkipping, setImportantMarkers } from './content.js';
import { LOCAL_TOKEN } from './local-config.js';
const $ = selector => document.querySelector(selector);
const demo = new URL(location.href).searchParams.get('demo') === '1';
const extension = Boolean(globalThis.chrome?.runtime?.id);
const service = 'http://127.0.0.1:4318';
let token = '', input = null, result = null, tabId = null, busy = false, controller = null, usefulOnly = false, generation = 0, goalEdited = false;
function status(text = '', error = false) { $('#status').textContent = text; $('#status').classList.toggle('error', error); }
function loading(on, text) {
  busy = on; $('#analyze').disabled = on; $('#manual-analyze').disabled = on; $('#verify').disabled = on;
  $('#cancel').hidden = !on; $('#analyze').firstChild.textContent = on ? 'Analysing… ' : 'Analyse this video ';
  if (text) status(text);
}
function el(tag, text, className) { const node = document.createElement(tag); if (text) node.textContent = text; if (className) node.className = className; return node; }
function intervalLabel(s) { return s.end - s.start < 1 ? `Under 1s at ${time(s.start)}` : `${time(s.start)} — ${time(s.end)}`; }
async function runInTab(func, args, world = 'ISOLATED', targetId = tabId) {
  if (!extension || !targetId) throw new Error('Open Worth from its toolbar icon in Chrome.');
  const data = await chrome.scripting.executeScript({ target: { tabId: targetId }, func, args, world });
  if (data[0]?.error) throw new Error(data[0].error.message);
  return data[0]?.result;
}
async function request(path, payload, signal = controller?.signal) {
  if (!token) throw new Error('Pair the extension from settings first.');
  const res = await fetch(`${service}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload), signal });
  const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Analysis failed.'); return data;
}
async function health() {
  let data;
  try { data = await (await fetch(`${service}/health`, { signal: AbortSignal.any([controller?.signal || new AbortController().signal, AbortSignal.timeout(3000)]) })).json(); }
  catch (error) { if (error.name === 'AbortError') throw error; throw new Error('Start the local service: open start.command in the Worth folder.'); }
  if (!data.ready) throw new Error(data.status === 'failed' ? 'Laya failed to start. Open local setup.' : 'Laya is warming up. Try again in a moment.');
}
async function seek(seconds) {
  try {
    if (demo) return status(`Demo: seek to ${time(seconds)}`);
    await runInTab(seekVideo, [result.videoId, seconds]); status(`Jumped to ${time(seconds)}`);
  } catch (error) { status(error.message, true); }
}
function renderSegments() {
  $('#segments').replaceChildren();
  const factsLabel = { supported: 'Supported by source', contradicted: 'Contradicted by source', context: 'Needs context', unverified: 'Unverified' };
  result.segments.forEach((s, i) => {
    if (usefulOnly && s.kind !== 'keep') return;
    const row = el('article', '', `segment ${s.kind}`);
    const top = el('div', '', 'segment-top');
    const stamp = el('button', intervalLabel(s), 'timestamp');
    stamp.setAttribute('aria-label', `${labels[s.kind]}: ${s.title}. Jump to ${time(s.start)}`); stamp.onclick = () => seek(s.start);
    top.append(stamp, el('span', labels[s.kind], 'tag')); row.append(top, el('h3', s.title), el('p', s.reason));
    if (s.confidence === 'low' && s.kind !== 'unknown') row.append(el('p', 'This classification is uncertain.', 'footnote'));
    if (s.facts) {
      const fact = el('div', '', `fact ${s.facts.status}`);
      fact.append(el('strong', factsLabel[s.facts.status]), el('p', s.claim), el('p', s.facts.note));
      for (const source of s.facts.sources) {
        if (!/^https?:\/\//.test(source.url)) continue;
        const link = el('a', `${source.title} ↗`); link.href = source.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; fact.append(link);
      }
      row.append(fact);
    }
    row.dataset.index = i; $('#segments').append(row);
  });
}
function render() {
  const verdicts = { worth: 'Worth watching.', selective: 'Watch selectively.', skip: 'You can skip it.', uncertain: 'The value is uncertain.' };
  $('#intro').hidden = true; $('#results').hidden = false; $('#manual').hidden = true;
  $('#video-info').hidden = false; $('#video-title').textContent = result.title;
  $('#verdict-label').textContent = 'Quick usefulness verdict'; $('#verdict-title').textContent = verdicts[result.verdict]; $('#verdict-reason').textContent = result.reason;
  $('#watch-time').textContent = time(result.totals.keep); $('#total-time').textContent = `of ${time(result.duration)} · optional context ${time(result.totals.context)}`;
  $('#timeline').replaceChildren();
  for (const s of result.segments) {
    const b = el('button', '', s.kind); b.style.flexGrow = String(s.end - s.start);
    b.title = `${intervalLabel(s)} · ${labels[s.kind]} · ${s.title}`;
    b.setAttribute('aria-label', b.title); b.onclick = () => seek(s.start); $('#timeline').append(b);
  }
  $('#auto-skip').checked = false; $('#auto-skip').disabled = !result.segments.some(s => s.kind === 'skip' && s.confidence === 'high' && s.autoSkipEligible === true);
  $('#verify').hidden = !result.segments.some(s => s.claim);
  $('#facts-note').textContent = 'Transcript-based suggestions; visual content may change the judgment. Source comparison is optional.';
  $('#skip-note').textContent=result.reliability?.automaticSkippingValidated?'Validated filler only · off until you choose':'Unavailable · reliability checks have not passed';
  $('#auto-skip').title=result.reliability?.automaticSkippingValidated?'Enable validated filler skipping for this video only.':'Automatic skipping unavailable: the classifier has not passed the release evaluation, or this configuration is unvalidated.';
  renderSegments();
}
async function stopSkipping() {
  if (result && !demo) { try { await runInTab(setSkipping, [result.videoId, [], false]); } catch {} }
  $('#auto-skip').checked = false;
}
async function analyze(manual = false) {
  if (busy) return;
  if (demo) { const { sample } = await import('./demo.js'); result = structuredClone(sample); render(); return status('Interface demo, not a real analysis.'); }
  if (!extension) return status('Install the Chrome extension to analyse the current video.', true);
  const epoch=++generation, oldResult=result, oldTab=tabId;
  controller = new AbortController(); const signal = controller.signal;
  const check=()=>{if(signal.aborted||generation!==epoch)throw new DOMException('Cancelled','AbortError');};
  let localInput=input?structuredClone(input):null, localTab=tabId;
  loading(true, 'Reading the transcript and timestamps…'); $('#results').hidden = true;
  try {
    if (!token) { $('#settings').hidden = false; $('#settings-toggle').setAttribute('aria-expanded', 'true'); throw new Error('Copy the pairing code from local setup and paste it here.'); }
    if(oldResult&&oldTab){try{await runInTab(setSkipping,[oldResult.videoId,[],false],'ISOLATED',oldTab);await runInTab(setImportantMarkers,[oldResult.videoId,oldResult.duration,[],false],'ISOLATED',oldTab);}catch{}}
    check();await health();check();
    const rulesResponse = await fetch(`${service}/api/rules`, {headers:{Authorization:`Bearer ${token}`},signal});
    const rulesData = await rulesResponse.json();
    if(!rulesResponse.ok) throw new Error(rulesData.error || "Could not load rules.");
    check();const rules = rulesData.rules;
    if(!goalEdited)$('#goal').value=rules.defaultViewingGoal||'';
    if (manual) {
      if (!localInput) throw new Error('Open a video and try reading its captions first.');
      localInput.cues = parseTranscript($('#transcript').value);
      localInput.captionSource = 'manual'; localInput.language = '';
      if (!localInput.cues.length) throw new Error('Use a timestamped transcript, such as 0:00, or an SRT / VTT file.');
    } else {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); check();localTab=tab?.id;tabId=localTab;
      localInput = await runInTab(readVideo, [false,rules],'ISOLATED',localTab);check();input=localInput;
      check();
      if (!localInput) throw new Error('Could not read this video. Reload the page and click the extension icon.');
      $('#video-info').hidden = false; $('#video-title').textContent = localInput.title;
      let captionError = '';
      {
        status('Reading original captions from the YouTube player…');
        const captions = await runInTab(readBrowserCaptions, [localInput.videoId, localInput.duration,rules], 'MAIN',localTab).catch(() => null);
        check();
        if (captions?.cues?.length) {
          localInput.cues = captions.cues; localInput.captionSource = 'browser'; localInput.language = captions.language;
        }
      }
      if (!localInput.cues.length) {
        status('Waiting for the YouTube transcript panel…');
        localInput = await runInTab(readVideo, [true,rules],'ISOLATED',localTab);check();input=localInput;
        check();
      }
      if (!localInput.cues.length && rules.publicFallback) {
        status('Trying public YouTube captions…');
        try { const captions=await request('/api/transcript',{input:localInput},signal); localInput.cues=captions.cues; localInput.language=captions.language; localInput.captionSource='public'; } catch(error) { if(signal.aborted) throw error; captionError=error.message; }
      }
      if (!localInput.cues.length) { $('#manual').hidden = false; throw new Error(captionError || 'No transcript appeared. Open Show transcript on YouTube, or use a transcript file below.'); }
    }
    localInput.goal = $('#goal').value;
    status('Classifying useful speech and filler… Time depends on video length.');
    const progressTimer = setInterval(async () => {
      try { const p = await (await fetch(`${service}/api/progress?videoId=${localInput.videoId}`, {headers:{Authorization:`Bearer ${token}`},signal})).json(); if(p.total && !signal.aborted && generation===epoch) status(`Laya analysing locally · ${p.completed} of ${p.total} excerpts`); } catch {}
    }, 1500);
    let data;
    try { data = await request('/api/analyze', { input:localInput },signal); } finally { clearInterval(progressTimer); }
    check();
    check();input=localInput;result = data.result; render();
    let markers = null;
    try { markers = await runInTab(setImportantMarkers, [result.videoId, result.duration, result.segments, rules.showImportantOnPlayer],'ISOLATED',localTab); } catch {}
    check();
    const source = localInput.captionSource === 'browser' ? 'original player captions' : localInput.captionSource === 'transcript-panel' ? 'YouTube transcript panel' : 'video transcript';
    const language = /^en(?:-|$)/i.test(localInput.language || '') ? ' (English)' : '';
    const markerNote = rules.showImportantOnPlayer ? markers?.count ? ' Useful moments are marked green on the player.' : markers ? ' No useful moments to highlight.' : ' Player highlights unavailable; try analysing again.' : '';
    status(`Map ready · ${source}${language} · ${localInput.cues.length} timestamps.${markerNote} Click a time to jump there.`);
  } catch (error) { if(generation===epoch)status(signal.aborted ? 'Analysis cancelled.' : error.message, !signal.aborted); }
  finally { if(generation===epoch){loading(false); controller = null;} }
}
$('#dashboard-open').onclick = () => extension ? chrome.runtime.openOptionsPage() : window.open(`${service}/dashboard`, '_blank', 'noopener');
$('#analyze').onclick = () => analyze(); $('#manual-analyze').onclick = () => analyze(true);
$('#cancel').onclick = () => controller?.abort();
$('#goal').oninput=()=>{goalEdited=true;};
$('#settings-toggle').onclick = () => { $('#settings').hidden = !$('#settings').hidden; $('#settings-toggle').setAttribute('aria-expanded', String(!$('#settings').hidden)); };
$('#pair-form').onsubmit = async e => {
  e.preventDefault(); token = $('#pair-code').value.trim();
  if (!/^[a-f0-9]{48}$/.test(token)) return status('Use the exact pairing code shown in local setup.', true);
  if (!extension) return status('Paste the code inside the Chrome extension.', true);
  await chrome.storage.local.set({ pairToken: token }); $('#pair-code').value = ''; $('#settings').hidden = true; $('#settings-toggle').setAttribute('aria-expanded','false'); status('Paired.'); await analyze();
};
$('#caption-file').onchange = async e => {
  const file = e.target.files[0]; if (!file) return;
  if (file.size > 1500000) return status('Transcript file too large. Maximum: 1.5 MB.', true);
  $('#transcript').value = await file.text(); status('Transcript ready. Click Analyse transcript.');
};
$('#useful-filter').onclick = () => { usefulOnly = !usefulOnly; $('#useful-filter').setAttribute('aria-pressed', String(usefulOnly)); $('#useful-filter').textContent = usefulOnly ? 'All segments' : 'Useful only'; renderSegments(); };
$('#auto-skip').onchange = async e => {
  try {
    if (demo) return status(e.target.checked ? 'Demo: only clear, high-confidence filler is skipped.' : 'Demo: automatic skipping is off.');
    await runInTab(setSkipping, [result.videoId, result.segments, e.target.checked]);
    status(e.target.checked ? 'Automatic filler skipping is on. Turn it off at any time.' : 'Automatic skipping is off.');
  } catch (error) { e.target.checked = false; status(error.message, true); }
};
$('#verify').onclick = async () => {
  if (demo || busy) return;
  const epoch=++generation,checkedResult=result;controller = new AbortController(); const signal = controller.signal; loading(true, 'Finding sources for key claims…');
  try {
    const data = await request('/api/verify', { input,analysisId:checkedResult.analysisId },signal);
    if (signal.aborted||generation!==epoch||result!==checkedResult) throw new DOMException('Cancelled','AbortError');
    for (const check of data.checks) if (result.segments[check.segmentIndex]) result.segments[check.segmentIndex].facts = check;
    renderSegments(); $('#verify').hidden = true;
    $('#facts-note').textContent = `Compared ${data.checks.length} quoted claims with public sources using local Laya. This is not a check of every statement; missing evidence does not mean a claim is false.`;
    status('Source checks are shown alongside the relevant segments.');
  } catch (error) { if(generation===epoch)status(signal.aborted ? 'Source comparison cancelled.' : error.message, !signal.aborted); }
  finally { if(generation===epoch){loading(false); controller = null;} }
};
function changed() {
  ++generation;controller?.abort();controller=null;loading(false);const oldResult = result; result = null;
  if (oldResult && tabId) chrome.scripting.executeScript({target:{tabId},func:setSkipping,args:[oldResult.videoId,[],false]}).catch(() => {});
  input = null; $('#results').hidden = true; $('#manual').hidden = true; $('#video-info').hidden = true; $('#intro').hidden = false;
  status('The video or tab changed. Click Worth to analyse the new video.');
}
if (demo) {
  $('#demo-banner').hidden = false; $('#goal-details').hidden = true; $('#analyze').hidden = true; $('#settings-toggle').hidden = true; $('#dashboard-open').hidden = true;
  await analyze();
} else if (extension) {
  token = LOCAL_TOKEN || (await chrome.storage.local.get('pairToken')).pairToken || '';
  chrome.tabs.onActivated.addListener(changed);
  chrome.runtime.onMessage.addListener(message => { if(message.type === 'worth-analyze') analyze(); });
  chrome.tabs.onUpdated.addListener((id, change) => { if (id === tabId && (change.url || change.status === 'loading')) changed(); });
  if (token) await analyze();
  else status('Pair the extension in settings to begin.');
} else { status('This is the extension page. Use the demo or install it in Chrome.'); }
