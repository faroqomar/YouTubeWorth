import { defaults, isRecommended } from '../extension/rules.js';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
export const classifierProfile=JSON.parse(readFileSync(new URL('../classifier-config.json',import.meta.url),'utf8'));
export const classifierIdentity=cacheKey(classifierProfile);
export function validateInput(input,rules=defaults) {
  if (!input || typeof input !== 'object' || !/^[A-Za-z0-9_-]{11}$/.test(input.videoId || '')) throw new Error('Open a regular YouTube video first.');
  if (!Number.isFinite(input.duration) || input.duration < 1 || input.duration > rules.maxDuration) throw new Error('Video duration is unavailable or exceeds your configured limit.');
  if (!Array.isArray(input.cues) || !input.cues.length || input.cues.length > rules.maxCues) throw new Error('A timestamped transcript is required and must fit your configured limits.');
  let last = -1;
  for (const c of input.cues) {
    if (!Number.isFinite(c.start) || c.start < 0 || c.start >= input.duration || c.start < last || typeof c.text !== 'string' || !c.text.trim() || c.text.length > rules.maxCueChars) throw new Error('Invalid caption timestamps or size. Try a complete SRT or VTT transcript.');
    if (c.end !== undefined && (!Number.isFinite(c.end) || c.end <= c.start || c.end > input.duration + 1)) throw new Error('Invalid caption end timestamp.');
    last = c.start;
  }
  if (input.cues.reduce((n, c) => n + c.text.length, 0) > rules.maxTextChars) throw new Error('Transcript exceeds your configured text limit. Split it before analysing.');
  return { videoId: input.videoId, duration: input.duration, title: String(input.title || '').slice(0, 300), goal: String(input.goal ?? rules.defaultViewingGoal).trim().slice(0, 300), cues: input.cues.map(c => ({ start: c.start, ...(c.end !== undefined ? { end: c.end } : {}), text: c.text })) };
}
export function cacheKey(input) { return createHash('sha256').update(JSON.stringify(input)).digest('hex'); }
export function normalizeResult(raw, input,rules=defaults) {
 if(!raw||!Array.isArray(raw.segments)||!raw.segments.length||raw.segments.length>rules.maxSegments)throw new Error('Incomplete analysis. Try a shorter video.');
 const segments=[];let cursor=0;
 const unknown=(start,end)=>({start,end,kind:'unknown',confidence:'low',title:'Unknown interval',reason:'No complete transcript analysis covers this interval.',claim:'',facts:null,autoSkipEligible:false});
 const coverage=[];
 for(let i=0;i<input.cues.length;i++){
  const c=input.cues[i],end=Math.min(input.duration,c.end??Math.min(input.cues[i+1]?.start??input.duration,c.start+rules.gapSeconds));
  if(end>c.start){const prev=coverage.at(-1);if(prev&&c.start<=prev[1])prev[1]=Math.max(prev[1],end);else coverage.push([c.start,end]);}
 }
 for(const s of raw.segments){
  if(!Number.isFinite(s.start)||!Number.isFinite(s.end)||s.start<cursor||s.end<=s.start||s.end>input.duration||!['keep','skip','context','unknown'].includes(s.kind)||!['high','medium','low'].includes(s.confidence)||!['title','reason','claim'].every(k=>typeof s[k]==='string'))throw new Error('The analysis returned overlapping or invalid intervals. Try again.');
  if(s.start>cursor)segments.push(unknown(cursor,s.start));
  let point=s.start;
  for(const [a,b] of coverage){
   const start=Math.max(a,s.start),end=Math.min(b,s.end);if(end<=start)continue;
   if(start>point)segments.push(unknown(point,start));
   const trusted=s.boundariesTrusted===true && input.cues.filter(c=>c.start<end&&(c.end??c.start+rules.gapSeconds)>start).every(c=>Number.isFinite(c.end));
   const eligible=classifierProfile.releaseGatePassed===true&&isRecommended(rules)&&s.autoSkipEligible===true&&trusted&&start===s.start&&end===s.end&&s.kind==='skip'&&s.confidence==='high';
   segments.push({...s,start,end,title:s.title.slice(0,90),reason:s.reason.slice(0,240),claim:s.claim.slice(0,rules.claimMaxChars),facts:null,autoSkipEligible:eligible});point=end;
  }
  if(point<s.end)segments.push(unknown(point,s.end));cursor=s.end;
 }
 if(cursor<input.duration)segments.push(unknown(cursor,input.duration));
 const totals=segments.reduce((r,s)=>{r[s.kind]+=s.end-s.start;return r;},{keep:0,skip:0,context:0,unknown:0});
 const ratio=totals.keep/input.duration;
 const verdict=totals.unknown/input.duration>rules.unknownRatio?'uncertain':ratio>=rules.worthRatio?'worth':ratio>=rules.selectiveRatio?'selective':totals.skip/input.duration>=rules.skipRatio?'skip':'uncertain';
 const useful=Math.round(100*ratio),unknownShare=Math.round(100*totals.unknown/input.duration);
 const reason={worth:`Useful passages cover ${useful}% of the video. Review preserved context as needed.`,selective:`Useful passages cover ${useful}% of the video. Green markers show those moments.`,skip:'Clear filler dominates the covered timeline. Review the map before deciding to skip.',uncertain:`The map is inconclusive: ${useful}% useful and ${unknownShare}% unknown coverage.`}[verdict];
 return {videoId:input.videoId,title:input.title,duration:input.duration,verdict,reason,segments,totals,transcriptOnly:true,analyzedAt:new Date().toISOString(),classifierIdentity,reliability:{recommended:isRecommended(rules),automaticSkippingValidated:classifierProfile.releaseGatePassed&&isRecommended(rules),status:classifierProfile.status}};
}
