import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInput, normalizeResult, cacheKey } from '../lib/analysis.mjs';
import { parseTime, parseTranscript, skipTarget, time } from '../extension/common.js';
const input = { videoId:'abcdefghijk',duration:180,title:'Title',goal:'',cues:[{start:0,text:'Intro'},{start:20,text:'Useful'},{start:40,text:'More'},{start:65,text:'More'},{start:90,text:'More'},{start:115,text:'More'},{start:140,text:'More'},{start:165,text:'End'}] };
input.cues=input.cues.map((c,i)=>({...c,end:input.cues[i+1]?.start??input.duration}));
const segment = (start,end,kind='keep') => ({start,end,kind,autoSkipEligible:true,confidence:'high',title:'Label',reason:'Reason',claim:''});
test('parses Arabic timestamps and rejects invalid minutes',()=>{assert.equal(parseTime('١:٢٣'),83);assert.equal(parseTime('۱:۲۳'),83);assert.equal(parseTime('01:02:03.500'),3723.5);assert.ok(Number.isNaN(parseTime('1:79')));assert.equal(time(3723),'1:02:03');});
test('parses real SRT, VTT, and copied YouTube transcripts',()=>{
  const srt='1\n00:00:02,500 --> 00:00:05,000\nHello\nworld\n\n2\n00:00:06,000 --> 00:00:09,000\nSecond';
  assert.deepEqual(parseTranscript(srt),[{start:2.5,end:5,text:'Hello world'},{start:6,end:9,text:'Second'}]);
  assert.deepEqual(parseTranscript('WEBVTT\n\n00:02.500 --> 00:05.000 align:start\n<b>Hello</b>'),[{start:2.5,end:5,text:'Hello'}]);
  assert.deepEqual(parseTranscript('0:00\nالمقدمة\n1:20 خطوة أولى\nتفاصيل\n2:00\nالنهاية'),[{start:0,text:'المقدمة'},{start:80,text:'خطوة أولى تفاصيل'},{start:120,text:'النهاية'}]);
});
test('rejects text without times',()=>assert.deepEqual(parseTranscript('A plain paragraph'),[]));
test('validates duration, IDs, text size and timestamp order',()=>{
  assert.equal(validateInput(input).duration,180);
  assert.throws(()=>validateInput({...input,videoId:'../../secret'}));
  assert.throws(()=>validateInput({...input,cues:[{start:20,text:'a'},{start:1,text:'b'}]}));
  assert.throws(()=>validateInput({...input,duration:Infinity}));
  assert.throws(()=>validateInput({...input,cues:[{start:0,end:-1,text:'a'}]}));
  assert.throws(()=>validateInput({...input,cues:Array.from({length:20},(_,i)=>({start:i,text:'a'.repeat(10000)}))}));
});
test('timeline totals are calculated from intervals, not model arithmetic',()=>{
  const r=normalizeResult({verdict:'selective',reason:'why',segments:[segment(0,20,'skip'),segment(20,150),segment(150,180,'context')]},input);
  assert.deepEqual(r.totals,{keep:130,skip:20,context:30,unknown:0});assert.equal(r.segments.at(-1).end,180);
});
test('unknown fills gaps and downgrades an incomplete verdict',()=>{
  const r=normalizeResult({verdict:'worth',reason:'why',segments:[segment(50,100)]},input);
  assert.equal(r.segments[0].kind,'unknown');assert.equal(r.totals.unknown,130);assert.equal(r.verdict,'uncertain');
});
test('missing speech and sparse visual demonstrations never become filler',()=>{
  const sparse={...input,cues:[{start:0,end:10,text:'intro'},{start:120,end:130,text:'demonstration'}]};
  const r=normalizeResult({verdict:'skip',reason:'why',segments:[segment(0,180,'skip')]},sparse);
  assert.deepEqual(r.segments.map(s=>[s.start,s.end,s.kind]),[[0,10,'skip'],[10,120,'unknown'],[120,130,'skip'],[130,180,'unknown']]);
  assert.equal(r.verdict,'uncertain');
});
test('overlaps, reversed intervals and hallucinated times are rejected',()=>{
  for(const segments of [[segment(0,100),segment(90,180)],[segment(100,0)],[segment(0,181)],[{...segment(0,180),kind:'excellent'}]]) assert.throws(()=>normalizeResult({verdict:'worth',reason:'why',segments},input));
});
test('auto-skip preserves context, low-confidence skips, paused opt-out and ads',()=>{
  const segments=[segment(0,20,'skip'),segment(20,50,'context'),{...segment(50,80,'skip'),confidence:'low'}];
  assert.equal(skipTarget(segments,10,true),20);assert.equal(skipTarget(segments,10,false),null);assert.equal(skipTarget(segments,10,true,true),null);assert.equal(skipTarget(segments,25,true),null);assert.equal(skipTarget(segments,60,true),null);assert.equal(skipTarget(segments,20,true),null);
});
test('cache identity changes with video, goal, and transcript',()=>{
  assert.notEqual(cacheKey(input),cacheKey({...input,goal:'advanced'}));assert.notEqual(cacheKey(input),cacheKey({...input,cues:[{start:0,text:'changed'}]}));
});
