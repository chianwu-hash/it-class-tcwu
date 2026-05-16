# Reward Tree Read-Only Live MVP

## Round 1 - Codex Implementation Brief

User approved starting the read-only MVP while they sleep. Goal: turn the Stage 1 static reward-tree prototype into a safe student-facing MVP that feels like a game reward system without adding database writes.

## Current Scope

Build a live personal reward tree page using existing progress data only.

Hard constraints:

- Read only current student's `student_progress`.
- Do not write to `student_progress`.
- Do not add or deploy SQL.
- Do not add persistent cosmetic preferences yet.
- Do not show other students' data.
- Do not create leaderboard or public share page.
- Unknown activities must not create rewards.
- Keep the existing static `reward-tree.html` prototype available unless there is a clear reason to replace it.

Proposed live page:

- `my-tree.html`
- imports shared auth helpers from `shared/auth.js`
- reads optional own `student_profiles` row for display name/class/seat
- queries only:
  - `student_progress` filtered by current session user id
  - optional own `student_profiles` filtered by current session user id
- renders deterministic leaves and flowers over `assets/reward-tree/empty-tree-base-v1.png`

## Existing Assets / Files

Existing from Stage 1:

- `reward-tree.html`: static mock prototype with 32 leaves and 8 flowers.
- `assets/reward-tree/empty-tree-base-v1.png`: AI-generated empty tree base, no leaves/flowers.

Likely new shared files:

- `shared/reward-tree-config.js`
- `shared/reward-tree-model.js`
- `shared/reward-tree-renderer.js`

Likely new page:

- `my-tree.html`

Do not modify course week pages unless needed for a small link/entry decision. A navbar entry is optional and should be considered separately because the user has not reviewed the live page yet.

## Current Grade 3 Reward Config Draft

Known typing activities:

- week `04`, `typing_task_2`, 5 levels, label `第 4 週 打字闖關`
- week `05`, `typing_task_3`, 5 levels, label `第 5 週 打字闖關`
- week `06`, `typing_task_4`, 5 levels, label `第 6 週 打字闖關`
- week `07`, `typing_task_5`, 5 levels, label `第 7 週 打字闖關`
- week `10`, `typing_task_2`, 2 levels, label `第 10 週 打字闖關`
- week `12`, `typing_task_5`, 5 levels, label `第 12 週 打字闖關`
- week `13`, `typing_task_5`, 5 levels, label `第 13 週 打字闖關`
- week `14`, `typing_task_5`, 5 levels, label `第 14 週 打字闖關`

Known quiz activities:

- week `06`, `safety_quiz_1`, label `第 6 週 資安測驗`
- week `07`, `privacy_quiz_1`, label `第 7 週 個資測驗`
- week `11`, `etiquette_quiz_1`, label `第 11 週 網路禮儀測驗`
- week `12`, `media_literacy_quiz_1`, label `第 12 週 媒體識讀測驗`
- week `13`, `internet_addiction_quiz_1`, label `第 13 週 網路沉迷測驗`
- week `14`, `phishing_safety_quiz_1`, label `第 14 週 資訊素養測驗`

Expected full reward count from this config:

- Typing leaves: 4 + 4 + 4 + 4 + 1 + 4 + 4 + 4 = 29
- Typing flowers: 8
- Quiz leaves: 6
- Total leaves: 35
- Total flowers: 8

Note: earlier estimate was 32 leaves + 8 flowers. The exact config-based count is 35 leaves + 8 flowers because it includes all currently known quiz leaves and the 2-level Week 10 task.

## Reward Derivation Rules

Typing:

- If no row: 0 rewards.
- If `completed === true`: `totalLevels - 1` leaves + 1 flower.
- If not completed: `max(0, min((current_level || 0) - 1, totalLevels - 1))` leaves + 0 flowers.
- In-progress final level but `completed=false` does not earn the flower.

Quiz:

- If `completed === true`: 1 quiz leaf.
- Score does not affect leaf size in MVP.

Unknown:

- Ignore rows not present in the config map.
- Report unknown row count in a developer/debug note only.

## Verification Plan

Required checks before final:

