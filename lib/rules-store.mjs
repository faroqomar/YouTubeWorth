import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { defaults, validateRules, migrateSettings, settingsVersion } from '../extension/rules.js';
export async function createRulesStore(root){
 const path=process.env.WORTH_RULES_FILE || resolve(root,'runtime/rules.json');
 let current=structuredClone(defaults),notes=[];
 async function persist(rules){await mkdir(dirname(path),{recursive:true});const tmp=path+'.tmp';await writeFile(tmp,JSON.stringify({version:settingsVersion,rules},null,2)+'\n',{mode:0o600});await rename(tmp,path);}
 try{
  const raw=await readFile(path,'utf8'),saved=JSON.parse(raw),migrated=migrateSettings(saved);current=migrated.rules;notes=migrated.notes;
  if(saved.version!==settingsVersion){await writeFile(path+'.v1-backup',raw,{mode:0o600,flag:'wx'}).catch(e=>{if(e.code!=='EEXIST')throw e;});await persist(current);}
 }catch(e){if(e.code!=='ENOENT')throw new Error('The local rules file is invalid. Restore runtime/rules.json from its backup.');}
 let writes=Promise.resolve();
 return {get:()=>structuredClone(current),notes:()=>[...notes],save(value){const next=validateRules(value);const write=writes.then(async()=>{await mkdir(dirname(path),{recursive:true});await writeFile(path+'.previous',JSON.stringify({version:settingsVersion,rules:current},null,2)+'\n',{mode:0o600});await persist(next);current=next;return structuredClone(current);});writes=write.catch(()=>{});return write;}};
}
