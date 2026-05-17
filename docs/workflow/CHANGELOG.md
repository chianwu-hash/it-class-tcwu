# Changelog

## Unreleased

- Added blueprint-stage visual routing rules for no visual, table, auxiliary figure, and required figure question types.
- Documented Wayground table support: HTML tables with inline styles work, while Markdown tables must be converted by `wayground:import`.
- Documented the math/science figure workflow: figure spec, structural sketch, imagegen redraw, Cloudinary upload, Wayground media validation, and visual-semantic review.
- Updated subject routing so formula-only math can use Wayground AI while math questions with `圖片：https://...` use direct import to preserve verified media.
- Added automated `wayground:check` media/table mismatch reporting and a `figure:validate-manifest` gate for local figure files, Cloudinary URLs, labels, and basic numeric checks.
- Updated Gemini and Claude review prompt templates so visual/table issues are reviewed before Wayground import/publish.
- Documented the visual review sheet format and the initial policy that Gemini/Claude CLI visual review may reduce, but not yet eliminate, the human visual gate.
- Clarified image-generation tool routing: precise math/science diagrams default to Codex built-in `imagegen`; ChatGPT browser image workflow is not the default for answer-critical diagrams.
- Promoted math/science figure structure drafting from recommendation to hard gate: high-risk geometry, solid, net, composite, cut, and hollow figures must have a recorded `structureDraft` before imagegen, and review must check whether the geometric object itself is valid.
- Required Gemini second review and Claude third review before any formal Wayground publishing, with CLI-first review and Chrome CDP fallback only after CLI timeout or failure.
- Clarified that review findings must be synthesized and resolved in the local bank before entering Wayground.
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
