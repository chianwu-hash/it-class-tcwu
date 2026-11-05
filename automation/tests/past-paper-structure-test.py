"""Structural regressions using synthetic metadata, without original exam content."""
import copy
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location(
    "verifier", Path(__file__).resolve().parents[1] / "past-paper-structure-verify.py")
verifier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)


def fixture(packed=False):
    origin = {"fileId": "paper", "page": 1, "sha256": "1" * 64}
    source = {"id": "synthetic", "active_version": "version-a", "sha256": "a" * 64,
              "enabled": False, "grade": 3,
              "document": {"groups": [
                  {"id": "g1", "fields": [{"id": "f1"}, {"id": "f2"}]},
                  {"id": "g2", "optional": True, "fields": [{"id": "f3"}]}],
                  "blocked": [{"id": "b1"}]},
              "provenance": {"entries": [{"id": f, "source": origin}
                                            for f in ("f1", "f2", "f3", "b1")]}}
    decision = {"paperId": "synthetic", "activeVersion": "version-a",
                "documentSha256": "a" * 64, "questions": [],
                "bundles": [] if packed else [{"members": ["g:g1"]}],
                "fieldParts": {"f1": ["a", "b"]} if packed else {}}
    names = [("f1", "a"), ("f1", "b"), ("f2", None), ("f3", None), ("b1", None)] if packed else [
        ("f1", None), ("f2", None), ("f3", None), ("b1", None)]
    questions = []
    for n, (identity, part) in enumerate(names):
        ref = {"blockedId": identity} if identity == "b1" else {
            "fieldId": identity, "groupId": "g2" if identity == "f3" else "g1"}
        ref["source"] = origin.copy()
        if part:
            ref["sourcePart"] = part
        questions.append({"id": f"q{n}", "optional": identity == "f3", "refs": [ref]})
    batches = [[q] for q in questions] if packed else [questions[:2], [questions[2]], [questions[3]]]
    units = []
    for n, qs in enumerate(batches):
        identities = {r.get("fieldId", r.get("blockedId")) for q in qs for r in q["refs"]}
        units.append({"id": f"u{n}", "kind": "bundle" if len(qs) > 1 else "independent",
                      "subquestionCount": len(qs), "questions": qs,
                      "answerFieldCount": len(identities - {"b1"}),
                      "blockedFieldCount": int("b1" in identities), "available": "b1" not in identities})
    paper = {"paperId": "synthetic", "activeVersion": "version-a", "documentSha256": "a" * 64,
             "enabled": False, "grade": 3, "units": units,
             "independentQuestionCount": 5 if packed else 2, "bundleCount": 0 if packed else 1,
             "bundleSubquestionCounts": [] if packed else [2], "actualQuestionCount": len(questions),
             "allocationUnitCount": len(units), "answerFieldCount": 3, "blockedFieldCount": 1,
             "optionalQuestionCount": 1, "requiredQuestionCount": len(questions) - 1,
             "storageCouplings": [{"fieldId": "f1", "unitIds": ["u0", "u1"]}] if packed else [],
             "unlistedAssessments": [], "fullAssessmentQuestionCount": len(questions)}
    return {"schemaVersion": 1, "allocationEnabled": False, "papers": [paper]}, [source], [decision]


