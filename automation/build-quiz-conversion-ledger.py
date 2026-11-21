"""Index existing evidence without converting questions or inferring acceptance.

Inputs and output contain private data and must stay outside the repository.
Only a receipt bound to the exact candidate SHA can establish data acceptance.
Recorded UI evidence is separate from its validity against current code.
"""
import argparse
from collections import Counter
from datetime import datetime, timezone
from hashlib import sha256
import json
from pathlib import Path
import re


def read(path):
    return json.loads(Path(path).read_text(encoding="utf-8-sig"))


def digest(path):
    return sha256(Path(path).read_bytes()).hexdigest()


def hashes(value):
    if isinstance(value, dict):
        return set().union(set(), *(hashes(v) for v in value.values()))
    if isinstance(value, list):
        return set().union(set(), *(hashes(v) for v in value))
    return {value.lower()} if isinstance(value, str) and re.fullmatch(r"[a-fA-F0-9]{64}", value) else set()


def references(receipt):
    """Only explicit evidence/proof filename-to-hash bindings, not arbitrary prose."""
    result = []
    for section in ("evidence", "proofs", "current_verified_receipts", "receipts", "proof_sha256"):
        values = receipt.get(section, {})
        if not isinstance(values, dict):
            continue
        for name, value in values.items():
            expected = value.get("sha256") if isinstance(value, dict) else value
            if isinstance(expected, str) and re.fullmatch(r"[a-fA-F0-9]{64}", expected):
                result.append((name, expected.lower()))
    return result


def receipt_index(roots):
    result = []
    for root in roots:
        for path in sorted(Path(root).glob("*receipt*.json")):
            try:
                data = read(path)
                if not isinstance(data, dict):
                    continue
                refs = []
                for name, expected in references(data):
                    target = Path(name) if Path(name).is_absolute() else path.parent / name
                    exists = target.is_file()
                    matched = exists and digest(target) == expected
                    proof = read(target) if matched and target.suffix == ".json" else {}
                    refs.append({"path": str(target), "sha256": expected, "matches": matched,
                                 "passed": proof.get("passed") if isinstance(proof, dict) else None})
                result.append({"path": str(path), "sha256": digest(path), "data": data,
                               "hashes": hashes(data), "references": refs})
            except (OSError, ValueError, TypeError):
                # An unreadable receipt is not successful evidence.
                continue
    return result


def receipt_acceptance(receipt, candidate_sha):
    data, refs = receipt["data"], receipt["references"]
    if candidate_sha not in receipt["hashes"] or data.get("passed") is not True:
        return False
    status = data.get("status", "")
    if not ("isolated" in status and ("complete" in status or "passed" in status)):
        return False
    if any(not r["matches"] for r in refs):
        return False
    source = any(re.search(r"(?:source|data)-proof", r["path"]) and r["passed"] is True for r in refs)
    native = any("native-proof" in r["path"] and r["passed"] is True for r in refs)
    return source and native


def classify(question):
    """Describe the existing candidate contract; never guess unconverted source roles."""
    if not question:
        return None
    work = question.get("work", {})
    if work:
        # Sketch work is not sufficient to distinguish vertical work from drawing.
        return "expression" if work.get("input") == "expression" else None
    if question.get("type") in ("single", "multiple", "boolean"):
        return "choice"
    fields = question.get("fields", [])
    if fields and all(f.get("input") == "math" for f in fields):
        return "number-units"
    return None


def candidate_index(roots):
    result = {}
    for root in roots:
        for path in sorted(Path(root).glob("*candidate*.json")):
            try:
                packet = read(path)
                pool = packet.get("pool", []) if isinstance(packet, dict) else packet
                if not isinstance(pool, list):
                    continue
                file_sha = digest(path)
                for row in pool:
                    if not isinstance(row, dict) or not isinstance(row.get("question"), dict):
                        continue
                    key = (row.get("question_id"), row.get("source_version"))
                    result.setdefault(key, []).append((str(path), file_sha, row))
            except (OSError, ValueError, TypeError):
                continue
    return result


def resolve_identity(version, candidates, receipts):
    options = candidates.get((version.get("question_id"), version.get("source_version")), [])
    if not options:
        return version
    declared = {version.get(key) for key in ("receipt", "acceptance_receipt") if version.get(key)}
    bound = []
    for option in options:
        if any(Path(receipt["path"]).name in declared and any(
                ref["sha256"] == option[1] and ref["matches"] for ref in receipt["references"])
               for receipt in receipts):
            bound.append(option)
    if bound:
        options = bound
    contents = {json.dumps({k: row.get(k) for k in ("question", "study", "source_item_id")},
                           sort_keys=True, ensure_ascii=False) for _, _, row in options}
    if len(contents) != 1:
        return version
    # Equivalent duplicate packets are safe; prefer one with a valid bound receipt.
    options.sort(key=lambda option: not any(receipt_acceptance(r, option[1]) for r in receipts))
    path, file_sha, _ = options[0]
    return {**version, "path": path, "sha256": file_sha,
            "binding_resolution": "unique_question_and_source_version_with_equal_content"}


