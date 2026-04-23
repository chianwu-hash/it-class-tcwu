param(
    [ValidateSet('loop', 'chain')]
    [string]$Mode = 'loop',

    [int]$DelaySec = 90,

    [int]$RetryN = 1,

    [int]$MaxRetries = 4,

    [string]$RepoPath = (Split-Path -Parent $PSScriptRoot),

    [string]$LogDir,

    [string]$PromptText,

    [ValidateSet('read-only', 'workspace-write', 'danger-full-access')]
    [string]$Sandbox = 'workspace-write'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($LogDir)) {
    $LogDir = Join-Path $RepoPath 'docs\development\wakeup-logs'
}

$statePath = Join-Path $RepoPath 'docs\development\agent-sync-state.json'
$scriptPath = $MyInvocation.MyCommand.Path
$codexExe = (Get-Command codex -ErrorAction Stop).Source

function New-LogPrefix {
    param(
        [string]$Directory,
        [int]$Retry
    )

    if (-not (Test-Path -LiteralPath $Directory)) {
        New-Item -ItemType Directory -Path $Directory | Out-Null
    }

    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    return Join-Path $Directory "retry${Retry}-${stamp}"
}

function Quote-Arg {
    param(
        [string]$Value
    )

    if ($null -eq $Value) {
        return '""'
    }

    if ($Value -notmatch '[\s"]') {
        return $Value
    }

    return '"' + ($Value -replace '"', '\"') + '"'
}

function Get-ChainCommand {
    param(
        [string]$WakeScriptPath,
        [string]$RootPath,
        [string]$Directory,
        [string]$SandboxMode,
        [int]$DelaySeconds,
        [int]$NextRetry,
        [int]$RetryLimit
    )

    $parts = @(
        '-NoProfile'
        '-ExecutionPolicy'
        'Bypass'
        '-File'
        $WakeScriptPath
        '-Mode'
        'chain'
        '-DelaySec'
        $DelaySeconds
        '-RetryN'
        $NextRetry
        '-MaxRetries'
        $RetryLimit
        '-RepoPath'
        $RootPath
        '-LogDir'
        $Directory
        '-Sandbox'
        $SandboxMode
    ) | ForEach-Object { "'$_'" }

    return "Start-Process powershell -ArgumentList " + ($parts -join ',')
}

function Get-DefaultPrompt {
    param(
        [string]$CurrentMode,
        [int]$CurrentRetry,
        [int]$RetryLimit,
        [int]$DelaySeconds,
        [string]$RootPath,
        [string]$WakeScriptPath,
        [string]$Directory,
        [string]$SandboxMode
    )

    $common = @(
        "[Retry $CurrentRetry/$RetryLimit]"
        "Read docs/development/agent-sync-state.json first, then open the markdown file named by its session_file field."
        "Do not read or write docs/development/agent-handoff.md for chat-mode session content."
        "If status is done or interrupted, stop without changing files."
        "If session_file is missing or unreadable, report the mismatch and stop without changing files."
        "If current_turn in state does not match completed Round sections in session_file, report the mismatch and stop without changing files."
        "If current_agent == codex, append the next Round section to session_file, update agent-sync-state.json, schedule the next wakeup if needed, and poll according to the chat-mode protocol."
    )

    if ($CurrentMode -eq 'chain') {
        $chainCommand = Get-ChainCommand -WakeScriptPath $WakeScriptPath -RootPath $RootPath -Directory $Directory -SandboxMode $SandboxMode -DelaySeconds $DelaySeconds -NextRetry ($CurrentRetry + 1) -RetryLimit $RetryLimit
        $modeLines = @(
            "If current_agent != codex and retry < max, run this PowerShell command in the background before you exit:"
            $chainCommand
            "If current_agent != codex and retry == max, set status=interrupted, stop_reason=codex_timeout, and current_agent=user."
        )
    }
    else {
        $modeLines = @(
            "If current_agent != codex and retry < max, do not change files; just exit so the parent wake script can sleep and retry."
            "If current_agent != codex and retry == max, set status=interrupted, stop_reason=codex_timeout, and current_agent=user."
        )
    }

    return (($common + $modeLines) -join ' ')
}

function Get-ChatModeState {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Missing state file: $Path"
    }

    return Get-Content -LiteralPath $Path -Encoding utf8 | ConvertFrom-Json
}

function Get-SessionFilePath {
    param(
        [object]$State,
        [string]$RootPath
    )

    if (-not (Get-Member -InputObject $State -Name 'session_file' -MemberType NoteProperty) -or [string]::IsNullOrWhiteSpace($State.session_file)) {
        throw "State file is missing required session_file field."
    }

    $relativePath = [string]$State.session_file
    $normalizedPath = $relativePath -replace '/', [IO.Path]::DirectorySeparatorChar
    return Join-Path $RootPath $normalizedPath
}

if ([string]::IsNullOrWhiteSpace($PromptText)) {
    $initialState = Get-ChatModeState -Path $statePath
    $sessionPath = Get-SessionFilePath -State $initialState -RootPath $RepoPath
    if (-not (Test-Path -LiteralPath $sessionPath)) {
        throw "Missing session file: $sessionPath"
    }
}

if ($DelaySec -gt 0) {
    Start-Sleep -Seconds $DelaySec
}

for ($attempt = $RetryN; $attempt -le $MaxRetries; $attempt++) {
    $logPrefix = New-LogPrefix -Directory $LogDir -Retry $attempt
    $stdoutLog = "${logPrefix}-stdout.txt"
    $stderrLog = "${logPrefix}-stderr.txt"

    $prompt = if ([string]::IsNullOrWhiteSpace($PromptText)) {
        Get-DefaultPrompt -CurrentMode $Mode -CurrentRetry $attempt -RetryLimit $MaxRetries -DelaySeconds $DelaySec -RootPath $RepoPath -WakeScriptPath $scriptPath -Directory $LogDir -SandboxMode $Sandbox
    }
    else {
        $PromptText
    }

    $invokeArgs = @(
        'exec'
        '-C'
        $RepoPath
        '--sandbox'
        $Sandbox
        $prompt
    )

    $argumentLine = (($invokeArgs | ForEach-Object { Quote-Arg $_ }) -join ' ')
    $process = Start-Process -FilePath $codexExe -ArgumentList $argumentLine -WorkingDirectory $RepoPath -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog -NoNewWindow -Wait -PassThru
    if ($process.ExitCode -ne 0) {
        throw "codex exec failed with exit code $($process.ExitCode). See $stderrLog"
    }

    if (-not [string]::IsNullOrWhiteSpace($PromptText)) {
        break
    }

    $state = Get-ChatModeState -Path $statePath
    if ($state.status -in @('done', 'interrupted')) {
        break
    }

    if ($Mode -eq 'chain') {
        break
    }

    if ($attempt -lt $MaxRetries) {
        Start-Sleep -Seconds $DelaySec
    }
}

if (-not [string]::IsNullOrWhiteSpace($PromptText)) {
    exit 0
}

$finalState = Get-ChatModeState -Path $statePath
if ($finalState.status -notin @('done', 'interrupted')) {
    $finalState.status = 'interrupted'
    $finalState.stop_reason = 'codex_timeout'
    $finalState.current_agent = 'user'
    $finalState | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding utf8
}
