import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { readVideo, readBrowserCaptions, seekVideo, setSkipping, setImportantMarkers } from '../extension/content.js';
const require=createRequire(import.meta.url);
let playwright;
try { playwright=require('playwright'); } catch { playwright=require(process.env.WORTH_PLAYWRIGHT || '/Users/eros/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'); }
const { chromium }=playwright;
const base='http://127.0.0.1:4318';
const browser=await chromium.launch({headless:true,...(process.env.WORTH_CHROME ? {executablePath:process.env.WORTH_CHROME} : {})});
let checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;};
try{
  const page=await browser.newPage({viewport:{width:410,height:1100},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/?demo=1');await page.locator('#results').waitFor({state:'visible'});
  ok(await page.locator('#demo-banner').isVisible(),'Demo clearly labelled');
  ok(await page.locator('.segment').count()===6,'Full map');
  ok(await page.locator('#watch-time').textContent()==='11:00','Useful time');
  await page.locator('.segment .timestamp').nth(4).click();ok((await page.locator('#status').textContent()).includes('9:00'),'Seek labels');
  await page.locator('#useful-filter').click();ok(await page.locator('.segment').count()===2,'Useful filter matches keep-only green markers');
  await page.locator('#useful-filter').click();
  ok(await page.locator('#auto-skip').isDisabled(),'Unvalidated sample cannot enable automatic skipping');
  await mkdir(new URL('../preview/',import.meta.url),{recursive:true});
  await page.screenshot({path:new URL('../preview/panel.png',import.meta.url).pathname,fullPage:true});
  for(const width of [320,390,540]){await page.setViewportSize({width,height:900});ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`No overflow at ${width}`);}
  await page.emulateMedia({reducedMotion:'reduce'});ok(await page.locator('#results').evaluate(e=>getComputedStyle(e).animationName)==='none','Reduced motion');
  ok(!errors.length,'No UI runtime errors');
  // Test the actual injected functions against an isolated YouTube DOM fixture.
  const yt=await browser.newPage();
  await yt.route('https://www.youtube.com/**',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><html><body><h1 class="ytd-watch-metadata">Fixture video</h1><div class="html5-video-player"><video class="html5-main-video"></video></div><ytd-video-description-transcript-section-renderer><button>عرض النص</button></ytd-video-description-transcript-section-renderer><div id="transcript"></div></body></html>'}));
  await yt.goto('https://www.youtube.com/watch?v=abcdefghijk');
  await yt.evaluate(()=>{
    const video=document.querySelector('video');let current=0,paused=false;
    Object.defineProperties(video,{duration:{get:()=>180},currentTime:{get:()=>current,set:x=>{current=x;}},paused:{get:()=>paused}});
    window.setPause=x=>{paused=x;};
    document.querySelector('button').onclick=()=>setTimeout(()=>{
      const host=document.querySelector('#transcript');host.replaceChildren();
      for(const [stamp,text] of [['٠:٠٠','المقدمة'],['0:30','شرح عملي'],['2:00','النهاية']]){
        const row=document.createElement('ytd-transcript-segment-renderer'),t=document.createElement('div'),w=document.createElement('div');t.className='segment-timestamp';w.className='segment-text';t.textContent=stamp;w.textContent=text;row.append(t,w);host.append(row);
      }
    },4500);
  });
  const metadata=await yt.evaluate(({f})=>(new Function('return '+f))()(false),{f:readVideo.toString()});
  ok(metadata.cues.length===0 && metadata.duration===180,'Metadata read does not open the transcript panel');
  const video=await yt.evaluate(({f})=>(new Function('return '+f))()(true),{f:readVideo.toString()});ok(video.cues.length===3 && video.cues[1].start===30,`Reads delayed captions including Arabic time: ${JSON.stringify(video)}`);
  const requested=[];
  await yt.route('https://www.youtube.com/api/timedtext**',route=>{
    requested.push(new URL(route.request().url()));
    return route.fulfill({contentType:'application/json',body:JSON.stringify({events:[{tStartMs:320,dDurationMs:6000,segs:[{utf8:'Original English speech'}]},{tStartMs:90000,segs:[{utf8:'Later in the video'}]}]})});
  });
  await yt.evaluate(()=>{
    const p=document.createElement('div');p.id='movie_player';document.body.append(p);
    p.getPlayerResponse=()=>({videoDetails:{videoId:'abcdefghijk'},captions:{playerCaptionsTracklistRenderer:{captionTracks:[
      {languageCode:'ar',vssId:'t.ar',baseUrl:'/api/timedtext?v=abcdefghijk&lang=ar&tlang=ar'},
      {languageCode:'en',vssId:'a.en',kind:'asr',baseUrl:'/api/timedtext?v=abcdefghijk&lang=en'}
    ]}}});
  });
  const browserCues=await yt.evaluate(({f})=>(new Function('return '+f))()('abcdefghijk',180),{f:readBrowserCaptions.toString()});
  ok(browserCues.language==='en' && browserCues.cues.length===2,'Prefers original English speech over a translated track');
  ok(browserCues.cues[0].start===.32 && browserCues.cues[0].end===6.32 && browserCues.cues[1].start===90,'Preserves millisecond timestamps and later captions');
  ok(!requested[0].searchParams.has('tlang') && requested[0].searchParams.get('fmt')==='json3','No translation request');
  await yt.evaluate(()=>document.querySelector('#movie_player').getPlayerResponse=()=>({videoDetails:{videoId:'lmnopqrstuv'}}));
  const staleCaptions=await yt.evaluate(({f})=>(new Function('return '+f))()('abcdefghijk',180),{f:readBrowserCaptions.toString()});
  ok(!staleCaptions.cues.length && requested.length===1,'A stale player cannot supply another video transcript');
  await yt.evaluate(({f,id,t})=>(new Function('return '+f))()(id,t),{f:seekVideo.toString(),id:video.videoId,t:30});ok(await yt.locator('video').evaluate(v=>v.currentTime)===30,'Seeks the actual video');
  const skip=[{start:0,end:20,kind:'skip',confidence:'high',autoSkipEligible:true},{start:20,end:60,kind:'context',confidence:'high'},{start:60,end:100,kind:'skip',confidence:'low'}];
  const toggle=enabled=>yt.evaluate(({f,id,s,on})=>(new Function('return '+f))()(id,s,on),{f:setSkipping.toString(),id:video.videoId,s:skip,on:enabled});
  await toggle(true);await yt.locator('video').evaluate(v=>{v.currentTime=10;});
  await yt.waitForFunction(()=>document.querySelector('video').currentTime===20);ok(true,'High-confidence filler skipped');
  await yt.locator('video').evaluate(v=>{v.currentTime=70;});await yt.waitForTimeout(350);ok(await yt.locator('video').evaluate(v=>v.currentTime)===70,'Low-confidence filler preserved');
  await yt.evaluate(()=>{document.querySelector('.html5-video-player').classList.add('ad-showing');document.querySelector('video').currentTime=10;});await yt.waitForTimeout(350);ok(await yt.locator('video').evaluate(v=>v.currentTime)===10,'Ads preserved');
  await yt.evaluate(()=>{document.querySelector('.html5-video-player').classList.remove('ad-showing');window.setPause(true);});await yt.waitForTimeout(350);ok(await yt.locator('video').evaluate(v=>v.currentTime)===10,'Paused video preserved');
  await toggle(false);await yt.evaluate(()=>window.setPause(false));await yt.waitForTimeout(350);ok(await yt.locator('video').evaluate(v=>v.currentTime)===10,'Turning skip off removes interval');
  await toggle(true);await yt.evaluate(()=>history.pushState({},'','/watch?v=lmnopqrstuv'));await yt.waitForTimeout(350);ok(await yt.evaluate(()=>window.__worthWatch===null),'Navigation stops skipping');
  let stale=false;try{await yt.evaluate(({f,id})=>(new Function('return '+f))()(id,30),{f:seekVideo.toString(),id:'abcdefghijk'});}catch{stale=true;}ok(stale,'Stale map cannot seek another video');
  // Useful-only native player highlights: preserve seeking and clean up on navigation.
  await yt.evaluate(()=>{
    history.pushState({},'','/watch?v=abcdefghijk');
    const player=document.querySelector('#movie_player');player.append(document.querySelector('video'));
    const bar=document.createElement('div');bar.className='ytp-progress-bar-container';bar.style.cssText='position:relative;width:800px;height:6px;margin:24px;';player.append(bar);
    bar.onclick=()=>{document.querySelector('video').currentTime=55;};
  });
  const moments=[{start:30,end:60,kind:'keep'},{start:60,end:80,kind:'context'},{start:80,end:100,kind:'skip'}, {start:100,end:120,kind:'unknown'},{start:170,end:190,kind:'keep'},{start:NaN,end:180,kind:'keep'},{start:100,end:90,kind:'keep'}];
  const highlight=(on=true,id='abcdefghijk',s=moments)=>yt.evaluate(({f,id,s,on})=>(new Function('return '+f))()(id,180,s,on),{f:setImportantMarkers.toString(),id,s,on});
  ok((await highlight()).count===2 && await yt.locator('[data-worth-important] span').count()===2,'Only useful ranges highlighted; invalid ranges ignored');
  const first=await yt.locator('[data-worth-important] span').first().evaluate(e=>({left:parseFloat(e.style.left),width:parseFloat(e.style.width)}));
  ok(Math.abs(first.left-100/6)<.001 && Math.abs(first.width-100/6)<.001,'Highlights preserve exact video-time proportions');
  ok(await yt.locator('[data-worth-important] span').last().getAttribute('data-end')==='180','Out-of-bounds endpoints clipped to the video');
  ok(await yt.locator('[data-worth-important]').evaluate(e=>getComputedStyle(e).pointerEvents==='none' && e.getAttribute('aria-hidden')==='true'),'Overlay leaves native pointer and accessible controls intact');
  await yt.locator('.ytp-progress-bar-container').click();ok(await yt.locator('video').evaluate(v=>v.currentTime)===55,'Native seeking still receives clicks');
  await yt.evaluate(()=>document.querySelector('#movie_player').classList.add('ad-showing'));
  await yt.waitForFunction(()=>document.querySelector('[data-worth-important]').style.display==='none');ok(true,'Highlights hidden during ads');
  await yt.evaluate(()=>document.querySelector('#movie_player').classList.remove('ad-showing'));
  await yt.waitForFunction(()=>document.querySelector('[data-worth-important]').style.display==='block');ok(true,'Highlights return when original video resumes');
  await yt.evaluate(()=>{const old=document.querySelector('.ytp-progress-bar-container');const replacement=old.cloneNode(false);replacement.style.width='400px';old.replaceWith(replacement);});
  await yt.waitForFunction(()=>document.querySelector('.ytp-progress-bar-container [data-worth-important]'));
  ok(Math.abs(await yt.locator('[data-worth-important] span').first().evaluate(e=>e.getBoundingClientRect().width)-400/6)<1,'Replaced and resized timelines retain correct proportions');
  await highlight();ok(await yt.locator('[data-worth-important]').count()===1,'Reanalysis replaces highlights without duplicates');
  await highlight(false);ok(await yt.locator('[data-worth-important]').count()===0 && await yt.evaluate(()=>window.__worthImportant===null),'Dashboard opt-out removes highlights and timer');
  await highlight(true,'abcdefghijk',moments.filter(s=>s.kind!=='keep'));ok(await yt.locator('[data-worth-important]').count()===0,'A video with no useful segments stays unmarked');
  await highlight();await yt.evaluate(()=>history.pushState({},'','/watch?v=lmnopqrstuv'));
  await yt.waitForFunction(()=>window.__worthImportant===null);ok(await yt.locator('[data-worth-important]').count()===0,'Navigation clears old highlights and lifecycle state');
  ok((await highlight()).count===0 && await yt.locator('[data-worth-important]').count()===0,'A stale analysis cannot highlight another video');
  // Smoke-test the unmodified MV3 package in a real extension context.
  if (!process.env.WORTH_CHROME) {
    const context=await chromium.launchPersistentContext('',{headless:true,channel:'chromium',args:[`--disable-extensions-except=${new URL('../extension/',import.meta.url).pathname}`,`--load-extension=${new URL('../extension/',import.meta.url).pathname}`]});
    try{
    const workers=context.serviceWorkers();const worker=workers[0]||await context.waitForEvent('serviceworker');
    const id=new URL(worker.url()).hostname;
    const panel=await context.newPage();const extensionErrors=[];panel.on('pageerror',e=>extensionErrors.push(e.message));
    await panel.goto(`chrome-extension://${id}/panel.html`);await panel.locator('#status').filter({hasText:'Pair the extension'}).waitFor();
    ok((await worker.evaluate(()=>chrome.runtime.getManifest().manifest_version))===3,'Real MV3 package loads');
    ok((await worker.evaluate(()=>chrome.sidePanel.getPanelBehavior())).openPanelOnActionClick===false,'Action opens side panel through the click handler');
    ok(!extensionErrors.length,'Extension panel has no runtime errors');
    }finally{await context.close();}
  }
  console.log(`Browser checks passed: ${checks}. Demo UI, narrow layouts, real content functions, ads, opt-in skip, stale video protection${process.env.WORTH_CHROME ? '; MV3 loading not tested in installed Chrome' : ', and unmodified MV3 loading'}. Live YouTube and model calls not verified.`);
}finally{await browser.close();}
