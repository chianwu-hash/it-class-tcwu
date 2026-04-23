# Chat Mode Skill

This file defines the shared chat-mode protocol for Codex and Claude Code.

The goal is to let two agents collaborate through `agent-sync-state.json` and a per-session markdown file without asking the user to manually relay every step.

## Priority Rule

In chat-mode, polling is the primary responsibility after each round.

A round is not complete until:

1. Round content is written to the session file at `session_file`
2. `agent-sync-state.json` is updated
3. ScheduleWakeup has been scheduled
4. the first scheduled poll has actually executed
5. state and session file have been re-read after that poll

Do not send a final or completion-style user message before step 4.
If round content is written but polling has not started, the turn is still incomplete.

## Activation Checklist

Activation must show the mirrored prompt before any long-running work, then continue in the same response when the receiving agent is the first mover.

Before starting a chat-mode session:

1. Parse mode, turn/time limit, first mover, and topic.
2. Generate the mirrored start line and display it to the user before writing round content.
3. Write `agent-sync-state.json` with session parameters, including `session_file`.
4. Create the session file skeleton at `docs/development/sessions/YYYY-MM-DD-{slug}.md`.
5. If this agent is the first mover, begin round 1 immediately in the same response.
6. After round 1, schedule ScheduleWakeup and the first in-turn recheck using polling defaults.

If this agent is not the first mover, end after prompt/setup. The other agent writes round 1 after receiving the mirrored prompt.

Do not proceed if any step cannot be completed.

## 1. Purpose

Chat mode is for bounded agent-to-agent collaboration.

Use it when the user asks Codex and Claude Code to discuss, review, or refine a specific topic together for a fixed number of turns or a fixed time window.

Chat mode is not for:

- unbounded discussion
- replacing user decisions
- hiding uncertainty
- making code changes without clear task ownership

## 2. Trigger Contract

The receiving agent must parse:

- topic
- mode: `turn-based`, `timed`, or `hybrid`
- turn limit or time limit
- first mover

If the request has no limit, do not start. Ask one short clarification:

```text
Use a time limit or a turn limit?
```

If the request is clear, continue with the mirrored-start rule.

## 3. Mirrored-Start Rule

When only one agent receives the start request, that agent must generate a copy-ready mirrored start message for the other agent.

Important:

- The mirrored message must preserve the original first mover.
- Only the addressee and agent names are mirrored.
- Do not accidentally change who starts.
- Keep the chat-mode trigger phrase verbatim so the other agent recognizes the request.
- Display the mirrored prompt before writing any round content.

If the receiving agent is the first mover, it should:

1. display the mirrored message to the user first
2. update state and create the session file skeleton
3. begin round 1 immediately in the same response
4. set the first polling interval and schedule ScheduleWakeup

Do not wait for the user to confirm delivery before beginning round 1.

## 4. State Update Sequence

The shared state file is:

```text
docs/development/agent-sync-state.json
```

When chat mode starts, write:

```json
{
  "current_agent": "codex | claude | user",
  "status": "waiting | in_progress | done | interrupted",
  "task": "English one-line task summary",
  "session_file": "docs/development/sessions/YYYY-MM-DD-slug.md",
  "conversation_mode": "turn-based | timed | hybrid",
  "limit_minutes": null,
  "max_turns": 4,
  "current_turn": 0,
  "poll_interval_seconds": 90,
  "next_check_at": "YYYY-MM-DDTHH:MM:SS+08:00",
  "last_checked_at": "YYYY-MM-DDTHH:MM:SS+08:00",
  "started_at": "YYYY-MM-DDTHH:MM:SS+08:00",
  "stop_reason": null,
  "updated_by": "codex | claude",
  "updated_at": "YYYY-MM-DDTHH:MM:SS+08:00"
}
```

State values should stay English / ASCII whenever practical. Put user-facing Chinese in markdown prose, not machine-oriented JSON values.

## 5. Session File Sequence

Each session writes content to:

```text
docs/development/sessions/YYYY-MM-DD-{slug}.md
```

Agents read:

1. `docs/development/agent-sync-state.json`
2. the file at `session_file`

Do not read or write `docs/development/agent-handoff.md` for session content.

Each turn should append a round section to the session file:

```markdown
---

## Round N - Codex

Round content...
```

## 6. Polling Defaults

Polling interval is chosen by the current agent based on what the next agent is expected to do.

Use these defaults:

- `60 seconds`: acknowledgement, simple agreement, trivial handoff
- `90 seconds`: reasoning-only reply, synthesis, planning, design discussion
- `120 seconds`: file reading, grep checks, verification, evidence gathering

When a turn completes, the current agent must:

1. choose the next polling interval
2. write `poll_interval_seconds`
3. compute and write `next_check_at`
4. schedule ScheduleWakeup using the same interval
5. announce in commentary that wakeup is scheduled and polling is starting
6. perform an in-turn scheduled recheck if the session is still active

The agent must not treat "round content written" as the turn boundary. The turn is still open until the first poll has run and state/session have been re-read.

## 7. Turn Completion And End State

One completed agent reply plus state/session update counts as one turn.

When the turn limit or time limit is reached, or the user stops chat mode, set:

```json
{
  "status": "done",
  "current_agent": "user",
  "stop_reason": "turn_limit_reached | time_limit_reached | manual_stop"
}
```

Do not start another turn after the end state is written.

## 8. Safety Rules

Do not start chat mode when:

- the request has no time or turn limit
- the request is ambiguous
- the request has conflicting limits
- the mirrored start message has not been generated

If `agent-sync-state.json` and the session file conflict:

1. report the mismatch
2. pause for resolution
3. do not auto-repair or silently overwrite either file

## 9. Known Failure Modes

**Mirrored start accidentally changes first mover**
The mirrored message swaps agent names but must preserve who starts first.

**State gets metadata but no actual timer is started**
Writing `poll_interval_seconds` and `next_check_at` to state is not enough. The agent must also schedule ScheduleWakeup and perform an in-turn recheck.

**Chinese text in state JSON values**
Chinese characters in `task` or other state fields can be garbled by terminals or scripts that do not handle UTF-8 correctly. Keep state values in English / ASCII.

**Session ends but current_agent is not reset to user**
Always set `current_agent: user` when closing.

**Agent polls but other agent's turn has not started yet**
Read the session file to confirm what was done before acting.

**Agent mistakes content completion for turn completion**
If the first poll has not run, the turn is not complete.

**ScheduleWakeup fires but expected round is absent from session file**
If `current_turn` is N but the session file does not contain a completed Round N, do not infer, continue, or repair. Report the mismatch and pause for resolution.
