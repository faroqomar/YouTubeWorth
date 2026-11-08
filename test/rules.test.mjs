import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm,readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defaults,validateRules,fields } from '../extension/rules.js';
import { createRulesStore } from '../lib/rules-store.mjs';
import { validateInput,normalizeResult,cacheKey } from '../lib/analysis.mjs';
test('rules reject unknown keys, invalid types, and contradictory thresholds',()=>{
 assert.equal(Object.keys(validateRules(defaults)).length,fields.length);
 for(const invalid of [{...defaults,skipConfidence:1.1},{...defaults,protectFacts:'yes'},{...defaults,preferredLanguage:'../../en'},{...defaults,selectiveRatio:.8,worthRatio:.7},{...defaults,extra:'ignored'}])assert.throws(()=>validateRules(invalid));
 assert.deepEqual(validateRules({...defaults,fillerWords:[' sponsor ','sponsor']} ).fillerWords,['sponsor']);
});
test('rules persist and serialised saves survive a fresh store',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'worth-rules-'));try{
  const store=await createRulesStore(dir);assert.equal(store.get().worthRatio,.7);
  await Promise.all([store.save({...defaults,worthRatio:.8}),store.save({...defaults,worthRatio:.9})]);
  assert.equal((await createRulesStore(dir)).get().worthRatio,.9);
  const snapshot=store.get();snapshot.worthRatio=.2;assert.equal(store.get().worthRatio,.9);
  assert.equal(JSON.parse(await readFile(join(dir,'runtime/rules.json'),'utf8')).version,2);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('configured limits and unknown coverage change actual validation and verdict',()=>{
 const input={videoId:'abcdefghijk',duration:120,cues:[{start:0,end:60,text:'Lesson'}]};
 assert.throws(()=>validateInput(input,{...defaults,maxDuration:60}));
 const raw={verdict:'worth',reason:'Useful',segments:[{start:0,end:120,kind:'keep',confidence:'high',title:'Lesson',reason:'Useful',claim:''}]};
 assert.equal(normalizeResult(raw,input,defaults).verdict,'uncertain');
 assert.equal(normalizeResult(raw,input,{...defaults,unknownRatio:.6}).verdict,'selective');
 assert.notEqual(cacheKey({input,rules:defaults}),cacheKey({input,rules:{...defaults,skipPromotion:false}}));
});
