"""Run local Laya only. Dev selection precedes calibration/freeze and held-out inference."""
import os,sys,json,hashlib,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
os.environ.update(HF_HUB_OFFLINE='1',TRANSFORMERS_OFFLINE='1',USE_TF='0',TOKENIZERS_PARALLELISM='false')
from worth_analysis import judge,type_question
import torch,laya
rules=json.loads(__import__('subprocess').check_output(['node','--input-type=module','-e',"import {defaults} from './extension/rules.js'; console.log(JSON.stringify(defaults))"],cwd=ROOT))
cases=json.loads((ROOT/'runtime/evaluation/cases-private.json').read_text())
torch.set_num_threads(4)
agent=laya.load(str(ROOT/'runtime/models/multilingual'),device='mps' if torch.backends.mps.is_available() else 'cpu')
def run(split,candidate):
 rows=[]
 for c in [c for c in cases if c['split']==split]:
  group={'start':c['start'],'end':c['end'],'text':c['text'],'quotes':c['quotes'],'explicit':False,'oversize':not bool(c['text'])}
  prediction=judge(agent,group,{'rules':rules,'title':c['title'],'goal':c['goal']},c['before'],c['after'],candidate)
  rows.append({'id':c['id'],'expected':c['label'],'predicted':prediction['kind'],'confidence':prediction.get('answerConfidence'), 'seconds':c['end']-c['start'],'autoSkipEligible':False})
  print(split,c['id'],prediction['kind'],flush=True)
 return rows

def metrics(rows):
 tp=sum(r['expected']=='keep' and r['predicted']=='keep' for r in rows); pred=sum(r['predicted']=='keep' for r in rows); useful=sum(r['expected']=='keep' for r in rows);filler=sum(r['expected']=='skip' for r in rows);found=sum(r['expected']=='skip' and r['predicted']=='skip' for r in rows)
 return {'count':len(rows),'usefulCorrect':tp,'usefulPredicted':pred,'usefulTotal':useful,'precision':tp/pred if pred else 0,'recall':tp/useful if useful else 0,'clearFillerFound':found,'clearFillerTotal':filler,'fillerRecall':found/filler if filler else 0,'harmfulFillerDecisions':sum(r['expected']!='skip' and r['predicted']=='skip' for r in rows),'automaticSkips':0,'harmfulAutomaticSkips':0,'decidedCoverage':sum(r['predicted'] in ('keep','skip') for r in rows)/len(rows),'seconds':sum(r['seconds'] for r in rows),'usefulSecondsHighlighted':sum(r['seconds'] for r in rows if r['expected']=='keep' and r['predicted']=='keep'),'fillerSecondsIdentified':sum(r['seconds'] for r in rows if r['expected']=='skip' and r['predicted']=='skip')}
mode=sys.argv[1] if len(sys.argv)>1 else 'development';out=ROOT/'evaluation';out.mkdir(exist_ok=True)
if mode=='development':
 results={c:run('development',c) for c in ['content-4','content-5']};m={c:metrics(rows) for c,rows in results.items()}
 # Preservation first, then highlight precision, then clear filler. No held-out access.
 selected=max(m,key=lambda c:(m[c]['recall'],m[c]['precision'],m[c]['fillerRecall']))
 (out/'development-report.json').write_text(json.dumps({'metrics':m,'selected':selected,'rows':results},indent=2)+'\n');print('SELECTED',selected,m,flush=True)
elif mode=='calibrate':
 from laya.calibrate import records_from_labeled,MIN_BUCKET_N,MIN_TYPE_N
 selected=json.loads((out/'development-report.json').read_text())['selected'];q=type_question(rules,selected);keys=list(q['type']['criteria']);pairs=[]
 for c in cases:
  if c['split']=='calibration' and c['label']!='context':pairs.append((c['text'],q,{'type':[float(k==c['contentType']) for k in keys]}))
 records=records_from_labeled(agent,pairs);fit=agent.fit_temperatures(records);agent.save_calibration(str(out/'calibration-experiment.json'))
 profile=json.loads((ROOT/'classifier-config.json').read_text());profile.update(candidate=selected,questionIdentity=selected+'-no-fact-penalty',calibrationIdentity='checkpoint-default-uncalibrated',status='Conservative map; automatic skipping awaits a passed independent release evaluation.')
 # Small, single-video calibration is an experiment; do not deploy it as reliability evidence.
 report={'sampleCount':len(records),'minimumTypeSamples':MIN_TYPE_N,'minimumBucketSamples':MIN_BUCKET_N,'fit':fit,'deployed':False,'reason':'Single-video calibration does not establish generalization or reliable skip probabilities.'}
 (out/'calibration-report.json').write_text(json.dumps(report,indent=2)+'\n');(ROOT/'classifier-config.json').write_text(json.dumps(profile,indent=2)+'\n')
 freeze={'classifier':profile,'rules':rules,'casesSha256':hashlib.sha256((out/'cases.json').read_bytes()).hexdigest(),'pipelineSha256':hashlib.sha256((ROOT/'worth_analysis.py').read_bytes()).hexdigest(),'frozenAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())}
 (out/'freeze.json').write_text(json.dumps(freeze,indent=2)+'\n');print('Calibration experiment and pre-test freeze saved.',flush=True)
elif mode=='test':
 freeze=json.loads((out/'freeze.json').read_text());assert freeze['casesSha256']==hashlib.sha256((out/'cases.json').read_bytes()).hexdigest();assert freeze['rules']==rules # Evaluate the frozen experiment, not a later fallback deployment.
 assert freeze['pipelineSha256']==hashlib.sha256((ROOT/'worth_analysis.py').read_bytes()).hexdigest()
 rows=run('test',freeze['classifier']['candidate']);m=metrics(rows)
 passed=m['precision']>=.9 and m['recall']>=.9 and m['fillerRecall']>=.5 and m['harmfulFillerDecisions']==0
 report={'metrics':m,'sampleGatePassed':passed,'releaseGatePassed':False,'limitations':['Agent-reviewed transcript labels, not independent human ground truth.','No visual review; visual gameplay retained as context.','Four whole held-out videos; excerpts within a video are correlated.','Clear-filler cases are short boundary-level excerpts; not representative of all automatic 25-second windows.','Automatic skipping is disabled; zero executed harmful skips is not evidence of skip accuracy.'],'rows':rows}
 (out/'held-out-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report['metrics']), 'GATE',passed,flush=True)
else:raise SystemExit('Use development, calibrate or test')
