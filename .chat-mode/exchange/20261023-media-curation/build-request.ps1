$ErrorActionPreference = 'Stop'
$taskRoot = 'D:\projects\it-class-tcwu'
Set-Location $taskRoot
$taskBranch = git branch --show-current
$taskHead = git rev-parse HEAD
$taskUpstream = git rev-parse --abbrev-ref '@{u}'
$taskUpstreamHead = git rev-parse '@{u}'
$taskStatusText = (@(git status --porcelain=v1 --untracked-files=all) | ForEach-Object { '  ' + $_ }) -join "`n"
$taskDeadline = [DateTime]::UtcNow.AddMinutes(8).ToString('o')
$taskBody = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'build-request-body.txt'), [Text.Encoding]::UTF8)
$taskRequest = @"
---
protocol: chat-mode/v2
session_id: 20261023-media-curation
turn_id: 0001
orchestrator: codex
worker: claude
transport: claude-cli
intent: existing-media-curation-feasibility
mode: review
permission: read-only
authority: delegated
approval_policy: cli-supervised
edit_mode: dont-ask
repo_root: D:\projects\it-class-tcwu
repo_branch: $taskBranch
repo_head: $taskHead
repo_upstream: $taskUpstream
repo_upstream_head: $taskUpstreamHead
baseline_status: |
$taskStatusText
write_scope: []
authorized_actions:
  - read-project
  - list-and-search-project
authorized_commands: []
git_authority: read-only
network_authority: none
credential_authority: none
deployment_authority: none
external_paths: []
max_response_bytes: 40000
deadline: $taskDeadline
completion_marker: CHAT_MOD_MEDIA_0001_DONE
---

$taskBody
"@
[IO.File]::WriteAllText((Join-Path $taskRoot '.chat-mode/exchange/20261023-media-curation/turn-0001.request.md'), $taskRequest, [Text.UTF8Encoding]::new($false))
Write-Output 'Review request and Git baseline prepared.'
