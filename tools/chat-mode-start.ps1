param(
    [Parameter(Mandatory = $true)]
    [string]$Topic,

    [ValidateSet('turn-based', 'timed', 'hybrid')]
    [string]$Mode = 'turn-based',

    [int]$MaxTurns = 4,

    [Nullable[int]]$LimitMinutes = $null,

    [Parameter(Mandatory = $true)]
    [ValidateSet('codex', 'claude')]
    [string]$FirstMover,

    [ValidateSet('codex', 'claude')]
    [string]$RunnerAgent = 'codex',

    [string]$TaskSummary = 'chat-mode session',

    [int]$PollIntervalSeconds = 90,

    [string]$RepoPath = '',

    [switch]$WritePromptFile
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($RepoPath)) {
    $RepoPath = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
}

if ($Mode -eq 'turn-based' -and $MaxTurns -le 0) {
    throw 'MaxTurns must be greater than 0 for turn-based mode.'
}

if (($Mode -eq 'timed' -or $Mode -eq 'hybrid') -and ($null -eq $LimitMinutes -or $LimitMinutes -le 0)) {
    throw 'LimitMinutes must be provided and greater than 0 for timed or hybrid mode.'
}

if ($Mode -eq 'hybrid' -and $MaxTurns -le 0) {
    throw 'MaxTurns must be greater than 0 for hybrid mode.'
}

if ($TaskSummary.ToCharArray().Where({ [int][char]$_ -gt 127 }).Count -gt 0) {
    throw 'TaskSummary must contain ASCII only.'
}

$statePath = Join-Path $RepoPath 'docs\development\agent-sync-state.json'
$promptPath = Join-Path $RepoPath 'docs\development\claude-start-prompt.txt'
$sessionsDir = Join-Path $RepoPath 'docs\development\sessions'

function Get-IsoNow {
    param([datetimeoffset]$Value)
    return $Value.ToString('yyyy-MM-ddTHH:mm:sszzz')
}

function Decode-Utf8Base64 {
    param([string]$Value)
    return [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Value))
}

function Get-AgentLabel {
    param([string]$Agent)
    switch ($Agent) {
        'codex' { return (Decode-Utf8Base64 '6Zi/5YW4') }
        'claude' { return (Decode-Utf8Base64 '5bCP5YWL') }
        default { throw "Unknown agent: $Agent" }
    }
}

function Get-OtherAgent {
    param([string]$Agent)
    if ($Agent -eq 'codex') { return 'claude' }
    return 'codex'
}

function New-MirroredPrompt {
    param(
        [string]$TaskTopic,
        [int]$Turns,
        [string]$StarterAgent
    )

    $starterLabel = Get-AgentLabel -Agent $StarterAgent
    # Chinese literals are Base64-encoded to avoid PowerShell source-file encoding issues.
    $part1 = Decode-Utf8Base64 '6Yed5bCN44CM'
    $part2 = Decode-Utf8Base64 '44CN77yM5L2g5ZKM'
    $part3 = Decode-Utf8Base64 '6YCy6KGMIA=='
    $part4 = Decode-Utf8Base64 'IOWbnuWQiOaaouiBiuaooeW8j++8jOWFiOeUsQ=='
    $part5 = Decode-Utf8Base64 '6ZaL5aeL44CC'
    $part6 = Decode-Utf8Base64 '5bey6ZaL5aeL56ysIDEg5Zue5ZCI77yM6KuL5L2g5o6l56ysIDIg5Zue5ZCI44CC'

    return "$part1$TaskTopic$part2$starterLabel$part3$Turns$part4$starterLabel$part5$starterLabel$part6"
}

function Get-SessionSlug {
    param([string]$Summary)
    return ($Summary.ToLower() -replace '[^a-z0-9]+', '-').Trim('-')
}

function New-SessionFilePath {
    param([string]$Dir, [string]$Summary, [datetimeoffset]$When)
    $slug = Get-SessionSlug -Summary $Summary
    $dateStr = $When.ToString('yyyy-MM-dd')
    $fileName = "$dateStr-$slug.md"
    return Join-Path $Dir $fileName
}

function New-SessionDocument {
    param(
        [string]$TaskSummaryText,
        [string]$Mode,
        [int]$Turns,
        [string]$StarterAgent
    )
    return @"
# Session: $TaskSummaryText

Date: $($now.ToString('yyyy-MM-dd'))
Mode: $Mode, $Turns turns
First mover: $StarterAgent

---

"@
}

$now = [datetimeoffset]::Now
$nextCheck = $now.AddSeconds($PollIntervalSeconds)
$starter = $FirstMover
$nextOwner = Get-OtherAgent -Agent $starter
$mirroredPrompt = New-MirroredPrompt -TaskTopic $Topic -Turns $MaxTurns -StarterAgent $starter

$sessionFilePath = New-SessionFilePath -Dir $sessionsDir -Summary $TaskSummary -When $now
$sessionFileRelative = 'docs/development/sessions/' + (Split-Path -Leaf $sessionFilePath)

$state = [ordered]@{
    current_agent = $starter
    status = 'in_progress'
    task = $TaskSummary
    session_file = $sessionFileRelative
    conversation_mode = $Mode
    limit_minutes = $LimitMinutes
    max_turns = $MaxTurns
    current_turn = 0
    poll_interval_seconds = $PollIntervalSeconds
    next_check_at = Get-IsoNow -Value $nextCheck
    last_checked_at = Get-IsoNow -Value $now
    started_at = Get-IsoNow -Value $now
    stop_reason = $null
    updated_by = $RunnerAgent
    updated_at = Get-IsoNow -Value $now
}

$sessionContent = New-SessionDocument -TaskSummaryText $TaskSummary -Mode $Mode -Turns $MaxTurns -StarterAgent $starter

if (-not (Test-Path -LiteralPath (Split-Path -Parent $statePath))) {
    New-Item -ItemType Directory -Path (Split-Path -Parent $statePath) | Out-Null
}
if (-not (Test-Path -LiteralPath $sessionsDir)) {
    New-Item -ItemType Directory -Path $sessionsDir | Out-Null
}

$state | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $statePath -Encoding utf8
Set-Content -LiteralPath $sessionFilePath -Encoding utf8 -Value $sessionContent

if ($WritePromptFile) {
    Set-Content -LiteralPath $promptPath -Encoding utf8 -Value $mirroredPrompt
}

[pscustomobject]@{
    mirrored_prompt = $mirroredPrompt
    task_summary = $TaskSummary
    state_path = $statePath
    session_file = $sessionFileRelative
    prompt_path = $(if ($WritePromptFile) { $promptPath } else { $null })
    current_agent = $starter
    next_owner = $nextOwner
    started_at = Get-IsoNow -Value $now
} | ConvertTo-Json -Depth 3
