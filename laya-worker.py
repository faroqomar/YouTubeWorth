"""Local, persistent Laya inference. NDJSON over stdio; no cloud model calls."""
import contextlib
import json
import os
from pathlib import Path
import queue
import re
import sys
import threading

os.environ.setdefault('HF_HUB_OFFLINE', '1')
os.environ.setdefault('TRANSFORMERS_OFFLINE', '1')
os.environ.setdefault('USE_TF', '0')
ROOT = Path(__file__).resolve().parent
pending = queue.Queue()
cancelled = set()

def emit(value):
    print(json.dumps(value, ensure_ascii=False), flush=True)

def reader():
    for line in sys.stdin:
        try:
            item = json.loads(line)
            if item.get('type') == 'cancel':
                cancelled.add(item['id'])
            else:
                pending.put(item)
        except Exception:
            continue
    pending.put(None)

from worth_analysis import classify as analyze_content, type_question, PROFILE

def classify(agent, data, job_id):
    return analyze_content(agent, data, job_id, cancelled, emit)

def compare(agent, data, job_id):
    r = data['rules']
    checks = []
    for item in data['items']:
        if job_id in cancelled:
            raise InterruptedError('cancelled')
        state = f"SOURCE: {item['text']}\nCLAIM: {item['claim']}"
        question = {'relation': {'type':'choice','instructions':r['compareQuestion'], 'criteria':{'supported':'Supported','contradicted':'Contradicted','unverified':'Not enough information'}}}
        with contextlib.redirect_stdout(sys.stderr):
            prediction = agent.predict(state, question, max_len=r['compareTokens'])
        answer = prediction['answers']['relation']
        label = answer['choice']
        if answer.get('answer_confidence', 0) < r['compareConfidence'] or prediction.get('usage',{}).get('truncated'):
            label = 'unverified'
        checks.append({'segmentIndex':item['segmentIndex'],'sourceIndex':item['sourceIndex'],'status':label})
    return checks

def transcript(data, job_id):
    # Public captions only, with no browser cookies, proxy, or login bypass.
    from youtube_transcript_api import YouTubeTranscriptApi
    from requests import Session
    class TimedSession(Session):
        def request(self, *args, **kwargs):
            kwargs.setdefault('timeout', data['rules']['captionTimeoutMs'] / 1000)
            return super().request(*args, **kwargs)
    with TimedSession() as session:
        available = YouTubeTranscriptApi(http_client=session).list(data['videoId'])
        # Prefer original English, including regional tracks. Never translate.
        tracks = list(available)
        preferred = data['rules']['preferredLanguage'].lower()
        english = [t for t in tracks if t.language_code.lower() == preferred or t.language_code.lower().split('-')[0] == preferred.split('-')[0]]
        selected = next((t for t in english if data['rules']['preferManual'] and not t.is_generated), None) or next(iter(english or tracks))
        fetched = selected.fetch()
    if job_id in cancelled:
        raise InterruptedError('cancelled')
    cues = [{'start':s.start,'end':min(data['duration'],s.start+s.duration),'text':s.text.strip()}
            for s in fetched if s.text.strip() and 0 <= s.start < data['duration'] and s.duration > 0]
    return {'cues':cues,'language':fetched.language_code}

threading.Thread(target=reader, daemon=True).start()
try:
    with contextlib.redirect_stdout(sys.stderr):
        import torch
        import laya
        torch.set_num_threads(min(4, os.cpu_count() or 4))
        device = 'mps' if torch.backends.mps.is_available() else 'cpu'
        agent = laya.load(str(ROOT / 'runtime/models/multilingual'), device=device)
        agent.predict('Useful explanation of the topic.', {'warm':{'type':'choice','instructions':'What type of text is this?','criteria':{'explanation':'Technical explanation','advertisement':'Advertisement'}}}, max_len=512)
    emit({'event':'ready','model':'Laya multilingual','device':device,'version':laya.__version__})
except Exception as error:
    emit({'event':'fatal','error':str(error)})
    sys.exit(1)
while True:
    job = pending.get()
    if job is None:
        break
    try:
        if job['id'] in cancelled:
            raise InterruptedError('cancelled')
        if job['type']=='analyze':
            value=classify(agent, job['data'], job['id'])
        elif job['type']=='transcript':
            value=transcript(job['data'], job['id'])
        elif job['type']=='compare':
            value=compare(agent, job['data'], job['id'])
        else:
            raise ValueError('Unknown request type')
        emit({'id':job['id'],'result':value})
    except Exception as error:
        emit({'id':job.get('id'),'error':str(error),'errorType':type(error).__name__})
    finally:
        cancelled.discard(job.get('id'))
