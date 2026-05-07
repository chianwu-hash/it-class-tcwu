# Changelog

## Unreleased

- Standardized the workflow module on Bloom-only distribution as the default question-bank planning and review axis.
- Updated Wayground import metadata parsing to ignore `分配檢查` lines.
- Simplified `TEXTBOOK_TO_BANK_SOP.md` into a five-step flow: preprocessing summary, blueprint/coverage table, local bank generation, merged local review, and external review plus Wayground publishing.
- Clarified that local review should merge format, coverage, item validity, distractor quality, style alignment, and question-group checks before Gemini/Claude review.
- Added `PREP_BEFORE_QUESTION_BANK_SOP.md` for preparing curriculum references, textbook mappings, teaching goals, and question scope before generating a bank.
- Updated end-to-end flow, deployment prompt, and deployment checklist to require teaching-goal coverage checks before Wayground import.
- Fixed Wayground Markdown import parsing so per-question metadata such as `難易度`, `難度`, `Bloom`, `依據`, separators, and trailing distribution checks are not appended to question stems.
- Added `CDP_URL` environment variable support to browser, Wayground inspect, and Gemini review/capture scripts while keeping `http://127.0.0.1:9222` as the default endpoint.
- Documented non-default CDP port usage in README, deployment checklist, and troubleshooting notes.
- Documented module boundaries for separating reusable workflow code from project-specific question-bank outputs.
- Added project workspace template for textbooks, question banks, review outputs, and Wayground publish records.
- Added Ubuntu / macOS / WSL install script alongside the Windows PowerShell installer.
- Added portability dry-run documentation.
- Added standalone repo export script and standalone `.gitignore` template.
