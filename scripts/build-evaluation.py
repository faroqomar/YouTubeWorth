"""Reconstruct reviewed excerpts from local public transcript exports; never packages speech."""
import hashlib,json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SOURCES={
 '-fff5w9O0yI':('development','Are Developers obsolete?'),
 'MNOR65DYdpA':('calibration','Mistral Large 4 hands-on coding review'),
 'mc6HxWv6NgY':('test','ChatGPT vs Claude Make Geometry Dash From Scratch (Unity)'),
 'sQXFhh_PiG4':('test','Which Programming Language Can Handle the Most Users on a $12 Server?'),
 '-mv1Tf26Vms':('test','AI news and model release discussion'),
 'Wkaw03p3BrM':('test','DeepMind AlphaGenome interview')}
# Labels were assigned from transcript context before running either candidate.
# Content-type gold for calibration is separate from usefulness gold.
RANGES={
 '-fff5w9O0yI':{
 'keep':[(21,49),(222,248),(248,272),(292,320),(340,378),(452,480),(535,565),(625,655),(685,725),(1417,1446),(1459,1489)],
 'skip':[(49,70),(70,90),(90,113),(113,122),(1489,1497)],
 'context':[(122,133),(180,195),(728,746),(1164,1177),(1497,1520)]},
 'MNOR65DYdpA':{
 'keep':[(31,61),(63,87),(87,117),(121,145),(145,165),(166,193),(203,234),(235,260),(311,334),(335,365),(384,414),(420,449),(457,480),(480,508),(508,537)],
 'skip':[(275,299),(299,309),(539,552)],
 'context':[(3,31)]},
 'mc6HxWv6NgY':{
 'keep':[(17,52),(425,454),(512,541)],
 'context':[(109,124),(136,156),(165,184),(225,250),(265,286),(300,318),(335,355),(457,478),(548,571),(590,613),(632,654),(710,730)]},
 'sQXFhh_PiG4':{
 'keep':[(52,75),(120,145),(198,221),(326,341),(386,409),(446,468),(632,662),(801,826)],
 'skip':[(849,857),(857,864),(864,872),(883,887)],
 'context':[(838,849),(872,883)]},
 '-mv1Tf26Vms':{
 'keep':[(45,71),(336,360),(446,473),(959,978),(1251,1281)],
 'skip':[(204,211),(211,219),(578,585),(760,768),(768,779),(1483,1490),(1490,1498),(1498,1504),(1504,1509),(1509,1514)],
 'context':[(221,248),(248,274),(274,292)]},
 'Wkaw03p3BrM':{
 'keep':[(59,87),(118,143),(244,272),(1629,1661)],
 'skip':[(1942,1952),(1952,1961),(1961,1969),(1969,1979),(1979,1992),(1992,1997)],
 'context':[(10,24),(45,59),(1922,1942)]}}

def transcript(video):
 raw=(ROOT/'runtime/evaluation'/f'{video}.txt').read_text();cues=[]
 for stamp,text in re.findall(r'^\[([\d:]+)\] (.+)$',raw,re.M):
  n=0
  for part in stamp.split(':'):n=n*60+int(part)
  cues.append({'start':n,'text':text})
 return raw,cues

def build():
 manifest=[];private=[]
 for video,(split,title) in SOURCES.items():
  raw,cues=transcript(video)
  for label,ranges in RANGES[video].items():
   for start,end in ranges:
    selected=[c for c in cues if start<=c['start']<end]
    if not selected and label!='context':raise ValueError((video,start,end))
    text=' '.join(c['text'] for c in selected)
    # Endpoints from exported starts are inferred, never a trusted skip boundary.
    case={'id':f'{video}:{start}-{end}','videoId':video,'split':split,'title':title,'start':start,'end':end,'label':label,'goal':'','review':'Agent reviewed public transcript context; no independent human or visual review.', 'rationale':{'keep':'Relevant explanation, evidence, comparison or assessment.','skip':'Channel promotion, sponsor pitch or closing housekeeping unrelated to understanding the main topic.','context':'Mixed promotion and explanation, visual demonstration, transition or insufficient context.'}[label],'sha256':hashlib.sha256(text.encode()).hexdigest(),'transcriptSha256':hashlib.sha256(raw.encode()).hexdigest()}
    if split=='calibration':case['contentType']='advertisement' if label=='skip' and start<539 else 'greeting' if label=='skip' else 'explanation'
    manifest.append(case)
    private.append({**case,'text':text,'quotes':[c['text'] for c in selected],'before':' '.join(c['text'] for c in cues if start-25<=c['start']<start),'after':' '.join(c['text'] for c in cues if end<=c['start']<end+25)})
 counts={split:{label:sum(c['split']==split and c['label']==label for c in manifest) for label in ('keep','skip','context')} for split in ('development','calibration','test')}
 assert counts['test']=={'keep':20,'skip':20,'context':20},counts
 (ROOT/'evaluation/cases.json').write_text(json.dumps({'version':1,'sourceType':'public-original-auto-captions','labelsFrozenBeforeInference':True,'counts':counts,'cases':manifest},indent=2)+'\n')
 (ROOT/'runtime/evaluation/cases-private.json').write_text(json.dumps(private))
 print(json.dumps(counts))
if __name__=='__main__':build()
