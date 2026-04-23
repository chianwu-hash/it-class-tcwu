# Skill: chat-mode

Codex skill file for bounded agent-to-agent collaboration.

Full protocol: `docs/development/chat-mode-skill.md`

---

## Quick Reference

### Priority Rule

In chat-mode, polling is the primary responsibility after each round.

A round is not complete until:

1. Round content is written to the session file at `session_file`
2. `agent-sync-state.json` is updated
3. ScheduleWakeup has been scheduled
4. the first scheduled poll has actually executed
5. state and session file have been re-read after that poll

Do not send a final or completion-style user message before step 4.
If round content is written but polling has not started, the turn is still incomplete.

### Round Completion Checklist

After writing round content, complete these steps in order before ending the response:

1. Write round content to the session file at `session_file`, not to `agent-handoff.md`.
2. Update `current_turn`, `current_agent`, `poll_interval_seconds`, `next_check_at`, and `updated_at` in `agent-sync-state.json`.
3. Schedule ScheduleWakeup using the same interval as `poll_interval_seconds`. Always schedule it because the user is not present during chat-mode sessions.
4. Announce in commentary: `Round written. State updated. Wakeup scheduled. Entering polling loop now.`
5. If the turn limit has not been reached, start the polling retry loop and do not end the response before the first poll.
6. Re-read `agent-sync-state.json` and the session file at `session_file` after the first poll.
7. If the turn limit has been reached, set `status=done`, `current_agent=user`, and `stop_reason=turn_limit_reached`.

Skipping any step means the other agent cannot proceed autonomously.

---

### Activation Checklist

Activation must show the mirrored prompt before any long-running work, then continue the session in the same response when the receiving agent is the first mover. This lets the user copy the prompt immediately without delaying round 1.

**Immediate prompt and setup:**

- [ ] Parse: mode, turn/time limit, first mover, topic.
- [ ] Generate the mirrored start line and display it to the user before writing round content.
- [ ] Write `agent-sync-state.json` with `status: in_progress`, `current_turn: 0`, and `current_agent` set to the first mover.
- [ ] Create the session file skeleton at `docs/development/sessions/YYYY-MM-DD-{slug}.md`.

**If this agent is the first mover, continue immediately in the same response:**

- [ ] Re-read `agent-sync-state.json` to confirm `current_agent` is still self.
- [ ] Write round 1 content to the session file.
- [ ] Update `current_turn`, `current_agent`, `poll_interval_seconds`, `next_check_at`, and `updated_at` in state.
- [ ] Schedule ScheduleWakeup for the next polling interval.
- [ ] Announce: `Round 1 written. State updated. Wakeup scheduled. Entering polling loop now.`
- [ ] Enter the polling retry loop.

If this agent is not the first mover, end after prompt/setup. The other agent writes round 1 after receiving the mirrored prompt.

Do not proceed if any step cannot be completed.

---

### Mirrored-Start Rule

When the user starts a session with Codex, generate a copy-ready message for Claude Code.

- Preserve the original first mover.
- Mirror only the addressee and agent names.
- Keep the chat-mode trigger phrase verbatim; without it, the other agent may not recognize the request as chat-mode.
- Wrap the message in a code block so it is copy-pasteable.

If Codex is the first mover, display the mirrored prompt first, then continue in the same response to write round 1 and start polling. Do not make the user wait for round 1 before seeing the mirrored prompt.

---

### State File

`docs/development/agent-sync-state.json`

Write on session start:

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
  "updated_by": "codex",
  "updated_at": "YYYY-MM-DDTHH:MM:SS+08:00"
}
```

Keep all values in English / ASCII. Chinese belongs in markdown prose only.

---

### Polling Defaults

Choose interval based on what the next agent is expected to do:

| Next task type | Interval | Max retries | Total wait |
| --- | --- | --- | --- |
| Trivial / acknowledgement | 60 s | 3 | about 3 min |
| Reasoning / planning | 90 s | 4 | about 6 min |
| File inspection / verify | 120 s | 4 | about 8 min |

After completing a turn, run this retry loop:

1. Choose the interval for the next agent's expected task.
2. Write `poll_interval_seconds` and `next_check_at` to state.
3. Schedule ScheduleWakeup using that same interval.
4. Announce that the wakeup is scheduled and polling is starting.
5. Wait the interval in-turn; do not end the response before polling.
6. Re-read `agent-sync-state.json` and the session file at `session_file`.
7. If `current_agent == codex`, it is Codex's turn to act. Respond and close if the turn limit has been reached.
8. If `current_agent != codex` and retry < max, increment retry and continue polling.
9. If retry == max, set `status=interrupted`, `stop_reason=codex_timeout`, and `current_agent=user`.

Do not stop after one wait. Repeat until ownership changes or retries are exhausted.
Do not treat "round content written" as the turn boundary. Polling is the real turn boundary.
Wakeup interval must match `poll_interval_seconds`; do not use an independent timer.

Wakeup prompt pattern:

```text
[Retry N/MAX, Xs] Read state, then open session_file. If my turn, respond. If not my turn and retry < max, wait Xs and recheck. Else timeout.
```

---

### End State

When the turn limit, time limit, or manual stop is reached:

```json
{
  "status": "done",
  "current_agent": "user",
  "stop_reason": "turn_limit_reached | time_limit_reached | manual_stop"
}
```

Always reset `current_agent` to `user` when closing.

---

### Known Failure Modes

1. **Mirrored start accidentally changes first mover** - check that the mirrored message names the same first mover as the original.
2. **Single wait instead of retry loop** - waiting once and reporting back to the user is not enough.
3. **Chinese in state JSON values** - keep task and all state fields in English / ASCII.
4. **Session closes without resetting current_agent to user** - always set `current_agent: user` on close.
5. **Polling before other agent finishes** - read the session file to confirm what was done before acting.
6. **Mistaking content completion for turn completion** - if the first poll has not run, the turn is not complete.
7. **`session_file` missing or unreadable** - stop and report; do not fall back to `agent-handoff.md`.
8. **`current_turn` in state does not match round count in session file** - report mismatch and pause for resolution; do not auto-repair.
9. **`updated_at` is stale (>30 min) and status is `in_progress`** - surface a warning before writing anything; do not treat as an automatic stop.
10. **ScheduleWakeup fires but expected round is absent from session file** - re-read state and session file. If `current_turn` is N but the session file does not contain a completed Round N, do not infer, continue, or repair; report the mismatch and pause for resolution.
