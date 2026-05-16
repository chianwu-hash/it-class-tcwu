# Reward Tree Game System Plan

## Round 1 - Codex

Goal: turn the user's reward-tree idea into a feasible implementation plan, then ask Claude CLI to review how to make it feel as much like a game reward system as possible while staying within the current site's safety constraints.

User concept:

- Each student has a personal tree.
- Students can only see their own tree.
- Completing regular work grows leaves.
- Completing the weekly final typing level, treated as a boss level, grows a flower.
- Quiz completion also grows a leaf.
- Students with 3 or more flowers can change flower colors.
- The visual result must be attractive enough to motivate elementary students.

## Current Feasibility Baseline

Existing data source:

- `student_progress`
  - `user_id`
  - `week_code`
  - `activity_key`
  - `current_level`
  - `completed`
  - `score`
  - `updated_at`

Existing auth path:

- Student pages can import `supabase`, `resolveSession`, and related helpers from `shared/auth.js`.
- RLS already lets students read their own `student_progress`.
- A personal reward page can query only `auth.uid()` / current session user rows.

Important typing semantics confirmed from `shared/typing-challenge.js`:

- `current_level` is the highest unlocked/current level.
- If `completed = false`, completed typing levels are `current_level - 1`.
- If `completed = true`, all levels in that typing activity are complete.
- The final level becomes a flower only when the typing activity row is `completed = true`.

## Reward Rules

### Typing Activities

For each typing activity:

- Total level count comes from a local config map first.
- Fallback can parse `typing_task_N`, but the config map is safer because some historical keys do not match actual totals.

Reward derivation:

- If no row exists: no rewards.
- If row exists and `completed = false`:
  - leaves = `max(0, min(current_level - 1, total_levels - 1))`
  - flowers = `0`
- If row exists and `completed = true`:
  - leaves = `total_levels - 1`
  - flowers = `1`

### Quiz Activities

For each quiz activity:

- If a quiz progress row exists and `completed = true`: `1` leaf.
- Quiz does not create flowers.
- Quiz leaf size can optionally reflect score:
  - high score: medium/large leaf
  - normal completion: small/medium leaf
  - first version can keep all quiz leaves the same size to avoid confusing students.

### Estimated Full-Completion Reward Count

Current Grade 3 estimate through Week 14:

- Typing general leaves: about `26`
- Boss flowers: about `8`
- Quiz leaves: about `6`
- Total: about `32` leaves and `8` flowers

Likely full semester:

- about `35-40` leaves
- about `8-10` flowers

This is visually feasible if every leaf/flower is a placed asset, not AI-drawn whole-tree foliage.

## Visual Strategy

AI image generation should be used for asset style exploration, not for final reward counts.

Final implementation should compose deterministic assets:

1. Empty tree base image
   - trunk and branches only
   - no countable leaves
   - no flowers
   - optional soft canopy glow, but no individual leaf shapes
2. Leaf assets
   - small, medium, large
   - 2-3 green variants
   - transparent PNG/WebP
3. Flower assets
   - one base flower shape
   - 6-8 color variants
   - transparent PNG/WebP
4. Optional effects
   - sparkle PNG or CSS particle
   - soft glow behind flowers
   - unlock badge/modal

Reason:

- AI cannot reliably draw exactly 32 leaves and 8 flowers.
- JavaScript can place exactly the right number of leaves and flowers.
- Students will trust the page more if the visible reward count matches their actual progress.

## Game-Like MVP

Target: a stable, classroom-ready 7.5/10 game reward experience.

Page proposal:

- `my-tree.html` or `reward-tree.html`
- Accessible from navbar/admin? Student-facing entry should be visible after login.

Core behavior:

1. Not logged in:
   - show login prompt
   - no tree data shown
2. Logged in:
   - load only the current student's `student_progress`
   - derive leaves and flowers
   - render the personal tree
3. Rewards:
   - typing regular levels create leaves
   - typing final/boss completion creates flowers
   - quizzes create leaves
4. Interactions:
   - click/tap leaf or flower to show a small detail popover:
     - week
     - activity label
     - reward reason
     - completion/update time
   - show summary counters:
     - leaves
     - flowers
     - next unlock
5. Unlock:
   - 3+ flowers unlock flower color selection
   - First version can apply color choice immediately in the session.

Recommended persistence options:

Option A: No new write table in MVP.

- Flower color choice is derived or temporary.
- Lowest risk.
- Less game-like because customization is not saved.

Option B: Add a tiny cosmetic preference table.

- Table: `student_tree_preferences`
- Fields:
  - `user_id uuid primary key references auth.users(id) on delete cascade`
  - `flower_palette text`
  - `updated_at timestamptz`
- RLS:
  - students can select only their own row
  - students can insert/update only their own row
- This does not store progress and does not affect `student_progress`.
- More game-like because unlock/customization persists across devices.

Codex recommendation:

- Build MVP with Option A if speed and minimal risk are the priority.
- Use Option B if the user wants the flower color unlock to feel real and persistent.

## Implementation Architecture

### Files

Likely new files:

- `reward-tree.html`
- `shared/reward-tree.js`
- `shared/reward-tree-config.js`
- `shared/reward-tree-renderer.js`
- `assets/reward-tree/...` or `shared/assets/reward-tree/...`

Possible SQL only if persistent cosmetic choices are approved:

- `supabase/student_tree_preferences.sql`

### Data Flow

1. Resolve current session.
2. If no session, show login gate.
3. Query:

   ```js
   supabase
     .from("student_progress")
     .select("week_code, activity_key, current_level, completed, score, updated_at")
     .eq("user_id", session.user.id)
   ```

4. Derive reward model from config.
5. Render tree from deterministic slot tables.

### Slot-Based Rendering

Use fixed reward slots to keep the tree attractive and countable.

Leaf slots:

- Prepare 40-45 slot positions.
- Each slot stores:
  - x/y percentage
  - rotation
  - scale
  - preferred size
  - branch region

Flower slots:

- Prepare 10-12 slot positions.
- Spread across main branches.
- Keep flowers visually special and not hidden.

Rendering:

- Use HTML/CSS absolute-positioned `img` elements over the empty tree image, or a Canvas renderer.
- Recommended first version: HTML/CSS positioned elements.

Why HTML/CSS first:

- Easier to make each leaf/flower clickable.
- Easier responsive behavior.
- Easier accessibility labels.
- Easier debugging than Canvas.
- Still visually strong if the PNG assets are beautiful.

Canvas can be a later polish layer if needed.

## Game Feel Features Within Current Capability

High value, feasible:

- Smooth leaf pop-in animation on page load.
- Flower bloom animation for flowers.
- Soft glow around unlocked flowers.
- Summary panel:
  - "Leaves collected"
  - "Boss flowers"
  - "Next color unlock"
- Clickable reward details.
- Empty slots shown as tiny buds or soft branch glows.
- Seasonal or celebratory background when many flowers are collected.

Use carefully:

- Sound effects: optional and muted by default.
- Confetti: use only on newly unlocked reward if we can detect "new"; otherwise avoid noisy replay on every page load.
- Large animated particles: keep light for classroom machines.

Avoid in first version:

- Class leaderboard.
- Seeing other students' trees.
- Complex item shop.
- Heavy Canvas-only hit testing.
- Writing back derived rewards to the database.
- Any localStorage progress logic.

## Privacy and Safety

Hard requirements:

- Students can only query their own progress.
- No class list shown.
- No rankings.
- No public share page in MVP.
- The tree page must not write to `student_progress`.
- Cosmetic preferences must never affect progress, teacher admin, or unlock correctness.

## Risks

1. Reward derivation could misread `current_level`.
   - Mitigation: use the confirmed typing semantics above.
2. Historical activity totals may not match `typing_task_N`.
   - Mitigation: central config map for known week/activity totals.
3. AI-generated full-tree art could imply false reward counts.
   - Mitigation: empty tree + deterministic placed assets.
4. Too many animations could distract or slow devices.
   - Mitigation: CSS-only, low intensity, respect reduced motion.
5. Flower color customization may require new persistence.
   - Mitigation: keep optional and isolated from progress.
6. Students could compare rewards socially.
   - Mitigation: private page, no leaderboard, no other-student access.

## Proposed Delivery Stages

### Stage 1: Static Prototype

- Use sample/mock reward data.
- Render empty tree + about 32 leaves + 8 flowers.
- Validate visual density and responsive layout.

### Stage 2: Read-Only Live MVP

- Query current student's `student_progress`.
- Derive reward model.
- Render real leaves/flowers.
- No new SQL.
- No saved customization.

### Stage 3: Game Polish

- Add click details.
- Add better animations.
- Add unlock summary.
- Add flower color UI, temporary or persisted.

### Stage 4: Optional Cosmetic Persistence

- Add `student_tree_preferences`.
- Save flower palette only after 3+ flowers.
- Keep strict own-row RLS.

## Questions for Claude CLI

Please review this plan for feasibility and game-system quality.

1. Is HTML/CSS positioned PNG composition the best first implementation, or should we use Canvas from the start?
2. Is Option B (`student_tree_preferences`) worth adding early to make the flower color unlock feel real?
3. Is the reward derivation from `current_level` and `completed` correct and safe?
4. Should quiz leaves reflect score, or should first version keep quiz leaves visually equal?
5. What is the best way to make the MVP feel like a game without adding risky persistence or leaderboard features?
6. What verification checklist would you require before showing this to students?

## Round 2 - Claude CLI Review

Claude CLI verdict: feasible, proceed.

Main conclusions:

1. The data foundation is strong enough.
   - `student_progress` contains enough information to derive rewards deterministically.
   - RLS already supports own-progress reads.
   - The largest trust risk is not auth or rendering; it is incorrect reward counts.

