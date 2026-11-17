"""Audit source requirements and rebuild *unpublished* result-only candidates.

All source material stays in explicitly supplied private paths. No AI, network,
database writes, overwrites of old candidates, or answer inference.
"""
import argparse
import copy
import hashlib
import json
from collections import Counter
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib'))
from quiz_source_work_requirements import source_work_requirements, source_work_input, assert_source_work_adapter
from quiz_work_prompt import replace_result_only_work_hint


def sha(data):
    return hashlib.sha256(data).hexdigest()


def audit(catalog, originals, original_root, candidates):
    records = {r['id']: r for r in catalog['records']}
    scope = {}; verified = 0; corrected = []; counts = Counter()
    for source in originals:
        sid = source['id']
        for entry in source['source_files']:
            path = (original_root / sid / entry['name']).resolve()
            if not path.is_relative_to(original_root.resolve()): raise ValueError('source_path_outside_root')
            data = path.read_bytes()
            if len(data) != entry['bytes'] or sha(data) != entry['sha256']:
                raise ValueError('source_sha_changed:' + sid)
            verified += 1
        content = source['question'].get('content')
        req = source_work_requirements(records[sid]['catalog'], content['text'] if content else '')
        try: mode = source_work_input(req) or 'result_only'
        except ValueError: mode = 'source_specific_review'
        if content is None: mode = 'unparsed_source_review'
        counts[mode] += 1
        scope[sid] = {'source_parent_id': sid, 'mode': mode, 'requirements': req,
                      'source_files': source['source_files']}
    for old in candidates['pool']:
        sid = old['checks']['source_parent_id']; item = scope[sid]
        if item['mode'] not in ('expression', 'sketch'): continue
        q = copy.deepcopy(old['question'])
        if q['type'] != 'fields' or any(f['input'] != 'math' for f in q['fields']) or q['answer']['format'] != 'fields-v1':
            raise ValueError('verified_result_candidate_required:' + sid)
        row = copy.deepcopy(old)
        q['work'] = {'input': item['mode'], 'label': '算式' if item['mode'] == 'expression' else '直式作答'}
        q, receipt = replace_result_only_work_hint(q, item['requirements'])
        assert_source_work_adapter(records[sid]['catalog'], q, next(s for s in originals if s['id'] == sid)['question']['content']['text'])
        del q['id']
        digest = sha(json.dumps(q, ensure_ascii=False, sort_keys=True).encode())
        q['id'] = 'hlg3m_' + row['source_item_id'] + '_cw' + digest[:12]
        row['question_id'] = q['id']; row['question'] = q
        row['group_key'] = 'content_' + sha(json.dumps([q['prompt'], q['fields'], q['work']], ensure_ascii=False, sort_keys=True).encode())
        row['checks'].update(source_work_requirements=item['requirements'], work_input=item['mode'],
            replaces_provisional_question_id=old['question_id'], fixed_fields_and_answer_preserved=True,
            work_prompt_correction=receipt, candidate_content_sha256=digest,
            native_save_acceptance_pending=True, production_sql_approval_pending=True,
            production_content_acceptance_pending=True)
        corrected.append(row)
    return {'scope': list(scope.values()), 'summary': {'source_parents': len(scope),
        'source_files_verified': verified, 'modes': dict(counts), 'corrected_candidates': len(corrected),
        'candidate_modes': dict(Counter(r['checks']['work_input'] for r in corrected)),
        'new_ai_calls': 0, 'production_added': 0}, 'pool': corrected,
        'new_media_assets': candidates.get('new_media_assets', {}),
        'final_release_ready': False, 'production_enabled': False}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--catalog', required=True)
    parser.add_argument('--originals', required=True); parser.add_argument('--original-root', required=True)
    parser.add_argument('--candidates', required=True); parser.add_argument('--out', required=True)
    args = parser.parse_args(); out = Path(args.out)
    if not out.name.endswith('.private.json') or out.exists(): raise ValueError('new_private_output_required')
    load = lambda p: json.loads(Path(p).read_text(encoding='utf-8-sig'))
    result = audit(load(args.catalog), load(args.originals), Path(args.original_root), load(args.candidates))
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(result['summary'], ensure_ascii=False))
