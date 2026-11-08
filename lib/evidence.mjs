import { defaults } from '../extension/rules.js';
// Public-source retrieval; all inference remains local in Laya.
const stop=new Set('the an is are was were be to of and or in on for with this that it as at by from we you your can will have has not than all how why what who my there their these those قال يقول هذا هذه ذلك التي الذي في من على إلى عن أن إن هو هي كان تكون يكون مع كل وقد ثم لكن يعني أريد احنا أنا انه هاي شنو مثل'.split(' '));
export function queryTerms(claim,rules=defaults){return [...new Set(claim.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)||[])].filter(w=>!stop.has(w)).slice(0,rules.searchTerms).join(' ');}
export function evidenceExcerpt(text,claim,rules=defaults){
  const terms=queryTerms(claim,rules).split(' '),parts=text.split(/\n+/).map(s=>s.trim()).filter(Boolean);
  const ranked=parts.map((text,index)=>({text,index,score:terms.filter(t=>text.toLowerCase().includes(t)).length})).sort((a,b)=>b.score-a.score);
  return ranked.slice(0,2).sort((a,b)=>a.index-b.index).map(p=>p.text).join('\n\n').slice(0,rules.excerptChars);
}
async function getJson(url,signal,rules){const res=await fetch(url,{headers:{'User-Agent':'YouTubeWorth/0.2 (local video review)'},signal:AbortSignal.any([signal,AbortSignal.timeout(rules.sourceTimeoutMs)])});if(!res.ok)throw new Error('Source unavailable');return res.json();}
export async function findEvidence(claim,signal,rules=defaults){
  const language=/[\u0600-\u06ff]/.test(claim)?'ar':'en',origin=`https://${language}.wikipedia.org`,query=queryTerms(claim,rules);if(!query)return [];
  const search=new URL('/w/api.php',origin);search.search=new URLSearchParams({action:'query',list:'search',srsearch:query,srlimit:String(rules.maxSources),format:'json',utf8:'1'});
  const results=(await getJson(search,signal,rules)).query?.search||[];if(!results.length)return [];
  const extracts=new URL('/w/api.php',origin);extracts.search=new URLSearchParams({action:'query',prop:'extracts|info',inprop:'url',explaintext:'1',exintro:'1',pageids:results.map(r=>r.pageid).join('|'),format:'json',utf8:'1'});
  return Object.values((await getJson(extracts,signal,rules)).query?.pages||{}).filter(p=>p.extract&&p.fullurl&&new URL(p.fullurl).origin===origin).map(p=>({url:p.fullurl,title:p.title,text:evidenceExcerpt(p.extract,claim,rules)}));
}
export async function verifyClaims(client,segments,signal,rules=defaults){
  const claims=segments.map((s,i)=>({claim:s.claim,segmentIndex:i})).filter(x=>x.claim).slice(0,rules.maxClaims),checks=[];
  for(const c of claims){
    if(signal.aborted)throw new DOMException('Aborted','AbortError');
    let sources=[];try{sources=await findEvidence(c.claim,signal,rules);}catch(error){if(signal.aborted)throw error;}
    if(!sources.length){checks.push({...c,status:'unverified',note:'No sufficient source was found. Missing evidence does not mean the claim is false.',sources:[]});continue;}
    const relations=await client.request('compare',{rules,items:sources.map((s,i)=>({...c,sourceIndex:i,text:s.text}))},signal);
    const grounded=relations.filter(r=>r.segmentIndex===c.segmentIndex&&Number.isInteger(r.sourceIndex)&&sources[r.sourceIndex]);
    const supporting=grounded.filter(r=>r.status==='supported'),opposing=grounded.filter(r=>r.status==='contradicted');
    const status=supporting.length&&opposing.length?'context':opposing.length?'contradicted':supporting.length?'supported':'unverified';
    const notes={supported:'Retrieved text supports the claim according to Laya. Review the source for details.',contradicted:'Retrieved text contradicts the claim according to Laya. Review its wording and context.',context:'Sources gave conflicting comparisons. Review the context.',unverified:'Retrieved sources are insufficient to support or contradict the claim.'};
    checks.push({...c,status,note:notes[status],sources:sources.map(({url,title})=>({url,title}))});
  }
  return checks;
}
