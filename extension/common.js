export const labels = { keep: 'Watch', skip: 'Skip', context: 'Optional', unknown: 'Unknown' };
export function time(seconds) {
  const n = Math.max(0, Math.floor(seconds));
  const h = Math.floor(n / 3600), m = Math.floor(n / 60) % 60, s = n % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}
export function parseTime(value) {
  const text = value.trim().replace(/[٠-٩]/g, x => String('٠١٢٣٤٥٦٧٨٩'.indexOf(x))).replace(/[۰-۹]/g, x => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(x)));
  if (!/^\d+(?::\d{1,2}){1,2}(?:[.,]\d+)?$/.test(text)) return NaN;
  const pieces = text.replace(',', '.').split(':').map(Number);
  if (pieces.slice(1).some(n => n >= 60)) return NaN;
  return pieces.reduce((n, part) => n * 60 + part, 0);
}
export function parseTranscript(raw) {
  const lines = raw.replace(/\r/g, '').split('\n');
  const cues = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const range = line.match(/^(\d+(?::\d{1,2}){1,2}(?:[.,]\d+)?)\s*-->\s*(\d+(?::\d{1,2}){1,2}(?:[.,]\d+)?)/);
    const single = line.match(/^(\d+(?::\d{1,2}){1,2})\s*(.*)$/);
    if (!range && !single) continue;
    const start = parseTime((range || single)[1]);
    const end = range ? parseTime(range[2]) : null;
    const words = range ? [] : [single[2]];
    while (i + 1 < lines.length && lines[i + 1].trim() && !/^\d+(?::\d{1,2}){1,2}/.test(lines[i + 1].trim())) {
      words.push(lines[++i].replace(/<[^>]+>/g, '').trim());
    }
    const text = words.join(' ').trim();
    if (Number.isFinite(start) && text) cues.push({ start, ...(Number.isFinite(end) ? { end } : {}), text });
  }
  return cues.sort((a, b) => a.start - b.start);
}
// Only explicit, confident filler is skipped. Optional context is preserved.
export function skipTarget(segments, current, enabled, isAd = false) {
  if (!enabled || isAd) return null;
  const segment = segments.find(s => s.start <= current && current < s.end);
  return segment?.kind === 'skip' && segment.confidence === 'high' && segment.autoSkipEligible === true ? segment.end : null;
}
