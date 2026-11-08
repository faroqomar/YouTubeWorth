"""Audit the deployed extension API; public transcripts stay in ignored runtime storage."""
import hashlib,json,re,sys,time,urllib.request,urllib.error,subprocess
from pathlib import Path
import requests

ROOT=Path(__file__).resolve().parents[1]
RUN=ROOT/'runtime/evaluation/ten-video-2026-10-08'
OUT=ROOT/'evaluation/ten-video-2026-10-08'
VIDEOS=[('Tn6-PIqc4UM','coding'),('x7X9w_GIm1s','coding'),('rrB13utjYV4','coding'),('Gjnup-PuquQ','coding'),('7r4ikZHm9AI','AI discussion'),('WrCjAAl9okA','AI discussion'),('z19HM7ANZlo','review'),('rng_yUSwrgU','review'),('PeMlggyqz0Y','explainer'),('aircAruvnKk','explainer')]

def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def api(route,payload=None):
 token=(ROOT/'.local-token').read_text().strip()
 request=urllib.request.Request('http://127.0.0.1:4318'+route,data=json.dumps(payload).encode() if payload is not None else None,headers={'Content-Type':'application/json','Authorization':'Bearer '+token})
 try:
  with urllib.request.urlopen(request,timeout=310) as response:return json.load(response)
 except urllib.error.HTTPError as error:raise RuntimeError(error.read().decode()) from None

def collect():
 RUN.mkdir(parents=True,exist_ok=True);OUT.mkdir(parents=True,exist_ok=True)
 rows=[]
 for video,category in VIDEOS:
  local=RUN/f'{video}-input.json'
  if local.exists():
   data=json.loads(local.read_text());title=data['title'];channel=data['channel']
  else:
   url='https://www.youtube.com/watch?v='+video
   metadata=requests.get('https://www.youtube.com/oembed',params={'url':url,'format':'json'},timeout=30);metadata.raise_for_status();metadata=metadata.json()
   page=requests.get(url,timeout=30);page.raise_for_status()
   durations=re.findall(r'"lengthSeconds"\s*:\s*"(\d+)"',page.text)
   if not durations:raise RuntimeError('No public duration for '+video)
   duration=int(durations[0]);title=metadata['title'];channel=metadata['author_name']
   fetched=api('/api/transcript',{'input':{'videoId':video,'duration':duration,'title':title}})
   if not fetched.get('cues'):raise RuntimeError('No captions for '+video)
   if not fetched['language'].startswith('en'):raise RuntimeError('Not original English: '+video)
   data={'videoId':video,'duration':duration,'title':title,'goal':'','cues':fetched['cues'],'language':fetched['language'],'channel':channel}
   local.write_text(json.dumps(data,indent=2)+'\n')
  rows.append({'videoId':video,'title':title,'channel':channel,'category':category,'duration':data['duration'],'language':data['language'],'cueCount':len(data['cues']),'inputSha256':digest(local),'url':'https://www.youtube.com/watch?v='+video})
  print('Collected',video,title,data['duration'],len(data['cues']),flush=True)
 (OUT/'sources.json').write_text(json.dumps({'date':'2026-10-08','viewingGoal':'Understand the whole video topic','sources':rows},indent=2)+'\n')

def analyze():
 freeze=json.loads((OUT/'freeze.json').read_text())
 assert freeze['labelsSha256']==digest(OUT/'review.json')
 assert freeze['classifierSha256']==digest(ROOT/'classifier-config.json')
 assert freeze['pipelineSha256']==digest(ROOT/'worth_analysis.py')
 assert freeze['rules']==api('/api/rules')['rules'],'Settings changed; stop rather than combine configurations.'
 for video,_ in VIDEOS:
  path=RUN/f'{video}-input.json';assert digest(path)==freeze['inputs'][video]
  target=RUN/f'{video}-result.json'
  if target.exists():continue
  data=json.loads(path.read_text());start=time.monotonic()
  result=api('/api/analyze',{'input':data})
  target.write_text(json.dumps({**result,'elapsedSeconds':round(time.monotonic()-start,3)},indent=2)+'\n')
  r=result['result'];print('Analysed',video,r['verdict'],r['totals'],'seconds',round(time.monotonic()-start,2),flush=True)

