"""Offline structural metadata verification. Never accesses credentials, network, or student records."""
import json,sys,collections
from pathlib import Path

def reviewed_partitions(groups, fields, blocked, decision):
 """Resolve explicit reviewed selectors; do not infer from text or grading kind."""
 def expand(selectors):
  result=[]
  for selector in selectors:
   kind,key=selector.split(':',1)
   if kind=='g':
    if key not in groups:raise ValueError('unknown reviewed group')
    result.extend(expand(['f:'+f['id'] for f in groups[key]['fields']]))
    continue
   if kind not in ('f','b'):raise ValueError('unknown selector kind')
   identity,separator,part=key.partition('#')
   if identity not in (fields if kind=='f' else blocked):raise ValueError('unknown reviewed reference')
   parts=decision.get('fieldParts' if kind=='f' else 'blockedExpansions',{}).get(identity)
   if parts is not None and (not parts or len(parts)!=len(set(parts))):raise ValueError('invalid source parts')
   if separator:
    if not parts or part not in parts:raise ValueError('unknown reviewed source part')
    result.append((kind,identity,part))
   elif parts:result.extend((kind,identity,p) for p in parts)
   else:result.append((kind,identity,None))
  if len(result)!=len(set(result)):raise ValueError('duplicate reviewed selector')
  return frozenset(result)
 refs=expand(['g:'+g for g in groups]+['b:'+b for b in blocked-set(decision.get('excludedBlocked',[]))])
 questions={frozenset([r]) for r in refs}
 for compound in decision['questions']:
  selected=expand(compound['members'])
  if len(selected)<2 or not all(frozenset([r]) in questions for r in selected):raise ValueError('overlapping compound decision')
  questions.difference_update(frozenset([r]) for r in selected);questions.add(selected)
 bundled=set();units=set()
 for bundle in decision['bundles']:
  selected=expand(bundle['members']);qs={q for q in questions if q<=selected}
  if len(qs)<2 or frozenset().union(*qs)!=selected or qs&bundled:raise ValueError('invalid reviewed bundle')
  bundled.update(qs);units.add(selected)
 units.update(questions-bundled)
 return questions,units

