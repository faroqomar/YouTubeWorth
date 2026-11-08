// Runs only after a user grants activeTab by clicking the extension action.
export async function readVideo(openTranscript = true, rules = null) {
  const id = new URL(location.href).searchParams.get('v');
  if (location.hostname !== 'www.youtube.com' || location.pathname !== '/watch' || !id) throw new Error('Open a regular YouTube video, then click Worth.');
  const video = document.querySelector('video.html5-main-video') || document.querySelector('video');
  if (!video || !Number.isFinite(video.duration)) throw new Error('Wait for the video to load. Live streams are not supported.');
  if (document.querySelector('.html5-video-player.ad-showing')) throw new Error('Wait for the player ad to finish, then analyse the video.');
  const parse = value => {
    const t = value.trim().replace(/[٠-٩]/g, x => String('٠١٢٣٤٥٦٧٨٩'.indexOf(x))).replace(/[۰-۹]/g, x => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(x)));
    if (!/^\d+(?::\d{1,2}){1,2}$/.test(t)) return NaN;
    return t.split(':').map(Number).reduce((n, x) => n * 60 + x, 0);
  };
  const collect = () => {
    const watch = document.querySelector(`ytd-watch-flexy[video-id="${id}"]:not([hidden])`) || document;
    const rows = [...watch.querySelectorAll('ytd-transcript-segment-renderer, transcript-segment-view-model')];
    const seen = new Set();
    return rows.flatMap(row => {
      if (row.closest('[hidden], [visibility="ENGAGEMENT_PANEL_VISIBILITY_HIDDEN"]')) return [];
      const stamp = row.querySelector('.segment-timestamp, .ytwTranscriptSegmentViewModelTimestamp')?.textContent;
      const words = row.querySelector('.segment-text, .ytwTranscriptSegmentViewModelText')?.textContent;
      const start = stamp ? parse(stamp) : NaN;
      const text = words?.trim();
      const key = `${start}:${text}`;
      if (!Number.isFinite(start) || !text || seen.has(key)) return [];
      seen.add(key); return [{ start, text }];
    }).sort((a, b) => a.start - b.start);
  };
  let cues = collect();
  if (!cues.length && openTranscript) {
    const watch = document.querySelector(`ytd-watch-flexy[video-id="${id}"]:not([hidden])`) || document;
    const candidates = [...watch.querySelectorAll('ytd-video-description-transcript-section-renderer button, button, ytd-button-renderer')]
      .filter(el => /^(show transcript|عرض النص|إظهار النص|عرض نص الفيديو)$/i.test(el.textContent.trim()));
    const opener = candidates.find(el => el.getClientRects().length > 0) || candidates[0];
    if (opener) opener.click();
    const deadline = Date.now() + (rules?.panelWaitMs ?? 15000);
    let lastCount = 0, stable = 0;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 350));
      cues = collect();
      stable = cues.length && cues.length === lastCount ? stable + 1 : 0;
      lastCount = cues.length;
      if (stable >= 3) break;
    }
  }
  if (new URL(location.href).searchParams.get('v') !== id) throw new Error('The video changed while reading captions. Analyse the new video.');
  return { videoId: id, title: document.querySelector('h1.ytd-watch-metadata')?.textContent.trim() || document.title.replace(/ - YouTube$/, ''), duration: video.duration, cues, captionSource: cues.length ? 'transcript-panel' : '' };
}
// MAIN world: use the current player's original caption tracks, in the same
// browser session as playback. Signed URLs stay inside YouTube, never on disk.
export async function readBrowserCaptions(videoId, duration, rules = null) {
  if (location.hostname !== 'www.youtube.com' || new URL(location.href).searchParams.get('v') !== videoId) return { cues: [] };
  const player = document.querySelector('#movie_player');
  const response = player?.getPlayerResponse?.();
  if (response?.videoDetails?.videoId !== videoId) return { cues: [], reason: 'player-unavailable' };
  const tracks = response.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
  const original = tracks.filter(t => !t.vssId?.startsWith('t.'));
  const preferred = (rules?.preferredLanguage || 'en').toLowerCase();
  const matching = original.filter(t => t.languageCode?.toLowerCase() === preferred || t.languageCode?.toLowerCase().split('-')[0] === preferred.split('-')[0]);
  const track = ((rules?.preferManual ?? true) ? matching.find(t => t.kind !== 'asr') : null) || matching[0] || original[0];
  if (!track) return { cues: [], reason: 'no-tracks' };
  const url = new URL(track.baseUrl, location.origin);
  if (url.origin !== location.origin || url.pathname !== '/api/timedtext' || url.searchParams.get('v') !== videoId) return { cues: [], reason: 'invalid-track' };
  url.searchParams.delete('tlang'); url.searchParams.set('fmt', 'json3');
  try {
    const res = await fetch(url.href, { credentials: 'same-origin', signal: AbortSignal.timeout(rules?.captionTimeoutMs ?? 12000) });
    if (!res.ok) return { cues: [], reason: `caption-http-${res.status}` };
    const body = await res.text();
    if (!body.trim()) return { cues: [], reason: 'empty-captions' };
    const data = JSON.parse(body);
    const cues = (data.events || []).flatMap(event => {
      const start = event.tStartMs / 1000, text = (event.segs || []).map(s => s.utf8 || '').join('').replace(/\s+/g, ' ').trim();
      if (!Number.isFinite(start) || start < 0 || start >= duration || !text) return [];
      const end = Math.min(duration, start + (event.dDurationMs || 0) / 1000);
      return [{ start, ...(end > start ? {end} : {}), text }];
    }).sort((a,b) => a.start - b.start);
    if (new URL(location.href).searchParams.get('v') !== videoId) return { cues: [], reason: 'video-changed' };
    return { cues, language: track.languageCode, source: 'browser' };
  } catch { return { cues: [], reason: 'caption-request-failed' }; }
}
export function seekVideo(videoId, seconds) {
  if (new URL(location.href).searchParams.get('v') !== videoId) throw new Error('This map belongs to another video. Analyse the current video.');
  if (document.querySelector('.html5-video-player.ad-showing')) throw new Error('Wait for the player ad to finish before seeking.');
  const video = document.querySelector('video');
  if (!video) throw new Error('The video player is unavailable.');
  video.currentTime = Math.min(video.duration, Math.max(0, seconds));
  return video.currentTime;
}
export function setSkipping(videoId, segments, enabled) {
  const state = globalThis.__worthWatch;
  if (state?.timer) clearInterval(state.timer);
  globalThis.__worthWatch = null;
  if (!enabled) return false;
  if (new URL(location.href).searchParams.get('v') !== videoId) throw new Error('The video changed. Analyse the current video.');
  const safeSegments = segments.filter(s => s.kind === 'skip' && s.confidence === 'high' && s.autoSkipEligible === true);
  const timer = setInterval(() => {
    if (new URL(location.href).searchParams.get('v') !== videoId) { clearInterval(timer); globalThis.__worthWatch = null; return; }
    const player = document.querySelector('.html5-video-player');
    const video = document.querySelector('video');
    if (!video || video.paused || player?.classList.contains('ad-showing')) return;
    const segment = safeSegments.find(s => s.start <= video.currentTime && video.currentTime < s.end);
    if (segment) video.currentTime = segment.end;
  }, 250);
  globalThis.__worthWatch = { timer, videoId };
  return true;
}
// Self-contained: Chrome serialises this function into the video's isolated world.
export function setImportantMarkers(videoId, duration, segments, enabled = true) {
  globalThis.__worthImportant?.dispose();
  globalThis.__worthImportant = null;
  const currentId = () => new URL(location.href).searchParams.get('v');
  if (!enabled || location.hostname !== 'www.youtube.com' || location.pathname !== '/watch' || currentId() !== videoId || !Number.isFinite(duration) || duration <= 0) return { count: 0 };
  const ranges = (Array.isArray(segments) ? segments : []).filter(s => s.kind === 'keep' && Number.isFinite(s.start) && Number.isFinite(s.end))
    .map(s => ({ start: Math.max(0, s.start), end: Math.min(duration, s.end) })).filter(s => s.end > s.start);
  if (!ranges.length) return { count: 0 };
  const layer = document.createElement('div');
  layer.dataset.worthImportant = videoId;
  layer.setAttribute('aria-hidden', 'true');
  // A separate thin row leaves YouTube's played/buffered track and hit area intact.
  layer.style.cssText = 'position:absolute;left:0;right:0;top:-7px;height:4px;pointer-events:none;z-index:40;direction:ltr;';
  for (const range of ranges) {
    const mark = document.createElement('span');
    mark.dataset.start = String(range.start); mark.dataset.end = String(range.end);
    mark.style.cssText = `position:absolute;left:${range.start / duration * 100}%;width:${(range.end - range.start) / duration * 100}%;height:100%;background:#89e36c;border-radius:2px;box-shadow:0 0 0 1px #142413,0 0 4px #0008;pointer-events:none;`;
    layer.append(mark);
  }
  let timer;
  const state = { dispose() {
    clearInterval(timer); layer.remove();
    document.removeEventListener('yt-navigate-finish', sync);
    window.removeEventListener('popstate', sync); window.removeEventListener('pagehide', state.dispose);
    if (globalThis.__worthImportant === state) globalThis.__worthImportant = null;
  } };
  function sync() {
    if (location.pathname !== '/watch' || currentId() !== videoId) return state.dispose();
    const player = document.querySelector('#movie_player');
    const bar = player?.querySelector('.ytp-progress-bar-container');
    const video = player?.querySelector('video');
    const usable = bar && video && !player.classList.contains('ad-showing') && Number.isFinite(video.duration) && Math.abs(video.duration - duration) < 2;
    layer.style.display = usable ? 'block' : 'none';
    if (bar && layer.parentElement !== bar) bar.append(layer);
  }
  globalThis.__worthImportant = state;
  document.addEventListener('yt-navigate-finish', sync);
  window.addEventListener('popstate', sync); window.addEventListener('pagehide', state.dispose);
  // Also handles player replacement and ad transitions without observing every page mutation.
  timer = setInterval(sync, 500); sync();
  return { count: ranges.length };
}
