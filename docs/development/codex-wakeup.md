# Codex Deferred Relay

This repo can use `tools/codex-wakeup.ps1` as a ScheduleWakeup-style substitute for Codex.

The tool does **not** resume the same interactive Codex session.
It starts a new `codex exec` process after a delay, then that new process rebuilds context from:

- `docs/development/agent-sync-state.json`
- the markdown file named by the state's `session_file` field

## Mental Model

- `ScheduleWakeup`: same session wakes up later
- `codex-wakeup.ps1`: new Codex exec re-enters later from file-backed state

Short name: `deferred relay`

## Modes

- `loop`: the parent PowerShell script owns retries
- `chain`: the spawned Codex exec is instructed to background-launch the next retry

`loop` is easier to debug.
`chain` is closer to a true fire-and-forget relay.
`chain` is still experimental: subprocess spawn is verified, but end-to-end multi-retry relay has not yet been tested.

## Basic Usage

Run one delayed retry in loop mode:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\codex-wakeup.ps1 `
  -Mode loop `
  -DelaySec 90 `
  -RetryN 1 `
  -MaxRetries 4
```

Run chain mode:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\codex-wakeup.ps1 `
  -Mode chain `
  -DelaySec 90 `
  -RetryN 1 `
  -MaxRetries 4
```

## Smoke Test

Use a custom prompt instead of the default chat-mode logic:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\codex-wakeup.ps1 `
  -DelaySec 0 `
  -MaxRetries 1 `
  -PromptText "Reply with exactly TEST_OK"
```

## Logs

Native `codex exec` output is noisy in this environment, so the script writes logs under:

`docs/development/wakeup-logs`

Each run writes separate stdout/stderr files per retry.

## Protocol Notes

The default prompt follows the current chat-mode protocol:

1. Read `docs/development/agent-sync-state.json`.
2. Open the markdown file named by `session_file`.
3. Do not read or write `docs/development/agent-handoff.md` for session content.
4. If `session_file` is missing, unreadable, or inconsistent with `current_turn`, stop and report instead of guessing.
