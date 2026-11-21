import importlib.util
import json
from tempfile import TemporaryDirectory
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

    def test_isolated_readback_binds_candidate_id_and_both_snapshot_hashes(self):
        with TemporaryDirectory() as folder:
            root = Path(folder)
            candidate, schema, functions, proof = [root / name for name in
                                                    ("candidate.json", "schema.json", "functions.sql", "proof.json")]
            candidate.write_text(json.dumps({"pool": [{"question_id": "q", "question": {"type": "fields"}},
                                                       {"question_id": "other", "question": {"type": "fields"}}]}),
                                 encoding="utf-8")
            schema.write_text("{}", encoding="utf-8")
            functions.write_text("select 1", encoding="utf-8")
            candidate_sha = ledger.digest(candidate)
            proof.write_text(json.dumps({
                "schema": "quiz-isolated-equivalent-readback/v1",
                "snapshot_sha256": ledger.digest(schema), "functions_sha256": ledger.digest(functions),
                "sources": 1, "passed": 1, "results": [
                    {"source": "s", "question_id": "q", "candidate_sha256": candidate_sha, "passed": True}]}),
                encoding="utf-8")
            inventory = {"records": [
                {"source_parent_id": source, "versions": [
                    {"question_id": question, "path": str(candidate), "sha256": candidate_sha}]}
                for source, question in (("s", "q"), ("other_source", "other"))]}
            readbacks = ledger.equivalent_readback_index([proof], schema, functions)
            result = ledger.build(inventory, [], equivalent_readbacks=readbacks)
            self.assertEqual(result["summary"]["isolated_equivalent_readback_verified"], 1)
            self.assertEqual(result["summary"]["release_ready"], 0)
            self.assertIsNone(result["records"][1]["isolated_equivalent_readback"])
            functions.write_text("select 2", encoding="utf-8")
            with self.assertRaises(ValueError):
                ledger.equivalent_readback_index([proof], schema, functions)


if __name__ == "__main__":
    unittest.main()
