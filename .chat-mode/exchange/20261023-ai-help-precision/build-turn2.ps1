$ErrorActionPreference = 'Stop'
$taskRoot = 'D:\projects\it-class-tcwu'
$taskDir = Join-Path $taskRoot '.chat-mode/exchange/20261023-ai-help-precision'
$taskFirst = [IO.File]::ReadAllText((Join-Path $taskDir 'turn-0001.request.md'))
$taskEnvelope = ($taskFirst -split '(?m)^---\s*$', 3)[1]
$taskEnvelope = $taskEnvelope.Replace('turn_id: 0001', 'turn_id: 0002').Replace('CHAT_MOD_PRECISION_0001_DONE', 'CHAT_MOD_PRECISION_0002_DONE')
$taskEnvelope = [regex]::Replace($taskEnvelope, '(?m)^deadline:.*$', ('deadline: ' + [DateTime]::UtcNow.AddMinutes(8).ToString('o')))
$taskBody = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'build-turn2-body.txt'), [Text.Encoding]::UTF8)
[IO.File]::WriteAllText((Join-Path $taskDir 'turn-0002.request.md'), "---`n$taskEnvelope---`n`n$taskBody", [Text.UTF8Encoding]::new($false))
$taskRun = Get-Content -Raw (Join-Path $taskRoot '.chat-mode/sessions/20261023-ai-help-precision/turn-0001.run.json') | ConvertFrom-Json
$taskCurrent = (@(git -C $taskRoot -c core.quotepath=false status --porcelain=v1 --untracked-files=all) -join "`n")
if ($taskCurrent -ne $taskRun.gitBefore.Status -or $taskRun.gitBefore.Status -ne $taskRun.gitAfter.Status) { throw 'Git baseline mismatch' }
Write-Output "Round 1 verified: $($taskRun.status), viewer=$($taskRun.conversationViewerStarted), Git unchanged."
