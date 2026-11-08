// Official PyPI/Hugging Face artifacts, pinned revisions, ranged downloads, hashes.
import { mkdir, stat, rename, rm, readdir } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=dirname(fileURLToPath(import.meta.url));
const revision='7b928d828b7b0e022f929d9bd2e44165aa270148';
async function hash(path){const h=createHash('sha256');for await(const chunk of createReadStream(path))h.update(chunk);return h.digest('hex');}
async function size(path){try{return(await stat(path)).size;}catch{return -1;}}
async function download(url,destination,length,expected){
  await mkdir(dirname(destination),{recursive:true});
  if(await size(destination)===length&&(!expected||await hash(destination)===expected)){console.log('Already verified:',destination.split('/').at(-1));return;}
  const directory=destination+'.parts';await mkdir(directory,{recursive:true});
  const block=4*1024*1024,count=Math.ceil(length/block);let next=0,done=0,last=0,remote=url;
  async function worker(){
    while(next<count){const index=next++,start=index*block,end=Math.min(length-1,start+block-1),path=resolve(directory,String(index));
      if(await size(path)!==end-start+1){
        for(let attempt=0;;attempt++){
          try{
            let partial=Math.max(0,await size(path+'.tmp'));if(partial>=end-start+1)partial=0;
            const offset=start+partial;
            const res=await fetch(remote,{headers:{Range:`bytes=${offset}-${end}`},signal:AbortSignal.timeout(300000)});
            if(res.status!==206||res.headers.get('content-range')!==`bytes ${offset}-${end}/${length}`){remote=url;await res.body?.cancel();throw new Error(`Unexpected range response ${res.status}`);}
            remote=res.url;
            await pipeline(Readable.fromWeb(res.body),createWriteStream(path+'.tmp',{flags:partial?'a':'w'}));
            if(await size(path+'.tmp')!==end-start+1)throw new Error('Incomplete range');
            await rename(path+'.tmp',path);break;
          }catch(error){if(attempt>=15)throw error;await new Promise(r=>setTimeout(r,Math.min(5000,500*(attempt+1))));}
        }
      }
      done+=end-start+1;
      if(Date.now()-last>10000){last=Date.now();console.log(`${destination.split('/').at(-1)}: ${Math.round(done/length*100)}%`);}
    }
  }
  await Promise.all(Array.from({length:Math.min(16,count)},worker));
  async function* parts(){for(let i=0;i<count;i++)yield*createReadStream(resolve(directory,String(i)));}
  await pipeline(Readable.from(parts()),createWriteStream(destination+'.download'));
  if(await size(destination+'.download')!==length||expected&&await hash(destination+'.download')!==expected)throw new Error('Artifact hash mismatch; file not installed');
  await rename(destination+'.download',destination);await rm(directory,{recursive:true,force:true});
  console.log('Verified:',destination.split('/').at(-1));
}
if(process.argv.includes('--wheel')){
  const spec=process.argv[process.argv.indexOf('--wheel')+1], [name,version]=spec.split('@');
  const p=await(await fetch(`https://pypi.org/pypi/${name}/${version}/json`)).json();
  const wheel=p.urls.find(x=>x.filename.endsWith('py3-none-any.whl'));
  if(!wheel)throw new Error('Universal official wheel not found');
  await download(wheel.url,resolve(root,'runtime/wheels',wheel.filename),wheel.size,wheel.digests.sha256);
}else if(process.argv.includes('--torch')){
  const p=await(await fetch('https://pypi.org/pypi/torch/2.14.1/json')).json();
  const wheel=p.urls.find(x=>x.filename==='torch-2.14.1-cp312-cp312-macosx_14_0_arm64.whl');
  if(!wheel)throw new Error('Official ARM64 wheel not found');
  await download(wheel.url,resolve(root,'runtime/wheels',wheel.filename),wheel.size,wheel.digests.sha256);
}else{
  const entries=await(await fetch(`https://huggingface.co/api/models/convaiinnovations/laya/tree/${revision}/multilingual?recursive=true`)).json();
  if(!Array.isArray(entries))throw new Error('Cannot read official model manifest');
  const files=entries.filter(x=>x.type==='file');
  for(const file of files){
    if(!/^multilingual\/[a-zA-Z0-9_./-]+$/.test(file.path)||file.path.includes('..'))throw new Error('Invalid artifact path');
    await download(`https://huggingface.co/convaiinnovations/laya/resolve/${revision}/${file.path}`,resolve(root,'runtime/models',file.path),file.size,file.lfs?.oid);
  }
  console.log('Official Laya multilingual snapshot ready:',revision);
}
