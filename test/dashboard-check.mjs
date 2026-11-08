import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {defaults,fields} from '../extension/rules.js';
const dir=await mkdtemp(join(tmpdir(),'worth-dashboard-')),file=join(dir,'rules.json'),base='http://127.0.0.1:4321';
const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'4321',WORTH_WORKER:'test/worker-stub.py',WORTH_RULES_FILE:file},stdio:['ignore','ignore','pipe']});let errors='';child.stderr.on('data',b=>errors+=b);
const require=createRequire(import.meta.url);let pw;try{pw=require('playwright');}catch{pw=require('/Users/eros/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');}
let browser,checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;};
try{
 for(let i=0;i<80;i++){try{if((await(await fetch(base+'/health')).json()).ready)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await pw.chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});const page=await browser.newPage({viewport:{width:1250,height:1000}});const runtime=[];page.on('pageerror',e=>runtime.push(e.message));
 await page.goto(base+'/dashboard');await page.getByText('All rules saved',{exact:true}).waitFor();
 ok(await page.locator('.rule').count()===fields.length,'Every catalog rule has a control');
 ok(await page.locator('html').getAttribute('lang')==='en'&&!/[\u0600-\u06ff]/.test(await page.locator('body').innerText()),'Dashboard is entirely English and LTR');
 ok(!(await page.locator('#advanced').evaluate(e=>e.open)),'Advanced starts collapsed');await page.locator('#advanced summary').focus();await page.keyboard.press('Enter');ok(await page.locator('#worthRatio').isVisible(),'Advanced opens with keyboard');await page.locator('#worthRatio').fill('80');ok(await page.locator('#change-count').textContent()==='1 unsaved change','Changes stay in the draft');
 await page.locator('#save').click();await page.getByText('All rules saved',{exact:true}).waitFor();ok(JSON.parse(await readFile(file,'utf8')).rules.worthRatio===.8,'Save reaches persistent settings');
 await page.locator('#selectiveRatio').fill('90');await page.locator('#save').click();ok((await page.locator('#status').textContent()).includes('Minimum'),'Inconsistent rules are rejected');ok(await page.locator('#selectiveRatio').getAttribute('aria-invalid')==='true','Inline error is associated with field');await page.locator('#discard').click();
 await page.locator('#search').fill('filler phrases');ok(await page.locator('#fillerWords').isVisible(),'Search reveals a rule from another category');
 await page.locator('#fillerWords').fill('sponsor\ncustom cue');await page.locator('#save').click();await page.getByText('All rules saved',{exact:true}).waitFor();ok(JSON.parse(await readFile(file,'utf8')).rules.fillerWords[1]==='custom cue','Phrase changes persist');
 await page.locator('#reset').click();ok((await page.locator('#change-count').textContent()).includes('unsaved'),'Defaults restore to a draft');await page.locator('#discard').click();ok((await page.locator('#fillerWords').inputValue()).includes('custom cue'),'Discard restores saved values');
 const imported={version:1,rules:{...defaults,skipPromotion:false}};await page.locator('#import').setInputFiles({name:'rules.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(imported))});await page.getByText('Rules imported into the draft. Save to apply.',{exact:true}).waitFor();await page.locator('#search').fill('');ok(!(await page.locator('#skipPromotion').isChecked()),'Import loads editable rules into the draft');await page.locator('#discard').click();
 const legacy={...defaults};delete legacy.showImportantOnPlayer;await page.locator('#import').setInputFiles({name:'old-rules.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({version:1,rules:legacy}))});await page.getByText('Rules imported into the draft. Save to apply.',{exact:true}).waitFor();ok(await page.locator('#showImportantOnPlayer').isChecked(),'Older rule exports gain the default player highlights setting');
 await page.locator('#showImportantOnPlayer').uncheck();await page.locator('#save').click();await page.getByText('All rules saved',{exact:true}).waitFor();ok(JSON.parse(await readFile(file,'utf8')).rules.showImportantOnPlayer===false,'Player highlight preference can be saved from the dashboard');
 const download=page.waitForEvent('download');await page.locator('#export').click();const data=JSON.parse(await readFile(await(await download).path(),'utf8'));ok(data.version===2&&Object.keys(data.rules).length===fields.length&&!('token'in data),'Export contains rules only');
 ok((await page.locator('#reliability').textContent()).includes('Automatic skipping is unavailable'),'Unvalidated release clearly reported');
 for(const width of [320,650,1000]){await page.setViewportSize({width,height:900});ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`No overflow at ${width}`);}
 await page.setViewportSize({width:1250,height:1100});await page.screenshot({path:new URL('../preview/dashboard.png',import.meta.url).pathname,fullPage:true});ok(!runtime.length,'No dashboard runtime errors');
 const offline=await browser.newPage();await offline.route(base+'/api/**',r=>r.abort());await offline.route(base+'/health',r=>r.abort());await offline.goto(base+'/dashboard');await offline.getByText('Local service offline',{exact:true}).waitFor();ok(await offline.locator('#save').isDisabled(),'Offline settings cannot be saved');
 console.log(`Dashboard checks passed: ${checks}. Drafts, persistence, validation, search, defaults, import/export, English, reliability, and responsive layout. Isolated service fixture.`);
}finally{await browser?.close();child.kill('SIGTERM');await rm(dir,{recursive:true,force:true});}
