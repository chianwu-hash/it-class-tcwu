import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("ledger", Path(__file__).parents[1] / "build-quiz-conversion-ledger.py")
ledger = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ledger)


class EvidenceLedgerTests(unittest.TestCase):
    def test_unknown_is_not_acceptance_or_activation(self):
        inventory = {"records": [{"source_parent_id": "synthetic", "versions": [{
            "question_id": "q", "source_version": "version"}], "candidate_exists": True}]}
        result = ledger.build(inventory, [])
        row = result["records"][0]
        self.assertEqual(row["candidate_status"], "identity_only_missing_file_binding")
        self.assertEqual(row["data_acceptance"], "unknown")
        self.assertEqual(row["activation"], "unknown")
        self.assertEqual(result["summary"]["release_ready"], 0)

    def test_duplicate_parent_is_rejected(self):
        row = {"source_parent_id": "synthetic", "versions": []}
        with self.assertRaises(ValueError):
            ledger.build({"records": [row, row]}, [])

    def test_receipt_requires_exact_candidate_and_all_referenced_hashes(self):
        candidate_sha = "a" * 64
        receipt = {"data": {"passed": True, "status": "isolated_acceptance_complete"},
                   "hashes": {candidate_sha}, "references": [
                       {"path": "source-proof.json", "matches": True, "passed": True},
                       {"path": "native-proof.json", "matches": True, "passed": True}]}
        self.assertTrue(ledger.receipt_acceptance(receipt, candidate_sha))
        self.assertFalse(ledger.receipt_acceptance(receipt, "b" * 64))
        receipt["references"].append({"path": "missing-proof.json", "matches": False})
        self.assertFalse(ledger.receipt_acceptance(receipt, candidate_sha))

    def test_media_only_receipt_does_not_prove_data_acceptance(self):
        receipt = {"data": {"passed": True, "status": "formal_private_media_chain_complete"},
                   "hashes": {"a" * 64}, "references": []}
        self.assertFalse(ledger.receipt_acceptance(receipt, "a" * 64))

    def test_conflicting_identity_cannot_choose_by_filename_or_mtime(self):
        version = {"question_id": "q", "source_version": "version"}
        candidates = {("q", "version"): [
            ("first.json", "a" * 64, {"question": {"type": "single"}}),
            ("newer.json", "b" * 64, {"question": {"type": "fields"}})]}
        self.assertEqual(ledger.resolve_identity(version, candidates, []), version)

    def test_explicit_receipt_binding_resolves_conflicting_packets(self):
        version = {"question_id": "q", "source_version": "version", "receipt": "accepted-receipt.json"}
        candidates = {("q", "version"): [
            ("first.json", "a" * 64, {"question": {"type": "single"}}),
            ("fixed.json", "b" * 64, {"question": {"type": "fields"}})]}
        receipts = [{"path": "accepted-receipt.json", "data": {}, "hashes": {"b" * 64}, "references": [
            {"sha256": "b" * 64, "matches": True}]}]
        resolved = ledger.resolve_identity(version, candidates, receipts)
        self.assertEqual(resolved["path"], "fixed.json")
        self.assertEqual(resolved["sha256"], "b" * 64)


if __name__ == "__main__":
    unittest.main()
