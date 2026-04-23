# Chat-Mode Start Script

`tools/chat-mode-start.ps1` is a guardrail starter for chat-mode.

Its job is to make the startup steps mechanical instead of memory-based:

- generate the mirrored prompt for the other agent
- initialize `docs/development/agent-sync-state.json`
- create the per-session markdown file referenced by `session_file`

## Purpose

Use this before round 1 when starting a new chat-mode session.

This script does not write round content.
It prepares the session so round 1 can begin immediately.

## Example

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\chat-mode-start.ps1 `
  -Topic "Build a startup script that always writes mirrored prompt, state, and session file" `
  -TaskSummary "validate chat-mode startup script, 4 turns" `
  -Mode turn-based `
  -MaxTurns 4 `
  -FirstMover codex `
  -RunnerAgent codex `
  -PollIntervalSeconds 120 `
  -WritePromptFile
```

## Notes

- `Topic` may be Traditional Chinese because it is only used in the mirrored prompt.
- `TaskSummary` must stay English / ASCII because it is written into `agent-sync-state.json`.

## Output

The script writes:

- `docs/development/agent-sync-state.json`
- `docs/development/sessions/YYYY-MM-DD-{slug}.md`

If `-WritePromptFile` is supplied, it also writes:

- `docs/development/claude-start-prompt.txt`

The script prints a JSON object to stdout with the mirrored prompt and file paths.
