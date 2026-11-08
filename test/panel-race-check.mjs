// Isolated page/Chrome API fixture. Exercises real panel module, not the user's browser.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {defaults} from '../extension/rules.js';
const require=createRequire(import.meta.url);let pw;try{pw=require('playwright')}catch{pw=require('/Users/eros/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')}
const browser=await pw.chromium.launch({headless:true,executablePath:process.env.WORTH_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try{
 const page=await browser.newPage();let pending;const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  window.chrome={runtime:{id:'fixture',onMessage:{addListener(){}},openOptionsPage(){}},storage:{local:{get:async()=>({pairToken:'a'.repeat(48)})}},tabs:{query:async()=>[{id:1}],onActivated:{addListener:f=>window.changeTab=f},onUpdated:{addListener(){}}},scripting:{executeScript:async({func})=>[{result:func.name==='readVideo'?{videoId:'abcdefghijk',duration:30,title:'First video',cues:[]}:func.name==='readBrowserCaptions'?{language:'en',cues:[{start:0,end:30,text:'A lesson.'}]}:{count:1}}]}};
 });
 await page.route('**/health',r=>r.fulfill({json:{ready:true}}));
 await page.route('**/api/rules',r=>r.fulfill({json:{rules:defaults}}));
 await page.route('**/api/progress?**',r=>r.fulfill({json:{completed:1,total:2}}));
 await page.route('**/api/analyze',r=>{pending=r;});
 await page.goto('http://127.0.0.1:4318/');await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Classifying'));
 await page.evaluate(()=>window.changeTab());await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('video or tab changed'));
 if(pending)await pending.fulfill({json:{result:{videoId:'abcdefghijk',title:'Late result',duration:30,verdict:'worth',reason:'Late',segments:[],totals:{keep:30,context:0}}}}).catch(()=>{});
 await page.waitForTimeout(100);assert.equal(await page.locator('#results').isHidden(),true);assert.ok((await page.locator('#status').textContent()).includes('video or tab changed'));assert.equal(await page.locator('#analyze').isEnabled(),true);assert.deepEqual(errors,[]);
 console.log('Panel generation check passed: navigation cancels work, a late result cannot render, and controls recover. Chrome API fixture.');
}finally{await browser.close();}