def check(registry,sources,decisions):
 def need(test,msg):
  if not test:raise ValueError(msg)
 need(registry.get('allocationEnabled') is False,'audit must not enable runtime allocation')
 need(registry.get('schemaVersion')==1,'unknown structure schema')
 ps={p['id']:p for p in sources};rs=registry['papers'];ds={d['paperId']:d for d in decisions}
 need(len({r['paperId'] for r in rs})==len(rs),'duplicate paper')
 need(len(ps)==len(sources) and len(ds)==len(decisions),'duplicate source/decision paper')
 need({r['paperId'] for r in rs}==set(ds),'incomplete decision scope')
 for r in rs:
  p=ps[r['paperId']];d=ds[p['id']]
  need(r['activeVersion']==p['active_version'] and r['documentSha256']==p['sha256'],'version mismatch '+p['id'])
  need(d['activeVersion']==p['active_version'] and d['documentSha256']==p['sha256'],'decision version mismatch')
  need(r['enabled']==p['enabled'] and r['grade']==p['grade'],'catalogue mismatch')
  groups={g['id']:g for g in p['document']['groups']};expected={f['id']:g['id'] for g in groups.values() for f in g['fields']};blocked={b['id'] for b in p['document'].get('blocked',[])};entries={e['id']:e for e in p['provenance']['entries']}
  need(len(expected)==sum(len(g['fields']) for g in groups.values()),'duplicate source fields')
  need(not set(expected)&blocked,'same source ID used for active and blocked')
  need(len(groups)==len(p['document']['groups']),'duplicate source group')
  need(set(d.get('fieldParts',{}))<=set(expected) and set(d.get('blockedExpansions',{}))<=blocked,'unknown source partition')
  reviewed_questions,reviewed_units=reviewed_partitions(groups,expected,blocked,d)
  source_units={};allkeys=[];uid=set();qid=set();ind=0;bund=[];qcount=0;actual_questions=[];actual_units=[];optional_count=0
  source_optional={f['id']:bool(g.get('optional',False)) for g in groups.values() for f in g['fields']}
  for u in r['units']:
   need(u['id'] not in uid,'duplicate unit');uid.add(u['id']);qs=u['questions'];need(len(qs)==u['subquestionCount'],'wrong child count')
   need(u['kind'] in ('independent','bundle'),'unknown kind');need((u['kind']=='independent' and len(qs)==1) or (u['kind']=='bundle' and len(qs)>=2),'invalid unit kind/count')
   if u['kind']=='independent':ind+=1
   else:bund.append(len(qs))
   qcount+=len(qs);afs=set();bfs=set();unit_keys=[]
   for q in qs:
    need(q['id'] not in qid,'duplicate question');qid.add(q['id']);need(q['refs'],'empty question')
    question_keys=[];optional_flags=[]
    for ref in q['refs']:
     active='fieldId' in ref;need(active!=('blockedId' in ref),'ambiguous reference');fid=ref.get('fieldId') if active else ref.get('blockedId');need(fid in (expected if active else blocked),'unknown reference')
     if active:
      need(ref['groupId']==expected[fid],'wrong technical group');afs.add(fid)
      source_units.setdefault(fid,set()).add(u['id'])
     else:bfs.add(fid)
     need(ref['source']=={k:entries[fid]['source'][k] for k in ('fileId','page','sha256')},'source evidence mismatch')
     key=('f' if active else 'b',fid,ref.get('sourcePart'));allkeys.append(key);question_keys.append(key);unit_keys.append(key);optional_flags.append(source_optional.get(fid,False))
    need(q['optional']==all(optional_flags),'optional task became required');optional_count+=q['optional'];actual_questions.append(frozenset(question_keys))
   need(u['answerFieldCount']==len(afs) and u['blockedFieldCount']==len(bfs),'wrong unit field count')
   need(u['available']==(not bfs),'blocked unit marked available')
   actual_units.append(frozenset(unit_keys))
  want=[]
  for fid in expected:
   parts=d.get('fieldParts',{}).get(fid,[None]);want.extend(('f',fid,part) for part in parts)
  for bid in blocked-set(d.get('excludedBlocked',[])):
   parts=d.get('blockedExpansions',{}).get(bid,[None]);want.extend(('b',bid,part) for part in parts)
  need(collections.Counter(allkeys)==collections.Counter(want),'missing or duplicated source question refs '+p['id'])
  need(len(set(allkeys))==len(allkeys),'duplicate exact source reference')
  need(collections.Counter(actual_questions)==collections.Counter(reviewed_questions),'reviewed question partition changed')
  need(collections.Counter(actual_units)==collections.Counter(reviewed_units),'reviewed bundle partition changed')
  need(set(d.get('excludedBlocked',[]))<=blocked,'invalid exclusion')
  need(ind==r['independentQuestionCount'] and bund==r['bundleSubquestionCounts'] and len(bund)==r['bundleCount'] and qcount==r['actualQuestionCount'] and len(r['units'])==r['allocationUnitCount'],'summary count mismatch')
  need(r['answerFieldCount']==len(expected) and r['blockedFieldCount']==len(blocked),'paper field mismatch')
  need(r['optionalQuestionCount']==optional_count and r['requiredQuestionCount']==qcount-optional_count,'optional/required count mismatch')
  couplings=r.get('storageCouplings',[]);got={c['fieldId']:set(c['unitIds']) for c in couplings};wanted={fid:ids for fid,ids in source_units.items() if len(ids)>1};need(len(got)==len(couplings) and all(len(c['unitIds'])==len(set(c['unitIds'])) for c in couplings) and got==wanted,'shared payload coupling omitted or duplicated')
  unlisted=r.get('unlistedAssessments',[]);need({a['blockedId'] for a in unlisted}==set(d.get('excludedBlocked',[])),'excluded assessment omitted')
  need(all(a['questionCount'] is None for a in unlisted),'unlisted assessment count invented')
  need(all(a['source']=={k:entries[a['blockedId']]['source'][k] for k in ('fileId','page','sha256')} for a in unlisted),'unlisted assessment source mismatch')
  need(r.get('fullAssessmentQuestionCount')==(None if unlisted else qcount),'unlisted assessment counted as complete')
  pools=d.get('sharedOptionPools',[]);pool_groups={g['id']:g for g in groups.values() if g.get('kind')=='code' and len(g['fields'])>1 and g.get('choices')}
  need(len(pools)==len(pool_groups) and {pool['groupId'] for pool in pools}==set(pool_groups),'shared option pool omitted or duplicated')
  for pool in pools:
   group=pool_groups[pool['groupId']];fids={f['id'] for f in group['fields']};owners=set().union(*(source_units[fid] for fid in fids))
   need(pool['fieldIds']==sorted(fids) and pool['choiceCount']==len(group['choices']) and pool['unitIds']==sorted(owners),'option pool mapping mismatch')
   need(pool['allocationReviewRequired']==(len(owners)>1) and pool['machineEncodedReusePolicy'] is None,'option reuse policy inferred without source contract')
   need(pool['source']=={k:entries[group['fields'][0]['id']]['source'][k] for k in ('fileId','page','sha256')},'option pool source mismatch')
 return len(rs)

if __name__ == '__main__':
 import argparse
 parser=argparse.ArgumentParser(description='Verify version-pinned past-paper allocation metadata offline; no database writes.')
 parser.add_argument('--structure',required=True)
 parser.add_argument('--source',required=True,help='Private read-only export of quiz_past document/provenance rows')
 parser.add_argument('--decisions',required=True)
 args=parser.parse_args()
 registry=json.loads(Path(args.structure).read_text(encoding='utf-8'))
 sources=json.loads(Path(args.source).read_text(encoding='utf-8'))
 decisions=json.loads(Path(args.decisions).read_text(encoding='utf-8'))['papers']
 count=check(registry,sources,decisions)
 print(json.dumps({'ok':True,'verifiedPapers':count,'allocationEnabled':False}))