- `rg` confirms `my-tree.html` / reward tree shared modules do not call `.upsert`, `.insert`, `.update`, `.delete`, `.rpc`, or `localStorage` for progress.
- Logged-out Playwright smoke: no data shown, login CTA visible, no console/page errors.
- Mock/unit browser check of reward derivation:
  - no row
  - null current_level
  - in-progress level 1
  - in-progress middle level
  - in-progress final level but completed false
  - completed typing
  - completed quiz
  - unknown activity ignored
- Render smoke with mock rows: exact 35 leaves and 8 flowers.
- Desktop and mobile no horizontal overflow.

## Questions For Claude CLI

Please review this implementation brief before Codex edits the live MVP.

1. Is the Grade 3 config above complete based on current source files?
2. Should the live MVP be `my-tree.html` while keeping `reward-tree.html` as the static prototype?
3. Is it acceptable to read `student_profiles` for own display name, with graceful fallback if the table/RLS fails?
4. Should Codex add a navbar/home link now, or keep the page hidden until the user reviews it?
5. Any implementation risks in splitting config/model/renderer modules for this site?

## Round 2 - Claude CLI Status

Codex attempted direct CLI review:

```text
claude -p --permission-mode dontAsk --output-format text --effort medium ...
```

Result: command timed out after about 184 seconds and did not append a review. Codex checked the session file afterward; no Claude review content was written.

Decision: proceed with the conservative plan from Round 1 because it matches the previously agreed Claude/Codex consensus for Stage 2:

- build `my-tree.html`
- keep `reward-tree.html` as static prototype
- read only current student's own progress/profile
- no SQL
- no writes
- no navbar/home link until the user reviews the live page
- verify with source inspection and Playwright

## Round 3 - Codex Implementation Result

Implemented read-only live MVP.

Files added:

- `my-tree.html`
  - student-facing personal tree page
  - auth gate when logged out
  - local-only mock mode via `?mock=full` on `localhost` / `127.0.0.1`
  - reads current student's own profile and progress after login
  - no formal navbar/home entry added yet
- `shared/reward-tree-config.js`
  - Grade 3 activity whitelist
  - deterministic leaf and flower slots
- `shared/reward-tree-model.js`
  - derives rewards from `student_progress`
  - exports local mock full-completion row helper
- `shared/reward-tree-renderer.js`
  - renders clickable DOM leaves/flowers and ghost slots

Existing files used:

- `assets/reward-tree/empty-tree-base-v1.png`
- `reward-tree.html` remains a static prototype.

Verification completed:

- Source inspection:
  - reward tree files do not call `.upsert`, `.insert`, `.update`, `.delete`, or `.rpc`
  - only `my-tree.html` reads `.from("student_progress")`
- Playwright logged-out smoke:
  - HTTP 200
  - login gate visible
  - 0 real leaves, 0 real flowers
  - 8 ghost leaves, 2 ghost flowers
  - no console/page errors
  - no horizontal overflow
- Playwright local full mock:
  - desktop and mobile HTTP 200
  - 35 real leaves
  - 8 real flowers
  - 8 ghost leaves
  - 2 ghost flowers
  - image loaded
  - no console/page errors
  - no horizontal overflow
- Reward model edge checks:
  - no row => 0 leaves / 0 flowers
  - null `current_level` => 0 leaves / 0 flowers
  - in-progress level 1 => 0 leaves / 0 flowers
  - in-progress middle level 3 of 5 => 2 leaves / 0 flowers
  - in-progress final level 5 of 5 with `completed=false` => 4 leaves / 0 flowers
  - completed typing 5 levels => 4 leaves / 1 flower
  - completed quiz => 1 leaf / 0 flowers
  - unknown row ignored and counted
  - full config => 35 leaves / 8 flowers
- Click smoke:
  - leaf click updates detail panel
  - flower click updates detail panel

Known decisions left for user:

- Whether to add `my-tree.html` to a student-facing navbar/home entry.
- Whether visual density is acceptable at 35 leaves / 8 flowers.
- Whether to keep the current generated tree asset or generate a cleaner asset pack.

