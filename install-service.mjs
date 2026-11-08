// Register this local checkout as a per-user login service; no elevated privileges.
import { mkdir,readFile,writeFile,chmod,access } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
const root=dirname(fileURLToPath(import.meta.url));
await access(resolve(root,'.venv/bin/python'));await access(resolve(root,'runtime/models/multilingual/model.safetensors'));
const tokenPath=resolve(root,'.local-token');let token;try{token=(await readFile(tokenPath,'utf8')).trim();}catch{token=randomBytes(24).toString('hex');}
if(!/^[a-f0-9]{48}$/.test(token))throw new Error('Invalid local credential');
await writeFile(tokenPath,token+'\n',{mode:0o600});await chmod(tokenPath,0o600);
const config=resolve(root,'extension/local-config.js');await writeFile(config,`export const LOCAL_TOKEN = '${token}';\n`,{mode:0o600});await chmod(config,0o600);
const label='com.eros.youtubeworth',domain=`gui/${process.getuid()}`,agents=resolve(homedir(),'Library/LaunchAgents'),runtime=resolve(root,'runtime');
await mkdir(agents,{recursive:true});await mkdir(runtime,{recursive:true});
const xml=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const plist=resolve(agents,label+'.plist');
await writeFile(plist,`<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict>\n<key>Label</key><string>${label}</string>\n<key>ProgramArguments</key><array><string>${xml(process.execPath)}</string><string>${xml(resolve(root,'server.mjs'))}</string></array>\n<key>WorkingDirectory</key><string>${xml(root)}</string>\n<key>RunAtLoad</key><true/>\n<key>KeepAlive</key><true/>\n<key>ThrottleInterval</key><integer>15</integer>\n<key>StandardOutPath</key><string>${xml(resolve(runtime,'service.log'))}</string>\n<key>StandardErrorPath</key><string>${xml(resolve(runtime,'service-error.log'))}</string>\n</dict></plist>\n`);
try{execFileSync('launchctl',['bootout',`${domain}/${label}`],{stdio:'ignore'});}catch{}
execFileSync('launchctl',['bootstrap',domain,plist]);console.log('Local Laya service registered for login. Extension paired.');