class StructureTests(unittest.TestCase):
    def test_complete_partition(self):
        self.assertEqual(verifier.check(*fixture()), 1)

    def test_version_rejected(self):
        data = fixture()
        data[0]["papers"][0]["activeVersion"] = "new-version"
        with self.assertRaisesRegex(ValueError, "version"):
            verifier.check(*data)

    def test_same_counts_do_not_hide_changed_bundle(self):
        data = fixture()
        units = data[0]["papers"][0]["units"]
        units[0]["questions"][1], units[1]["questions"][0] = units[1]["questions"][0], units[0]["questions"][1]
        with self.assertRaisesRegex(ValueError, "bundle partition"):
            verifier.check(*data)

    def test_duplicate_source_ref_rejected(self):
        data = fixture()
        qs = data[0]["papers"][0]["units"][0]["questions"]
        qs[1]["refs"] = copy.deepcopy(qs[0]["refs"])
        with self.assertRaisesRegex(ValueError, "field count"):
            verifier.check(*data)

    def test_blocked_cannot_be_available(self):
        data = fixture()
        data[0]["papers"][0]["units"][-1]["available"] = True
        with self.assertRaisesRegex(ValueError, "blocked"):
            verifier.check(*data)

    def test_optional_cannot_become_required(self):
        data = fixture()
        data[0]["papers"][0]["units"][1]["questions"][0]["optional"] = False
        with self.assertRaisesRegex(ValueError, "optional"):
            verifier.check(*data)

    def test_packed_source_parts_require_shared_payload_constraint(self):
        data = fixture(True)
        self.assertEqual(verifier.check(*data), 1)
        data[0]["papers"][0]["storageCouplings"] = []
        with self.assertRaisesRegex(ValueError, "coupling"):
            verifier.check(*data)

    def test_missing_paper_rejected(self):
        data = fixture()
        data[0]["papers"] = []
        with self.assertRaisesRegex(ValueError, "scope"):
            verifier.check(*data)

    def test_unlisted_assessment_cannot_be_invented(self):
        data = fixture()
        paper = data[0]["papers"][0]
        paper["units"].pop()
        paper.update(independentQuestionCount=1, actualQuestionCount=3, allocationUnitCount=2,
                     requiredQuestionCount=2, fullAssessmentQuestionCount=None,
                     unlistedAssessments=[{"blockedId": "b1", "questionCount": None,
                                          "source": data[1][0]["provenance"]["entries"][-1]["source"].copy()}])
        data[2][0]["excludedBlocked"] = ["b1"]
        self.assertEqual(verifier.check(*data), 1)
        paper["unlistedAssessments"][0]["questionCount"] = 1
        with self.assertRaisesRegex(ValueError, "invented"):
            verifier.check(*data)

    def test_unlisted_assessment_source_is_pinned(self):
        data = fixture()
        paper = data[0]["papers"][0]
        paper["units"].pop()
        paper.update(independentQuestionCount=1, actualQuestionCount=3, allocationUnitCount=2,
                     requiredQuestionCount=2, fullAssessmentQuestionCount=None,
                     unlistedAssessments=[{"blockedId": "b1", "questionCount": None,
                         "source": {"fileId": "paper", "page": 99, "sha256": "1" * 64}}])
        data[2][0]["excludedBlocked"] = ["b1"]
        with self.assertRaisesRegex(ValueError, "assessment source"):
            verifier.check(*data)

    def test_wrong_coupled_unit_rejected(self):
        data = fixture(True)
        data[0]["papers"][0]["storageCouplings"][0]["unitIds"] = ["u0", "u4"]
        with self.assertRaisesRegex(ValueError, "coupling"):
            verifier.check(*data)

    def test_runtime_allocation_stays_disabled(self):
        data = fixture()
        data[0]["allocationEnabled"] = True
        with self.assertRaisesRegex(ValueError, "enable"):
            verifier.check(*data)

    def test_unknown_source_part_rejected(self):
        data = fixture(True)
        data[0]["papers"][0]["units"][0]["questions"][0]["refs"][0]["sourcePart"] = "unknown"
        with self.assertRaisesRegex(ValueError, "source question refs"):
            verifier.check(*data)

    def test_duplicate_coupling_rejected(self):
        data = fixture(True)
        couplings = data[0]["papers"][0]["storageCouplings"]
        couplings.append(copy.deepcopy(couplings[0]))
        with self.assertRaisesRegex(ValueError, "coupling"):
            verifier.check(*data)

    def test_excluded_blocked_cannot_stay_in_unit(self):
        data = fixture()
        data[2][0]["excludedBlocked"] = ["b1"]
        with self.assertRaisesRegex(ValueError, "source question refs"):
            verifier.check(*data)

    def test_blocked_expansion_with_bundle(self):
        data = fixture()
        paper, decision = data[0]["papers"][0], data[2][0]
        decision["blockedExpansions"] = {"b1": ["a", "b"]}
        decision["bundles"].append({"members": ["b:b1"]})
        unit = paper["units"][-1]
        second = copy.deepcopy(unit["questions"][0])
        unit["questions"][0]["refs"][0]["sourcePart"] = "a"
        second["id"] = "q4"
        second["refs"][0]["sourcePart"] = "b"
        unit["questions"].append(second)
        unit.update(kind="bundle", subquestionCount=2)
        paper.update(independentQuestionCount=1, bundleCount=2, bundleSubquestionCounts=[2, 2],
                     actualQuestionCount=5, requiredQuestionCount=4, fullAssessmentQuestionCount=5)
        self.assertEqual(verifier.check(*data), 1)

    def test_compound_question_can_span_source_parts(self):
        data = fixture(True)
        paper, decision = data[0]["papers"][0], data[2][0]
        decision["questions"] = [{"members": ["f:f1#a", "f:f1#b"]}]
        first, second = paper["units"][:2]
        first["questions"][0]["refs"].extend(second["questions"][0]["refs"])
        paper["units"].pop(1)
        paper.update(independentQuestionCount=4, actualQuestionCount=4, allocationUnitCount=4,
                     requiredQuestionCount=3, fullAssessmentQuestionCount=4, storageCouplings=[])
        self.assertEqual(verifier.check(*data), 1)


if __name__ == "__main__":
    unittest.main()