## Round 4 - User Feedback For Next Iteration

User reviewed the MVP and requested two changes:

1. Flower colors cannot currently be changed.
2. The tree should draw dashed/ghost leaves for uncompleted levels. Clicking those leaves should take the student directly to the relevant challenge page.

Codex intended implementation direction:

- Keep the feature read-only with respect to Supabase.
- Add flower palette controls unlocked at 3+ flowers.
- Save palette only in `sessionStorage` or keep it in-memory; do not write SQL.
- Extend the reward model to include future/unearned reward opportunities from the config map:
  - earned leaves/flowers render as solid rewards
  - unearned typing regular levels render as dashed leaves
  - unearned quiz completions render as dashed quiz leaves
  - unearned boss flowers may remain dashed flowers or can be omitted if visual density becomes too much
- Add `href` / target information to each configured activity:
  - typing regular levels can link to `/grade3/weekXX.html#block-levelN`
  - quiz leaves can link to `/grade3/weekXX.html#quiz-lock` or the week page if no stable quiz section id exists
  - boss flower can link to `/grade3/weekXX.html#block-level{totalLevels}`
- Clicking a dashed unearned reward should navigate, while clicking an earned reward should show details.

Questions for Claude CLI:

1. Should unearned boss flowers be shown as dashed flowers, or should only unearned leaves be shown to match the user request?
2. Is `sessionStorage` acceptable for flower palette selection in this no-SQL stage?
3. Is linking typing ghosts to `#block-levelN` safe across current Grade 3 pages?
4. For quiz ghosts, what is the safest anchor target based on current page markup?
5. Any risk that showing all future dashed leaves makes the tree too crowded or discouraging?

## Round 5 - Claude CLI Review

Claude CLI could not append directly because its file-writing tools were blocked by the current permission mode. It returned this review content in the terminal; Codex is recording it here.

1. Unearned boss flowers:
   - Show dashed boss flowers.
   - The boss flower is the clearest goal for completing a typing sequence.
   - Keep it visually distinct from leaf ghosts.
   - If visual density is too high later, suppressing it with a config flag is easy.

2. Flower palette:
   - `sessionStorage` is acceptable in the no-SQL stage.
   - It avoids database writes.
   - It resets on tab close, which is acceptable for this prototype/MVP stage.
   - Avoid `localStorage` to keep cosmetic state clearly separate from project progress rules.

3. Typing anchors:
   - `#block-levelN` is safe across current Grade 3 typing weeks.
   - Caveat: locked levels may still be hidden after navigation, but the student lands on the correct week page and the page handles unlock state.

4. Quiz anchors:
   - Use `#quiz-lock`.
   - This is the consistent anchor across quiz weeks.

5. Visual density:
   - Showing all 35 dashed leaves and 8 dashed flowers for a new student is likely too discouraging.
   - Preferred mitigation: only show reachable/currently visible week ghosts if week visibility is available.
   - Simpler MVP mitigation: cap ghost display to the next 5-8 unearned items beyond the student's current progress frontier.

## Round 6 - Codex Implementation Result

Implemented the two requested changes.

Changes:

- Flower palette switching:
  - Added 4 flower palette buttons to `my-tree.html`.
  - Palette controls unlock only when the model has 3 or more earned flowers.
  - Palette choice uses `sessionStorage` only.
  - No Supabase write path added.
- Dashed unearned rewards:
  - `shared/reward-tree-model.js` now derives both earned rewards and pending rewards.
  - Pending typing levels render as dashed leaves.
  - Pending quizzes render as dashed quiz leaves.
  - Pending boss levels render as dashed flowers.
  - Dashed rewards contain direct links:
    - typing leaf: `/grade3/weekXX.html#block-levelN`
    - boss flower: `/grade3/weekXX.html#block-level{totalLevels}`
    - quiz leaf: `/grade3/weekXX.html#quiz-lock`
  - Renderer caps visible pending rewards to the next 8 leaves and next 2 flowers to avoid overwhelming new students.
- Local mock modes:
  - `?mock=full` shows full completion.
  - `?mock=empty` shows only pending dashed rewards.
  - `?mock=partial` shows partial earned rewards plus pending links.

