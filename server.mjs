import http from 'node:http';
import { readFile, writeFile, chmod } from 'node:fs/promises';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { spawn } from 'node:child_process';
import { validateInput, normalizeResult, cacheKey, classifierProfile, classifierIdentity } from './lib/analysis.mjs';
import { LayaClient } from './lib/laya-client.mjs';
import { createRulesStore } from './lib/rules-store.mjs';
import { settingsVersion, analysisRules, isRecommended, migrateSettings } from './extension/rules.js';
import { verifyClaims } from './lib/evidence.mjs';
const root=dirname(fileURLToPath(import.meta.url)),port=Number(process.env.PORT||4318);
let token;
try{token=(await readFile(resolve(root,'.local-token'),'utf8')).trim();}catch{token=randomBytes(24).toString('hex');await writeFile(resolve(root,'.local-token'),token,{mode:0o600});}
await chmod(resolve(root,'.local-token'),0o600);
const rulesStore=await createRulesStore(root);
const client=new LayaClient(root),cache=new Map(),progress=new Map();let active=0;
function trimCache(){const r=rulesStore.get();for(const [key,entry] of cache)if(Date.now()-entry.created>r.cacheHours*3600000)cache.delete(key);while(cache.size>Math.max(1,r.cacheEntries))cache.delete(cache.keys().next().value);}
setInterval(trimCache,60000).unref();
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
const authenticated=req=>{const supplied=Buffer.from((req.headers.authorization||'').replace(/^Bearer /,'')),expected=Buffer.from(token);return supplied.length===expected.length&&timingSafeEqual(supplied,expected);};
async function body(req){
  if(!String(req.headers['content-type']).startsWith('application/json'))throw new Error('Invalid request content type.');
  let size=0;const pieces=[];for await(const chunk of req){size+=chunk.length;if(size>1500000)throw new Error('Request exceeds the supported size.');pieces.push(chunk);}
  return JSON.parse(Buffer.concat(pieces).toString('utf8'));
}
const server=http.createServer(async(req,res)=>{
  if(!['127.0.0.1:'+port,'localhost:'+port].includes(req.headers.host))return json(res,403,{error:'Host not allowed.'});
  const origin=req.headers.origin,localOrigin=`http://127.0.0.1:${port}`;
  if(origin&&origin!==localOrigin&&!/^chrome-extension:\/\/[a-p]{32}$/.test(origin))return json(res,403,{error:'Origin not allowed.'});
  const url=new URL(req.url,localOrigin),path=url.pathname;
  if(origin&&(path.startsWith('/api/')||path==='/health')){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');}
  if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}
  if(req.method==='GET'&&path==='/health')return json(res,200,{ready:client.ready,provider:'Laya',model:client.info.model,device:client.info.device||null,status:client.info.status,local:true});
  if(req.method==='GET'&&['/setup','/dashboard'].includes(path)){
    if(origin&&origin!==localOrigin)return json(res,403,{error:'Open setup in a browser tab.'});
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; frame-ancestors 'none'"});
    return res.end((await readFile(resolve(root,path==='/dashboard'?'extension/dashboard.html':'setup.html'),'utf8')).replace('__PAIR_TOKEN__',token));
  }
  const files={'/':'extension/panel.html','/panel.html':'extension/panel.html','/panel.js':'extension/panel.js','/panel.css':'extension/panel.css','/common.js':'extension/common.js','/content.js':'extension/content.js','/demo.js':'extension/demo.js','/setup.js':'setup.js','/dashboard.js':'extension/dashboard.js','/dashboard.css':'extension/dashboard.css','/rules.js':'extension/rules.js'};
  if(req.method==='GET'&&files[path]){const file=files[path];res.writeHead(200,{'Content-Type':file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css':'text/javascript','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'"});return res.end(await readFile(resolve(root,file)));}
  // Preview must not expose the installed extension's local credential.
  if(req.method==='GET'&&path==='/local-config.js'){res.writeHead(200,{'Content-Type':'text/javascript'});return res.end("export const LOCAL_TOKEN = '';\n");}
  if(path==='/api/progress'&&req.method==='GET'){if(!authenticated(req))return json(res,401,{error:'Not paired.'});return json(res,200,progress.get(url.searchParams.get('videoId'))||{});}
  if(path==='/api/rules'){
    if(!authenticated(req))return json(res,401,{error:'Connect the extension to the local service first.'});
    if(req.method==='GET')return json(res,200,{version:settingsVersion,rules:rulesStore.get(),notes:rulesStore.notes(),classifier:classifierProfile,recommended:isRecommended(rulesStore.get())});
    if(req.method==='POST'){try{const payload=await body(req);const value=payload.version?migrateSettings(payload).rules:payload.rules;const rules=await rulesStore.save(value);trimCache();return json(res,200,{version:settingsVersion,rules,classifier:classifierProfile,recommended:isRecommended(rules)});}catch(e){return json(res,400,{error:e.message});}}
  }
  if(req.method!=='POST'||!['/api/analyze','/api/verify','/api/transcript'].includes(path))return json(res,404,{error:'Route not found.'});
  if(!authenticated(req))return json(res,401,{error:'Invalid pairing code. Open local setup.'});
  const controller=new AbortController();res.on('close',()=>{if(!res.writableEnded)controller.abort();});let processing=false,input,progressOwner=Symbol();
  try{
    const request=await body(req),rules=rulesStore.get();
    if(path==='/api/transcript'){
      const metadata=validateInput({...request.input,cues:[{start:0,text:'metadata validation'}]},rules);
      if(active>=1)return json(res,429,{error:'An analysis is running. Wait for it to finish.'});
      active++;processing=true;
      const fetched=await client.request('transcript',{...metadata,rules},controller.signal);
      const checked=validateInput({...metadata,cues:fetched.cues},rules);
      return json(res,200,{cues:checked.cues,language:fetched.language});
    }
    input=validateInput(request.input,rules);const key=cacheKey({input,rules:analysisRules(rules),classifierIdentity});let entry=cache.get(key);
    if(entry&&Date.now()-entry.created>rules.cacheHours*3600000){cache.delete(key);entry=null;}
    if(path==='/api/analyze'&&entry&&rules.cacheEntries)return json(res,200,{result:entry.result,cached:true});
    if(active>=1)return json(res,429,{error:'A local analysis is running. Wait for it to finish.'});
    if(!client.ready)throw new Error(client.info.status==='failed'?'Laya failed to start. Open local setup.':'Laya is warming up. Wait a moment.');
    active++;processing=true;
    if(path==='/api/analyze'){
      progress.set(input.videoId,{completed:0,total:0,owner:progressOwner});
      const raw=await client.request('analyze',{...input,rules,recommended:isRecommended(rules)},controller.signal,p=>{if(!controller.signal.aborted)progress.set(input.videoId,{completed:p.completed,total:p.total,owner:progressOwner});});
      controller.signal.throwIfAborted();const result=normalizeResult(raw,input,rules);result.analysisId=key;result.provider='Laya';result.local=true;result.model=client.info.model;
      if(!rules.cacheEntries)cache.clear();
      if(cache.size>=Math.max(1,rules.cacheEntries))cache.delete(cache.keys().next().value);cache.set(key,{result,rules:structuredClone(rules),created:Date.now()});return json(res,200,{result,cached:false});
    }
    if(request.analysisId && request.analysisId!==key)throw new Error('Settings changed. Reanalyse before checking sources.');
    if(!entry)throw new Error('Analyse the video with your current rules before checking facts.');
    if(!entry.checks)entry.checks=await verifyClaims(client,entry.result.segments,controller.signal,entry.rules);controller.signal.throwIfAborted();return json(res,200,{checks:entry.checks});
  }catch(error){if(!res.destroyed)json(res,400,{error:error.name==='AbortError'?'Analysis cancelled.':error instanceof SyntaxError?'Incomplete request data.':error.message});}
  finally{if(processing)active--;if(input&&progress.get(input.videoId)?.owner===progressOwner)progress.delete(input.videoId);}
});
server.requestTimeout=300000;
server.listen(port,'127.0.0.1',()=>{console.log(`Worth / local Laya: http://127.0.0.1:${port}/setup`);if(process.env.WORTH_OPEN_SETUP==='1'&&process.platform==='darwin')spawn('open',[`http://127.0.0.1:${port}/setup`],{stdio:'ignore'}).on('error',()=>{});});
const stop=()=>{client.close();server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),1500).unref();};process.on('SIGTERM',stop);process.on('SIGINT',stop);
