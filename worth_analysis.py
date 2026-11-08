"""Pure analysis pipeline; imports neither the model nor the worker event loop."""
import contextlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PROFILE = json.loads((ROOT / 'classifier-config.json').read_text())
ROLE = {'explanation':'lesson', 'recommendation':'conclusion', 'advertisement':'promotion', 'story':'background', 'greeting':'intro'}
TITLES = {'lesson':'Useful explanation', 'conclusion':'Opinion or recommendation', 'promotion':'Possible promotion', 'intro':'Greeting or outro', 'background':'Story or context', 'repetition':'Exact repetition', 'unknown':'Unknown interval'}

def type_question(r, candidate=None):
    criteria = {'explanation':r['explanationChoice'], 'advertisement':r['advertisementChoice'], 'story':r['storyChoice'], 'greeting':r['greetingChoice']}
    if (candidate or PROFILE['candidate']) == 'content-5':
        criteria['recommendation'] = r['recommendationChoice']
    return {'type':{'type':'choice', 'instructions':r['typeQuestion'], 'criteria':criteria}}

def normalized(text):
    return ' '.join(text.lower().split())

def clean_cues(data):
    """Only overlapping caption displays are deduplicated, never later speech."""
    cues = []
    original = data['cues']
    for i, cue in enumerate(original):
        start = cue['start']
        explicit = 'end' in cue
        end = min(data['duration'], cue.get('end', min(original[i+1]['start'] if i+1<len(original) else data['duration'], start+data['rules']['gapSeconds'])))
        # Same-time rows can represent speaker labels; combine instead of creating zero duration.
        if end <= start:
            end = min(data['duration'], start + data['rules']['gapSeconds'])
        text = ' '.join(cue['text'].split())
        if cues and start < cues[-1]['end'] and explicit and cues[-1]['explicit']:
            previous = cues[-1]
            a,b=previous['text'].split(),text.split()
            overlap=next((n for n in range(min(len(a),len(b)),1,-1) if [w.lower() for w in a[-n:]]==[w.lower() for w in b[:n]]),0)
            if normalized(text)==normalized(previous['text']):
                previous['end']=max(end,previous['end']); continue
            if overlap:
                text=' '.join(b[overlap:])
                if not text:
                    previous['end']=max(end,previous['end']); continue
        # Keep exact non-overlapping target intervals, with no unspoken tail extension.
        if cues and start < cues[-1]['end']:
            if start == cues[-1]['start']:
                cues[-1]['text'] += ' '+text
                cues[-1]['end'] = max(cues[-1]['end'],end)
                cues[-1]['explicit'] = False
                continue
            cues[-1]['end']=start
        cues.append({'start':start,'end':end,'text':text,'explicit':explicit})
    return cues

def windows(data, tokenizer=None):
    r=data['rules']; groups=[]
    # Reserve the complete head allowance and room for relevance metadata.
    budget=max(64,r['analyzeTokens']-512)
    def fits(text):
        return len(text)<=r['windowChars'] and (tokenizer is None or len(tokenizer.encode(text,add_special_tokens=False))<=budget)
    for cue in clean_cues(data):
        last=groups[-1] if groups else None
        joined=(last['text']+' '+cue['text']) if last else cue['text']
        split=not last or cue['start']>last['end']+1 or cue['start']-last['start']>=r['windowMin'] or cue['end']-last['start']>r['windowMax'] or not fits(joined)
        if split:
            groups.append({**cue,'quotes':[cue['text']], 'cues':[cue], 'oversize':cue['end']-cue['start']>r['windowMax'] or not fits(cue['text'])})
        else:
            last['explicit'] &= cue['start']<=last['end'];last['text']=joined;last['end']=cue['end'];last['quotes'].append(cue['text']);last['cues'].append(cue);last['explicit'] &= cue['explicit']
    if len(groups)>min(r['maxWindows'],r['maxSegments']):
        raise ValueError('Video exceeds the excerpt limit. Split it into parts.')
    return groups

def predict(agent,text,questions,r):
    return agent.predict(text,questions,max_len=r['analyzeTokens'])