def report():
 freeze=json.loads((OUT/'freeze.json').read_text())
 assert freeze['labelsSha256']==digest(OUT/'review.json')
 assert freeze['sourcesSha256']==digest(OUT/'sources.json')
 assert freeze['rules']==api('/api/rules')['rules']
 assert freeze['classifierSha256']==digest(ROOT/'classifier-config.json')
 assert freeze['pipelineSha256']==digest(ROOT/'worth_analysis.py')
 sources=json.loads((OUT/'sources.json').read_text())['sources']
 reviews={v['videoId']:v for v in json.loads((OUT/'review.json').read_text())['videos']}
 # Validate every result against the exact configuration/input cache key used by the service.
 code="""import {readFileSync} from 'node:fs';import {cacheKey,classifierIdentity,validateInput} from './lib/analysis.mjs';import {analysisRules} from './extension/rules.js';const f=JSON.parse(readFileSync('evaluation/ten-video-2026-10-08/freeze.json'));let out={};for(const id of Object.keys(f.inputs)){const data=JSON.parse(readFileSync('runtime/evaluation/ten-video-2026-10-08/'+id+'-input.json'));out[id]=cacheKey({input:validateInput(data,f.rules),rules:analysisRules(f.rules),classifierIdentity});}console.log(JSON.stringify(out));"""
 expected=json.loads(subprocess.check_output(['node','--input-type=module','-e',code],cwd=ROOT))
 labels=['keep','context','skip','unknown'];rows=[];aggregate={a:{b:0.0 for b in labels} for a in labels}
 for source in sources:
  video=source['videoId'];input_path=RUN/f'{video}-input.json';assert digest(input_path)==freeze['inputs'][video]
  data=json.loads(input_path.read_text());response=json.loads((RUN/f'{video}-result.json').read_text());r=response['result'];gold=reviews[video]
  assert r['analysisId']==expected[video],video+' configuration mismatch'
  assert r['local'] and r['provider']=='Laya' and not r['reliability']['automaticSkippingValidated']
  assert abs(sum(r['totals'].values())-source['duration'])<1e-6
  assert all(abs(a['end']-b['start'])<1e-6 for a,b in zip(r['segments'],r['segments'][1:]))
  coverage=[]
  for cue in data['cues']:
   start=cue['start'];end=cue['end']
   if coverage and start<=coverage[-1][1]:coverage[-1][1]=max(end,coverage[-1][1])
   else:coverage.append([start,end])
  matrix={a:{b:0.0 for b in labels} for a in labels}
  for g in gold['intervals']:
   for s in r['segments']:
    for start,end in coverage:
     overlap=max(0,min(g['end'],s['end'],end)-max(g['start'],s['start'],start))
     matrix[g['label']][s['kind']]+=overlap
  for a in labels:
   for b in labels:aggregate[a][b]+=matrix[a][b]
  def metrics(m):
   tp=m['keep']['keep'];useful=sum(m['keep'].values());highlighted=sum(m[a]['keep'] for a in labels if a!='unknown');filler=sum(m['skip'].values());found=m['skip']['skip']
   return {'usefulCorrectSeconds':tp,'usefulReferenceSeconds':useful,'highlightedKnownSeconds':highlighted,'usefulPrecision':tp/highlighted if highlighted else None,'usefulRecall':tp/useful if useful else None,'clearFillerSeconds':filler,'clearFillerIdentifiedSeconds':found,'clearFillerRecall':found/filler if filler else None,'fillerHighlightedSeconds':m['skip']['keep'],'usefulOmittedFromHighlightsSeconds':useful-tp,'usefulMarkedSkipSeconds':m['keep']['skip'],'mixedMarkedSkipSeconds':m['context']['skip'],'unknownReferenceHighlightedSeconds':m['unknown']['keep']}
  rows.append({**source,'reviewVerdict':gold['expectedVerdict'],'worthVerdict':r['verdict'],'verdictMatch':r['verdict']==gold['expectedVerdict'],'totals':r['totals'],'captionCoveredSeconds':sum(b-a for a,b in coverage),'metrics':metrics(matrix),'confusionSeconds':matrix,'analysisId':r['analysisId'],'cached':response['cached'],'elapsedSeconds':response['elapsedSeconds'],'segments':[{k:s[k] for k in ['start','end','kind','confidence','title','reason','autoSkipEligible']} for s in r['segments']]})
 total=metrics(aggregate)
 total.update(videoCount=len(rows),durationSeconds=sum(r['duration'] for r in rows),cueCount=sum(r['cueCount'] for r in rows),verdictMatches=sum(r['verdictMatch'] for r in rows),captionCoveredSeconds=sum(r['captionCoveredSeconds'] for r in rows),highlightedSeconds=sum(r['totals']['keep'] for r in rows),automaticSkipsExecuted=0,elapsedAnalysisSeconds=sum(r['elapsedSeconds'] for r in rows))
 result={'date':'2026-10-08','method':'Frozen agent transcript review compared against the deployed Chrome extension local API with real Laya. Time-weighted overlap on caption-covered intervals; unknown reference regions excluded from precision/recall and reported separately.','classifier':freeze['classifier'],'metrics':total,'confusionSeconds':aggregate,'sampleTargetsMet':total['usefulPrecision']>=.9 and total['usefulRecall']>=.9 and total['clearFillerRecall']>=.5 and total['usefulMarkedSkipSeconds']==0 and total['mixedMarkedSkipSeconds']==0,'limitations':json.loads((OUT/'review.json').read_text())['limitations']+['Automatic skipping was disabled; zero executed skips cannot establish safe skip accuracy.','This is a fresh sample audit of the four-choice production fallback; it does not replace or invalidate the historical five-choice failure.','Mixed and uncertain passages may be safely retained but still absent from Useful only; highlight recall measures that omission.'],'videos':rows}
 (OUT/'report.json').write_text(json.dumps(result,indent=2)+'\n')
 print(json.dumps(total,indent=2));print('Sample targets met:',result['sampleTargetsMet'])

if __name__=='__main__':
 {'collect':collect,'analyze':analyze,'report':report}[sys.argv[1]]()
