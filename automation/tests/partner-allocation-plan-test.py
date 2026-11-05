import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('compiler', ROOT / 'automation/build-partner-allocation.py')
compiler = importlib.util.module_from_spec(spec)
spec.loader.exec_module(compiler)


class PlanTests(unittest.TestCase):
    def test_all_fifty_structures_preserve_targets_and_dependencies(self):
        structure = json.loads((ROOT / 'docs/development/past-paper-allocation-structure.json').read_text(encoding='utf-8'))
        decisions = json.loads((ROOT / 'docs/development/past-paper-allocation-decisions.json').read_text(encoding='utf-8'))
        output = json.loads((ROOT / 'supabase/partner-allocation-plan.json').read_text(encoding='utf-8'))
        self.assertEqual(output['papers'], compiler.build(structure, decisions))
        self.assertEqual(len(output['papers']), 50)
        for source, plan, decision in zip(structure['papers'], output['papers'], decisions['papers']):
            with self.subTest(paper=source['paperId']):
                self.assertEqual(source['paperId'], decision['paperId'])
                owners = {f['id']: p['id'] for p in plan['packs'] for f in p['fields']}
                fields = [f['id'] for p in plan['packs'] for f in p['fields']]
                self.assertEqual(len(fields), len(set(fields)))
                self.assertEqual(len(fields), source['answerFieldCount'])
                active_targets = 0
                for unit in source['units']:
                    refs = [r for q in unit['questions'] for r in q['refs'] if 'fieldId' in r]
                    if refs:
                        self.assertEqual(len({owners[r['fieldId']] for r in refs}), 1)
                    active_targets += sum(any('fieldId' in r for r in q['refs']) for q in unit['questions'])
                self.assertEqual(sum(p['weight'] for p in plan['packs']), active_targets)
                for pool in decision.get('sharedOptionPools', []):
                    self.assertEqual(len({owners[f] for f in pool['fieldIds']}), 1)
                self.assertGreaterEqual(len(plan['packs']), 4)
                self.assertEqual(plan['version'], source['activeVersion'])
                self.assertEqual(plan['sha256'], source['documentSha256'])


if __name__ == '__main__':
    unittest.main()
