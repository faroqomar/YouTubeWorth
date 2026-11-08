# Test fixture for the local NDJSON transport, never loaded in normal service.
import json,sys,time
print(json.dumps({'event':'ready','model':'test fixture','device':'cpu'}),flush=True)
for line in sys.stdin:
    j=json.loads(line)
    if j['type']=='cancel':continue
    if j['type']=='analyze':
        d=j['data'];
        if d.get('title')=='Slow fixture':time.sleep(.7)
        r={'verdict':'selective','reason':'Fixture','segments':[{'start':0,'end':20,'kind':'skip','title':'Intro','reason':'Filler','confidence':'high','claim':''},{'start':20,'end':d['duration'],'kind':'keep','title':'Lesson','reason':'Useful','confidence':'high','claim':'The Earth is a planet.'}]}
    elif j['type']=='transcript':r={'language':'en-US','cues':[{'start':0.32,'end':10,'text':'Original English speech.'},{'start':100,'end':119,'text':'End of the lesson.'}]}
    else:r=[{'segmentIndex':i['segmentIndex'],'sourceIndex':i['sourceIndex'],'status':'supported'} for i in j['data']['items']]
    print(json.dumps({'id':j['id'],'result':r}),flush=True)