def build(inventory, receipts, candidates=None):
    records, seen, candidate_cache = [], set(), {}
    for source in inventory["records"]:
        sid = source["source_parent_id"]
        if sid in seen:
            raise ValueError("Duplicate source parent in inventory")
        seen.add(sid)
        versions = source.get("versions", [])
        latest = versions[-1] if versions else None
        if latest and "path" not in latest:
            latest = resolve_identity(latest, candidates or {}, receipts)
        row = {"source_parent_id": sid, "candidate": latest, "candidate_status": "absent",
               "rule_id": None, "rule_status": "unknown", "data_acceptance": "unknown",
               "behavior_evidence_key": None, "behavior_reuse": "unknown",
               "media": "unknown", "formal_oauth": "unknown", "activation": "unknown",
               "recorded_activation_by_this_run": source.get("production_enabled_by_this_run"),
               "exception": source.get("exception"), "evidence": [], "historical_evidence": []}
        if latest and "path" not in latest:
            # Some historical inventory entries only record question_id/source_version.
            # Keep the identity instead of inventing a candidate-file SHA binding.
            row["candidate_status"] = "identity_only_missing_file_binding"
        elif latest:
            path = Path(latest["path"])
            if str(path) not in candidate_cache:
                if path.is_file():
                    packet = read(path)
                    pool = packet.get("pool", []) if isinstance(packet, dict) else packet
                    candidate_cache[str(path)] = (digest(path), {r["question_id"]: r for r in pool})
                else:
                    candidate_cache[str(path)] = (None, {})
            actual_sha, pool = candidate_cache[str(path)]
            candidate = pool.get(latest["question_id"])
            exact = actual_sha == latest["sha256"] and candidate is not None
            row["candidate_status"] = "exact_sha" if exact else "missing_or_changed"
            if exact:
                row["rule_id"] = classify(candidate.get("question", {}))
                row["rule_status"] = "candidate_contract_only" if row["rule_id"] else "unknown"
                for receipt in receipts:
                    if actual_sha not in receipt["hashes"]:
                        continue
                    item = {k: receipt[k] for k in ("path", "sha256", "references")}
                    row["historical_evidence"].append(item)
                    if receipt_acceptance(receipt, actual_sha):
                        row["data_acceptance"] = "exact_receipt_verified"
                        row["evidence"].append(item)
                        data = receipt["data"]
                        if "media_complete" in data.get("status", ""):
                            row["media"] = "complete_in_bound_receipt"
                        if data.get("real_student_oauth") is False or data.get("real_oauth_verified") is False:
                            row["formal_oauth"] = "not_verified_in_bound_receipt"
        records.append(row)
    summary = {"universe": len(records), "with_candidate": sum(bool(r["candidate"]) for r in records),
               "exact_candidate": sum(r["candidate_status"] == "exact_sha" for r in records),
               "data_receipt_verified": sum(r["data_acceptance"] == "exact_receipt_verified" for r in records),
               "release_ready": sum(r["data_acceptance"] == "exact_receipt_verified"
                                    and r["behavior_reuse"] == "verified_current"
                                    and r["media"] in ("verified_current", "not_required")
                                    and r["formal_oauth"] == "verified_current" for r in records),
               "by_rule_and_data_status": dict(Counter(
                   (r["rule_id"] or "unknown") + ":" + r["data_acceptance"] for r in records))}
    return {"schema": "quiz-conversion-evidence-ledger/v1", "generated_at": datetime.now(timezone.utc).isoformat(),
            "scope_note": "Receipt relinking only. Unknown does not invalidate historical acceptance. Candidate contract labels are not original-role classification. No source activation or deployment is inferred.",
            "summary": summary, "records": records}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--inventory", required=True)
    parser.add_argument("--receipt-root", action="append", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    output = Path(args.output).resolve()
    repo = Path(__file__).resolve().parents[1]
    if output.is_relative_to(repo):
        raise ValueError("Private ledger output must be outside the repository")
    receipts = receipt_index(args.receipt_root)
    ledger = build(read(args.inventory), receipts, candidate_index(args.receipt_root))
    ledger["inventory_sha256"] = digest(args.inventory)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(ledger, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(ledger["summary"], ensure_ascii=True))


if __name__ == "__main__":
    main()
