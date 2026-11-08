import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {defaults} from '../extension/rules.js';
test('saved rule values affect the production Python classification and comparison',()=>{
 const result=execFileSync(new URL('../.venv/bin/python',import.meta.url).pathname,[new URL('./classifier-rules-check.py',import.meta.url).pathname],{input:JSON.stringify(defaults),encoding:'utf8'});
 assert.ok(result.includes('Production classifier rules passed'));
});
