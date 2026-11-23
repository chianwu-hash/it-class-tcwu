"""Apply a frozen, isolated-tested practice batch and reconcile uncertain writes."""
import base64
from hashlib import sha256
import json
import os
from pathlib import Path
import subprocess
import sys
from datetime import datetime,timezone

packet_path=Path(sys.argv[1]); kind=sys.argv[2]
packet=json.loads(packet_path.read_text('utf-8-sig')); E=Path(packet['outputDir']); prefix=packet['prefix']
W=Path(__file__).resolve().parent.parent
file=lambda n,s='json':E/f'{prefix}-{n}.private.{s}'
load=lambda n:json.loads(file(n).read_text('utf-8-sig'))
def save(n,v):file(n).write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
def now():return datetime.now(timezone.utc).isoformat()
plan=load('plan');ids=plan['ids'];counts=plan['counts'];isolated=load('isolated')
assert plan['packetSha']==ids['packetSha']==isolated['packetSha']==sha256(packet_path.read_bytes()).hexdigest()
assert isolated['passed'] and isolated['rollback_verified']
for source,h in packet['inputs'].items():assert sha256(Path(source).read_bytes()).hexdigest()==h
for name,h in isolated['sql'].items():assert sha256(file(name,'sql').read_bytes()).hexdigest()==h

def query(name):
 proc=subprocess.run(['cmd.exe','/d','/c','D:/local-bin/supabase-personal.cmd','db','query','--linked','--project-ref','upxgyusodibaqcrocdzj','-o','json','-f',str(file(name,'sql'))],cwd=W,env={**os.environ,'TEMP':str(E/'tmp'),'TMP':str(E/'tmp')},capture_output=True,text=True,encoding='utf8',timeout=150)
 log=file(f'{name}-{int(__import__("time").time()*1000)}','log');log.write_text(proc.stdout+'\n'+proc.stderr,encoding='utf8');proc.check_returncode()
 rows=json.loads(proc.stdout[proc.stdout.index('{'):proc.stdout.rfind('}')+1])['rows'];assert len(rows)==1
 return json.loads(base64.b64decode(rows[0]['payload']))

def exact(r,visible):
 assert r['visible'] is visible and r['status']=='open' and r['version']==ids['version'] and r['document_exact']
 assert r['groups']==counts['sources'] and r['questions']==r['references']==counts['questions'] and r['samples_private']==counts['samples']
 assert bool(r['classes']) is visible and all(len(c)==3 and c.startswith('3') for c in r['classes'])

def answers():
 r=query('answers');assert len(r['rows'])==counts['samples']
 for sample in ids['samples']:
  matches=[a for a in r['rows'] if a['session']==sample['session'] and a['question']==sample['question_id']];assert len(matches)==1 and matches[0]['correct']
  expected=plan['sampleExpected'][sample['question_id']]
  assert json.loads(matches[0]['response'])==expected
 save('answer-readback',{'passed':True,'sampleCount':len(r['rows']),'questions':[a['question'] for a in r['rows']]})

def mutation(name,visible):
 intent={'packetSha':plan['packetSha'],'operation':name,'sqlSha':isolated['sql'][name],'session':ids['session'],'samples':ids['samples']}
 intent_path=file(name+'-intent')
 if intent_path.exists():assert json.loads(intent_path.read_text('utf8'))==intent
 else:
  with intent_path.open('x',encoding='utf8') as out:json.dump(intent,out,ensure_ascii=False,indent=2)
 # The fixed IDs are reserved in the frozen intent before any write.
 if name=='stage':
  presence=query('presence')['sessions']
  assert presence in (0,counts['samples']+1),'partial or conflicting stage; manual reconciliation required'
  if presence:
   r=query('readback');exact(r,False);save(name+'-result',{'passed':True,**r,'reconciled':True});return
 else:
  r=query('readback')
  if r['visible']:
   exact(r,True);save(name+'-result',{'passed':True,**r,'reconciled':True});return
  exact(r,False)
 started=now();failure=None
 try:query(name)
 except Exception as error:failure=type(error).__name__
 # The full document, material, order, all study rows and textbook metadata are
 # guarded by this read-only query, including after a lost mutation response.
 r=query('readback');exact(r,visible)
 save(name+'-result',{'passed':True,**r,'started':started,'finished':now(),'reconciled':failure is not None,'write_response_error':failure})

if kind=='stage':mutation('stage',False)
elif kind=='activate':
 proof=load('oauth-proof');assert proof['passed'] and proof['formalOAuth'] and proof['packetSha']==plan['packetSha']
 assert proof['sampleCount']==counts['samples']==len(proof['samples'])
 assert {s['question'] for s in proof['samples']}=={s['question_id'] for s in ids['samples']}
 for s in proof['samples']:
  assert s['saved_and_reopened'] and s['correct']
  assert {c['width'] for c in s['checks']}=={390,1280}
  assert all(c['sha_verified'] and c['returned_to_primary'] and c['retained_answer_and_work'] for c in s['checks'])
 answers();mutation('activate',True)
else:
 assert kind=='readback';r=query('readback');exact(r,True);answers()
 # Every whole question and shared block was compared by SQL equality in readback.
 checks=[{'source':c['source'],'questions':[q['id'] for b in c['doc']['blocks'] for q in b['questions']],'exact':True} for c in packet['candidates']]
 save('readback-result',{'passed':True,**r,'checks':checks,'packetSha':plan['packetSha']})
print(json.dumps({'operation':kind,'passed':True,'sources':counts['sources'],'samples':counts['samples']}))
