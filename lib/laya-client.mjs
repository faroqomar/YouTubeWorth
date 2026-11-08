import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';

export class LayaClient {
  ready = false;
  info = { model: 'Laya multilingual', status: 'warming' };
  pending = new Map();
  nextId = 0;
  constructor(root) {
    this.worker = spawn(process.env.WORTH_PYTHON || resolve(root, '.venv/bin/python'), ['-u', resolve(root, process.env.WORTH_WORKER || 'laya-worker.py')], { cwd: root, stdio: ['pipe','pipe','inherit'], env:{...process.env,HF_HUB_OFFLINE:'1',TRANSFORMERS_OFFLINE:'1',USE_TF:'0',TOKENIZERS_PARALLELISM:'false'} });
    createInterface({input:this.worker.stdout}).on('line', line => {
      let msg; try { msg = JSON.parse(line); } catch { return; }
      if (msg.event === 'ready') { this.ready=true;this.info={...msg,status:'ready'};return; }
      if (msg.event === 'fatal') { this.info.status='failed';console.error('Laya failed to load:',msg.error);return; }
      const task=this.pending.get(msg.id);if(!task)return;
      if(msg.event==='progress'){task.progress?.(msg);return;}
      this.pending.delete(msg.id);task.cleanup();
      if(msg.error) {console.error('Local worker request failed:',msg.errorType||'Error');task.reject(new Error(msg.error==='cancelled'?'Analysis cancelled.':task.type==='transcript'?['RequestBlocked','IpBlocked'].includes(msg.errorType)?'YouTube rejected the caption request. Reload the video or use a timestamped transcript.':'YouTube captions are unavailable. Use a timestamped transcript.':'Laya could not analyse this text. Try a shorter excerpt.'));}
      else task.resolve(msg.result);
    });
    const failed=()=>{this.ready=false;this.info.status='failed';for(const task of this.pending.values()){task.cleanup();task.reject(new Error('The local Laya service stopped. Run start.command.'));}this.pending.clear();};
    this.worker.on('error',failed);this.worker.on('exit',failed);this.worker.stdin.on('error',()=>{});
  }
  request(type,data,signal,progress) {
    if(!this.ready)throw new Error(this.info.status==='failed'?'Laya is unavailable. Check local setup.':'Laya is warming up. Try again in a moment.');
    const id=++this.nextId;
    return new Promise((resolve,reject)=>{
      const abort=()=>{this.pending.delete(id);this.worker.stdin.write(JSON.stringify({type:'cancel',id})+'\n');reject(new DOMException('Aborted','AbortError'));};
      const cleanup=()=>signal?.removeEventListener('abort',abort);
      if(signal?.aborted)return abort();
      signal?.addEventListener('abort',abort,{once:true});
      this.pending.set(id,{type,resolve,reject,progress,cleanup});
      this.worker.stdin.write(JSON.stringify({id,type,data})+'\n');
    });
  }
  close(){this.worker.kill('SIGTERM');}
}
