"""序列啟動七份隔離SQL fixture並透過註冊worker驗正式網站介面。"""
import json,os,subprocess,time,urllib.request,socket
from pathlib import Path
ROOT=Path(os.environ.get('PAST_REVISION_ROOT','automation/output/past-exams-approved11-20261031'))
assert ROOT.as_posix() in ['automation/output/past-exams-approved11-20261031','automation/output/past-exams-autoreview-20261101']
rows=json.loads((ROOT/'candidates.private.json').read_text(encoding='utf-8'))
only=os.environ.get('APPROVED11_ONLY')
if only:rows=[r for r in rows if r['paperId']==only]
def run(args,**kw):return subprocess.run(args,encoding='utf-8',errors='replace',capture_output=True,creationflags=subprocess.CREATE_NO_WINDOW,**kw)
for index,row in enumerate(rows):
    pid=row['paperId'];port=4901+index;folder=ROOT/pid;log=folder/'fixture.log';env=os.environ.copy()
    with socket.socket() as check:check.bind(('127.0.0.1',port))
    env.update(PAST_BUNDLE_PATH=str((folder/'bundle.private.json').resolve()),PAST_LOCAL_PORT=str(port),PAST_TEST_ORIGIN='https://it-class-tcwu.vercel.app',PAST_TEST_BACKEND=f'http://127.0.0.1:{port}',PAST_TEST_OUTPUT=str(folder/'browser'),PAST_TYPES_ONLY='1',PAST_SKIP_SCREENSHOTS='1',PAST_FROZEN_LIVE_ROOT=os.environ.get('PAST_FROZEN_LIVE_ROOT',str((ROOT/'live-runtime').resolve())))
    if os.environ.get('APPROVED11_SIGNED'):
        env.update(PAST_SIGNED_MEDIA_PATH=str((ROOT/'signed-media.private.json').resolve()),PAST_REAL_STORAGE='1')
    if pid.endswith('g6-exam1-english'):env.update(PAST_AUDIO_CHECK='1',PAST_AUDIO_SCREENSHOTS='1',PAST_TARGET_QUESTION='s2-q04')
    if ROOT.name=='past-exams-autoreview-20261101':
        env['PAST_ANSWER_LABEL']='核對答案：'
        if pid.endswith('g3-exam1-science'):env['PAST_TARGET_QUESTION']='s2-q13'
        if pid.endswith('g6-exam1-science'):env['PAST_TARGET_QUESTION']='s1-q11'
    lease=None;server=None
    with log.open('w',encoding='utf-8') as stream:
        try:
            server=subprocess.Popen(['node','automation/past-exam-local-server.mjs'],env=env,stdout=stream,stderr=stream,creationflags=subprocess.CREATE_NO_WINDOW)
            for _ in range(40):
                if server.poll() is not None:raise RuntimeError('fixture stopped: '+str(log))
                try:
                    with urllib.request.urlopen(f'http://127.0.0.1:{port}/__past/setup',timeout=2) as r:assert r.status==200
                    break
                except OSError:time.sleep(1)
            else:raise RuntimeError('fixture timeout')
            while True:
                retained=(" -LeaseId '"+os.environ['APPROVED11_INITIAL_LEASE']+"'") if index==0 and os.environ.get('APPROVED11_INITIAL_LEASE') else ''
                r=run(['pwsh','-NoProfile','-Command',f"[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false);$OutputEncoding=[Console]::OutputEncoding;ai-browser-launch -Acquire{retained} 'http://127.0.0.1:{port}/__past/blank' -WaitSeconds 30 -Json"])
                try:v=json.loads(r.stdout)
                except Exception:raise RuntimeError('browser acquisition failed')
                if v.get('Action')=='busy':print('工作瀏覽器忙碌，等待空位',flush=True);time.sleep(8);continue
                assert r.returncode==0,v;lease=v;break
            (folder/'browser-lease.private.json').write_text(json.dumps(lease,ensure_ascii=False),encoding='utf-8')
            env['CDP_URL']=lease['CdpUrl']
            r=run(['node','D:/ai-browser/run-background.cjs','--lease-id',lease['LeaseId'],'automation/tests/quiz-past-batch-browser.cjs',lease['TargetId']],env=env,timeout=600)
            (folder/'browser-worker.log').write_text(r.stdout+'\n'+r.stderr,encoding='utf-8');assert r.returncode==0,'browser failed: '+str(folder/'browser-worker.log')
            print('PASS '+pid,flush=True)
        finally:
            if server is not None:server.terminate();server.wait(timeout=15)
            if lease:run(['pwsh','-NoProfile','-Command',f"ai-browser-launch -Release -LeaseId '{lease['LeaseId']}' -Json"])