def judge(agent, group, data, before='', after='', candidate=None):
    r=data['rules'];text=group['text']
    base={'start':group['start'],'end':group['end'],'claim':'','autoSkipEligible':False,'boundariesTrusted':group['explicit']}
    if group['oversize']:
        return {**base,'kind':'unknown','confidence':'low','role':'unknown','title':TITLES['unknown'],'reason':'A caption exceeds the duration or token budget; it was not classified.'}
    result=predict(agent,text,type_question(r,candidate),r)
    a=result['answers']['type'];p=a.get('answer_confidence',0);role=ROLE.get(a['choice'],'unknown')
    truncated=result.get('usage',{}).get('truncated',False)
    kind='keep' if role in ('lesson','conclusion') else 'context'
    confidence='high' if p>=r['keepConfidence'] else 'medium'
    reason='Explains the topic or provides a meaningful assessment.' if kind=='keep' else 'Preserved context; content type alone does not make a passage filler.'
    lexical=any(re.search(r'(?<!\w)'+re.escape(phrase.lower())+r'(?!\w)',text.lower()) for phrase in r['fillerWords'])
    # Explicit instructions in captions are data, never application instructions.
    caution=bool(re.search(r"\b(not|never|don't|doesn't|isn't|without|however|but|instead|because|for example|ignore .*instructions)\b",text,re.I))
    if role in ('promotion','intro') and lexical and p>=r['skipConfidence'] and not caution:
        allowed=r['skipPromotion'] if role=='promotion' else r['skipIntro']
        # Test each half of candidate filler. A mixed lesson is retained as context.
        cue_parts=group.get('quotes',[text]);middle=max(1,len(cue_parts)//2)
        parts=[' '.join(cue_parts[:middle]),' '.join(cue_parts[middle:])]
        pure=True
        for part in filter(None,parts):
            sub=predict(agent,part,type_question(r,candidate),r)
            b=sub['answers']['type']
            if b['choice'] not in ('advertisement','greeting') or b.get('answer_confidence',0)<r['skipConfidence'] or sub.get('usage',{}).get('truncated'):
                pure=False
        if allowed and pure:
            kind='skip';confidence='high';reason='Explicit promotion or housekeeping; both parts contain no classified lesson.'
    elif lexical and kind=='keep':
        # Sponsorship mixed with useful speech must not become a whole green highlight.
        kind='context';confidence='low';reason='Useful speech may be mixed with promotion or housekeeping. Preserved for review.'
    if p<r['minConfidence'] or role=='unknown':
        kind='context';confidence='low';reason='The classifier is uncertain. Keep this passage available for context.'
    if truncated:
        kind='unknown';confidence='low';reason='The model truncated this excerpt; its coverage is unknown.'
    # Neighbours inform relevance only. They cannot change the target's time boundaries.
    if data.get('goal') and kind=='keep':
        state={'target':text,'video_title':data.get('title','')[:200],'previous_context':before[-160:],'next_context':after[:160]}
        relevance={'relevance':{'type':'choice','instructions':r['relevanceQuestion'],'criteria':{'goal':data['goal'],'other':r['unrelatedChoice']}}}
        rel=predict(agent,state,relevance,r);b=rel['answers']['relevance']
        if rel.get('usage',{}).get('truncated') or (b['choice']=='other' and b.get('answer_confidence',0)>=r['keepConfidence']):
            kind='context';confidence='low';reason='May support the topic, but relevance to your viewing goal is uncertain.'
    return {**base,'kind':kind,'confidence':confidence,'role':role,'title':TITLES.get(role,TITLES['unknown']),'reason':reason,'answerConfidence':p}

def classify(agent,data,job_id=None,cancelled=None,emit=lambda _:None,candidate=None):
    r=data['rules'];groups=windows(data,getattr(agent,'tok',None));segments=[];facts_left=r['maxClaims']
    for i,group in enumerate(groups):
        if cancelled is not None and job_id in cancelled: raise InterruptedError('cancelled')
        segment=judge(agent,group,data,groups[i-1]['text'] if i else '',groups[i+1]['text'] if i+1<len(groups) else '',candidate)
        # Exact later speech can be identified, but repetition can teach; it is never auto-skipped.
        if r['skipRepetition'] and i and group['start']>=groups[i-1]['end'] and normalized(group['text'])==normalized(groups[i-1]['text']) and len(set(re.findall(r'\w+',group['text'].lower())))>=r['repetitionWords']:
            segment.update(kind='context',confidence='low',role='repetition',title='Exact repetition',reason='Matches the previous speech. Preserved because repetition may reinforce an explanation.')
        if facts_left and segment['kind'] in ('keep','context'):
            question={'factual':{'type':'choice','instructions':r['factQuestion'],'criteria':{'fact':r['factChoice'],'opinion':r['opinionChoice'],'request':r['requestChoice']}}}
            factual=predict(agent,group['text'],question,r);a=factual['answers']['factual']
            if a['choice']=='fact' and a.get('answer_confidence',0)>=r['claimConfidence'] and not factual.get('usage',{}).get('truncated'):
                sentences=[s.strip() for s in re.split(r'(?<=[.!?])\s+',group['text']) if r['claimMinChars']<=len(s.strip())<=r['claimMaxChars']]
                if not sentences:
                    quote=''
                    for text in group['quotes']:
                        if len(quote)+len(text)+1>min(r['quoteMaxChars'],r['claimMaxChars']):break
                        quote+=(' ' if quote else '')+text
                    if len(quote)>=r['quoteMinChars']:sentences=[quote]
                if sentences:segment['claim']=max(sentences,key=len);facts_left-=1
        # The service independently checks the release gate and coverage before allowing skipping.
        segment['autoSkipEligible']=segment['kind']=='skip' and segment['boundariesTrusted'] and PROFILE['releaseGatePassed'] and data.get('recommended',False)
        segments.append(segment);emit({'id':job_id,'event':'progress','completed':i+1,'total':len(groups)})
    return {'verdict':'uncertain','reason':'Verdict is computed from normalized coverage by the service.','segments':segments}
