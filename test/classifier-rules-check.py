"""Exercise production classifier functions with controlled model decisions."""
import ast, json, sys
from pathlib import Path
root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root))
tree=ast.parse((root/'laya-worker.py').read_text())
# Load definitions only; do not start the service or initialise the real model.
body=[]
for node in tree.body:
    if isinstance(node,ast.Expr) and isinstance(node.value,ast.Call) and isinstance(node.value.func,ast.Attribute) and node.value.func.attr=='start':break
    body.append(node)
env={'__file__':str(root/'laya-worker.py')}
exec(compile(ast.Module(body=body,type_ignores=[]),'laya-worker.py','exec'),env)
env['emit']=lambda _:None
rules=json.load(sys.stdin)
class Decisions:
    def predict(self,text,questions,**kwargs):
        if 'relation' in questions:
            return {'answers':{'relation':{'choice':'supported','answer_confidence':.88}},'usage':{}}
        ad='sponsor' in text
        return {'answers':{'type':{'choice':'advertisement' if ad else 'explanation','answer_confidence':.96},'factual':{'choice':'opinion' if ad else 'fact','answer_confidence':.95}},'usage':{}}
def analyse(r):
    return env['classify'](Decisions(),{'duration':80,'rules':r,'cues':[{'start':0,'text':'sponsor message'},{'start':40,'text':'Technical explanation'}]},1)
a=analyse(rules)
assert a['segments'][0]['kind']=='skip' and a['segments'][1]['kind']=='keep'
assert analyse({**rules,'skipPromotion':False})['segments'][0]['kind']=='context'
assert analyse({**rules,'fillerWords':[]})['segments'][0]['kind']=='context'
assert all(not s['autoSkipEligible'] for s in a['segments'])
assert a['verdict']=='uncertain' # Server derives the final verdict from covered time.
data={'rules':rules,'items':[{'text':'Source','claim':'Claim','segmentIndex':0,'sourceIndex':0}]}
assert env['compare'](Decisions(),data,1)[0]['status']=='unverified'
data['rules']={**rules,'compareConfidence':.85}
assert env['compare'](Decisions(),data,1)[0]['status']=='supported'
print('Production classifier rules passed: filler toggles, phrase requirement, verdict thresholds, and source comparison confidence. Model decisions controlled.')