Verification:

- Claude CLI review completed in terminal after a longer wait; Codex copied the content into Round 5.
- `rg` confirmed:
  - no `.upsert`, `.insert`, `.update`, `.delete`, `.rpc` in reward tree files
  - no `localStorage` in reward tree files
  - only `sessionStorage` is used for flower palette
  - only `my-tree.html` reads `.from("student_progress")`
- Source check confirmed current Grade 3 pages use:
  - `block-levelN` anchors on typing weeks
  - `quiz-lock` anchors on quiz weeks
- Playwright desktop checks:
  - logged out: 0 earned leaves, 0 flowers, 8 pending leaves, 2 pending flowers, palette disabled, no errors
  - `?mock=empty`: 0 earned leaves, 0 flowers, 8 pending leaves, 2 pending flowers, first link `/grade3/week04.html#block-level1`
  - `?mock=partial`: 2 earned leaves, first pending leaf links to `/grade3/week04.html#block-level3`
  - `?mock=full`: 35 earned leaves, 8 flowers, 0 pending leaves, 0 pending flowers, palette enabled
- Flower palette click smoke:
  - selecting `forest` updates CSS variables and pressed state
- Mobile checks:
  - `?mock=empty` and `?mock=full` have no horizontal overflow
  - no console/page errors

## Round 7 - Codex Entry Points

User decided the feature should be officially named `努力樹` for now, because the tree does not grow larger yet; it only gains leaves and flowers.

Implemented entry points:

- Added `努力樹` link to Grade 3 navbar via `grade3/navbar.js`.
- Added optional `extraLinks` support to `shared/course-navbar.js`, defaulting to empty so Grade 6 is unaffected.
- Added a `我的努力樹` card to `grade3/index.html`, linking to `/my-tree.html`.
- Updated Grade 3 `navbar.js` version strings from `20260512` to `20260516` on Grade 3 pages so the navbar change is not hidden by browser cache.

Verification:

- `grade3/index.html` desktop/mobile:
  - navbar contains one `/my-tree.html` `努力樹` link
  - homepage contains one `/my-tree.html` card
  - no page errors
  - no horizontal overflow
- `grade3/week14.html` desktop:
  - navbar contains one `/my-tree.html` `努力樹` link
  - auth login button still exists
  - no page errors
  - no horizontal overflow
- `grade6/week13.html` desktop:
  - no `/my-tree.html` link
  - no page errors
  - no horizontal overflow
- Fixed a navbar wrapping issue caused by the additional link by allowing the shared navbar link row to wrap on large screens.

## Round 8 - Flower Image Assets

User requested replacing the CSS flower with more attractive image-generated flower assets, with multiple colors/patterns available for palette switching.

Implementation:

- Used built-in `image_gen` mode, not CLI fallback.
- Generated individual flower sprites on flat chroma-key backgrounds.
- Removed chroma-key backgrounds with the installed imagegen helper.
- Resized final transparent PNG assets to 512x512 and optimized them for web use.
- Added final assets:
  - `assets/reward-tree/flowers/flower-sunrise.png`
  - `assets/reward-tree/flowers/flower-ocean.png`
  - `assets/reward-tree/flowers/flower-candy.png`
  - `assets/reward-tree/flowers/flower-forest.png`
- Updated `my-tree.html`:
  - earned flowers now use `background-image: var(--flower-image)` instead of CSS radial gradients
  - palette buttons now switch the image asset
  - swatches and legend use the new flower images
  - ghost flowers remain dashed outlines

Validation:

- All final flower assets are RGBA PNGs.
- All final flower assets are 512x512.
- Corner alpha values are 0 for all final flower assets.
- Asset sizes are about 268KB-302KB each.
- Playwright smoke:
  - `?mock=full` desktop: 35 leaves, 8 flowers, flower PNG loaded, palette switching works, no errors, no horizontal overflow
  - `?mock=empty` desktop: 0 earned flowers, 2 dashed ghost flowers, ghost flowers do not use PNG background
  - `?mock=full` mobile: no errors, no horizontal overflow
