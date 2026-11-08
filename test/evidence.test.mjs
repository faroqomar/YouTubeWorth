import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyClaims,queryTerms} from '../lib/evidence.mjs';
const original=globalThis.fetch;
const signal=new AbortController().signal;
function fixture(){globalThis.fetch=async url=>{const u=new URL(url);return new Response(JSON.stringify(u.searchParams.has('list')?{query:{search:[{pageid:1}]}}:{query:{pages:{1:{extract:'Earth is a planet.',title:'Earth',fullurl:'https://en.wikipedia.org/wiki/Earth'},2:{extract:'Untrusted',title:'Other',fullurl:'https://invented.example'}}}}));};}
test('evidence statuses require a real retrieved source index',async()=>{
  fixture();try{
    const client={request:async()=>[{segmentIndex:0,sourceIndex:8,status:'supported'},{segmentIndex:9,sourceIndex:0,status:'supported'}]};
    const [check]=await verifyClaims(client,[{claim:'Earth is a planet.'}],signal);
    assert.equal(check.status,'unverified');assert.deepEqual(check.sources,[{url:'https://en.wikipedia.org/wiki/Earth',title:'Earth'}]);
  }finally{globalThis.fetch=original;}
});
test('unavailable evidence never becomes false or true',async()=>{
  globalThis.fetch=async()=>{throw new Error('offline');};try{
    const client={request:async()=>{throw new Error('should not infer without source');}};
    const [check]=await verifyClaims(client,[{claim:'Earth is a planet.'}],signal);
    assert.equal(check.status,'unverified');assert.deepEqual(check.sources,[]);
  }finally{globalThis.fetch=original;}
});
test('search terms keep Arabic and deduplicate words',()=>{assert.equal(queryTerms('هذا القمر القمر يدور حول الأرض'), 'القمر يدور حول الأرض');});