2. Use HTML/CSS positioned PNG assets first.
   - Reward leaves and flowers should be individual clickable DOM elements.
   - Canvas should not be used for rewards in MVP because hit testing, accessibility, and responsive layout become harder.
   - Canvas can be added later only as an ambient particle/glow overlay behind the tree.

3. Do not apply `student_tree_preferences` in the first classroom MVP.
   - Flower color persistence is a good eventual game hook.
   - But a new write path should wait until the read-only reward derivation is tested with real student data.
   - The SQL can be drafted early, but should not be deployed until after Stage 2 is proven.

4. Reward derivation is correct with explicit guards.
   - For in-progress typing rows:
     - leaves = `max(0, min(current_level - 1, total_levels - 1))`
     - flowers = `0`
   - For completed typing rows:
     - leaves = `total_levels - 1`
     - flowers = `1`
   - Guard `current_level` null/undefined as 0.
   - If `total_levels` is missing from the config map, skip the activity and log a warning.
   - Claude recommends not falling back to parsing `typing_task_N` in the live renderer; unknown config should be made visible during development.

5. Quiz leaves should not reflect score in MVP.
   - A quiz leaf means completion.
   - Score-based leaf sizing could create anxiety and comparison pressure.

6. MVP game-feel must-haves:
   - Staggered leaf/flower pop-in on load.
   - Special flower bloom animation.
   - Ghost slots / bud outlines for future rewards.
   - Summary panel with leaf count, flower count, and next unlock target.
   - Personal ownership header using the student's display name if available.

7. Later polish:
   - Click/tap reward details.
   - New-reward celebration only when a reward is newly earned since the last tree view.
   - Use `sessionStorage` for last-view detection, not `localStorage`.
   - Avoid sound effects and leaderboards.

## Round 3 - Codex Consensus

Codex agrees with Claude CLI's review.

### Final Agreed Direction

The most game-like feasible plan under current constraints is:

1. Build a deterministic reward tree, not an AI-drawn full tree.
2. Use AI/art tools only for attractive assets:
   - empty tree
   - leaves
   - flowers
   - glows/sparkles
3. Compose rewards with HTML/CSS positioned elements.
4. Keep Stage 2 read-only:
   - query only the current student's `student_progress`
   - derive leaves/flowers in JS
   - do not write to `student_progress`
   - do not add cosmetic preference writes yet
5. Require a complete reward config map before any live student release.
6. Treat exact reward count as the core correctness requirement.

### Recommended Stage Plan

#### Stage 1: Static Game Prototype

Deliverable:

- `reward-tree.html` or prototype file
- mock reward model with about 32 leaves and 8 flowers
- empty tree asset
- leaf and flower assets
- fixed slot table
- staggered pop-in
- flower bloom
- ghost slots
- summary panel

Purpose:

- Validate whether the tree feels rewarding before connecting data.
- Validate density and responsive layout.

#### Stage 2: Read-Only Live MVP

Deliverable:

- current-student auth gate
- own `student_progress` query
- central reward config map
- deterministic reward derivation
- no new SQL writes
- no preference persistence

Hard gate:

- Config map must include all active typing and quiz activities that the tree recognizes.
- Unknown config entries must not silently generate rewards.

#### Stage 3: Game Polish

Deliverable:

- click/tap reward details
- personal name header from profile/email fallback
- better animation timing
- new-reward celebration based on `sessionStorage`
- no sound by default

#### Stage 4: Persistent Cosmetic Unlocks

Deliverable:

- optional `student_tree_preferences.sql`
- flower color palette persistence
- own-row RLS
- only after Stage 2 reward counts are proven correct with real data

### Verification Checklist

Before first student use:

1. Logged-out state shows no data.
2. Student A cannot fetch Student B progress.
3. Reward derivation unit tests cover:
   - no row
   - `current_level` null
   - in-progress level 1
   - in-progress middle level
   - in-progress final level but `completed=false`
   - completed row
   - unknown activity config
4. Known student spot-check:
   - manually count database rows
   - confirm exact visible leaves and flowers
5. Flower color unlock:
   - 2 flowers: locked
   - 3 flowers: unlocked
6. `rg` confirms tree code does not write to `student_progress`.
7. Reduced motion disables pop/bloom animations.
8. Tablet/mobile layout has no horizontal scroll.
9. Empty tree state is encouraging, not blank.
10. Unknown config is visible to developers and does not create misleading rewards.

### Open Product Decisions

These do not block Stage 1:

1. Page name:
   - `reward-tree.html`
   - `my-tree.html`
   - `growth-tree.html`
2. Whether Stage 1 prototype should be inside the real site navigation or hidden until approved.
3. Whether to use current generated tree concept as style reference or generate a cleaner empty-tree asset set.
4. Exact wording for the student-facing page title and summary.
5. Whether flower color unlock should be temporary in Stage 3 or wait for persistent preferences in Stage 4.
