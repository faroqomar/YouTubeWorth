import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {defaults,migrateSettings,analysisRules,isRecommended} from '../extension/rules.js';
import {normalizeResult,cacheKey} from '../lib/analysis.mjs';
import assert from 'node:assert/strict';
test('pipeline timing and protection regressions with controlled model output',()=>{
 execFileSync(new URL('../.venv/bin/python',import.meta.url).pathname,[new URL('pipeline-check.py',import.meta.url).pathname],{input:JSON.stringify(defaults),encoding:'utf8'});
});
test('legacy settings migrate, preserve preferences and retire unsafe penalties',()=>{
 const old={version:1,rules:{preferredLanguage:'en-US',showImportantOnPlayer:false,protectFacts:false,windowMin:40,windowMax:100,windowDivisor:260,maxSegments:80,gapSeconds:30}};
 const {rules}=migrateSettings(old);assert.equal(rules.preferredLanguage,'en-US');assert.equal(rules.showImportantOnPlayer,false);assert.equal(rules.windowMin,25);assert.equal(rules.protectFacts,undefined);assert.equal(rules.gapSeconds,5);
 assert.throws(()=>migrateSettings({version:3,rules:defaults}));assert.throws(()=>migrateSettings({version:2,rules:{...defaults,extra:true}}));
 assert.deepEqual(migrateSettings({version:2,rules:defaults}).rules,defaults);
});
test('presentation cache reuse and model/source changes have distinct identities',()=>{
 const key=r=>cacheKey(analysisRules(r));assert.equal(key(defaults),key({...defaults,showImportantOnPlayer:false,cacheHours:2}));
 for(const changed of [{typeQuestion:'Different question?'},{skipConfidence:.99},{compareConfidence:.95},{fillerWords:[]}])assert.notEqual(key(defaults),key({...defaults,...changed}));
 assert.equal(isRecommended({...defaults,typeQuestion:'Different?'}),false);assert.equal(isRecommended({...defaults,skipConfidence:.95}),false);assert.equal(isRecommended(defaults),true);
});
test('unvalidated high-confidence filler cannot authorize automatic skipping',()=>{
 const input={videoId:'abcdefghijk',duration:10,cues:[{start:0,end:10,text:'Sponsor'}]};
 const r=normalizeResult({segments:[{start:0,end:10,kind:'skip',confidence:'high',title:'Ad',reason:'Ad',claim:'',autoSkipEligible:true,boundariesTrusted:true}]},input);
 assert.equal(r.segments[0].autoSkipEligible,false);
});
