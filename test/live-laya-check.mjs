// Requires the real local service and model; synthetic speech fixtures, no cloud AI.
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:4318',token=(await readFile(new URL('../.local-token',import.meta.url),'utf8')).trim();
assert.equal((await(await fetch(base+'/health')).json()).ready,true);
const examples=[
  {videoId:'layaENtest1',title:'Learn variables in programming',pieces:['Before we begin, subscribe to my channel and click the bell. This video is sponsored by a product. Use our discount code. Thanks for watching.','A variable stores a value in a program. In Python, x = 3 assigns the number three to x. The equals sign assigns a value. You can use print(x) to display it.','When I first started programming I was nervous about making mistakes. My teacher told me practice helps, and encouraged me to keep trying. This story explains my motivation.']},
  {videoId:'layaARtest1',title:'تعلم المتغيرات في البرمجة',pieces:['قبل ما نبدأ اشترك بالقناة وفعل الجرس. هذا الفيديو برعاية شركة. استخدم كود الخصم للحصول على تخفيض. اشترك بالقناة وشكرا للمشاهدة.','المتغير في البرمجة يخزن قيمة. في بايثون نكتب x = 3 لتخزين الرقم ثلاثة في المتغير. علامة المساواة تعين القيمة. نستخدم print(x) لعرض القيمة على الشاشة.','لما بدأت أتعلم البرمجة كنت أخاف أغلط. المعلم شجعني أستمر بالتدريب وأجرب مرة ثانية. هاي قصة شخصية عن بدايتي حتى أوضح ليش اهتميت بالموضوع.']}
];
for(const example of examples){
  const input={videoId:example.videoId,title:example.title,duration:120,cues:Array.from({length:12},(_,i)=>({start:i*10,text:example.pieces[Math.floor(i/4)]}))};
  const start=Date.now();const res=await fetch(base+'/api/analyze',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({input})});const d=await res.json();assert.equal(res.status,200,JSON.stringify(d));
  console.log(JSON.stringify({videoId:example.videoId,seconds:(Date.now()-start)/1000,provider:d.result.provider,totals:d.result.totals,segments:d.result.segments.map(({start,end,kind,confidence})=>({start,end,kind,confidence}))}));
  assert.equal(d.result.local,true);assert.ok(d.result.segments.some(s=>s.start>=40&&s.start<80&&s.kind==='keep'),'Useful programming explanation should be kept');
  assert.ok(!d.result.segments.some(s=>s.start>=40&&s.start<80&&s.kind==='skip'),'Do not skip useful lesson');
  assert.ok(!d.result.segments.some(s=>s.start===0&&s.kind==='keep'),'Do not call pure advertising useful');
}
console.log('Real Laya Arabic and English inference passed.');
