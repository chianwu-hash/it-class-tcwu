param(
    [Parameter(Mandatory = $true)]
    [string]$TargetProjectRoot
)

$ErrorActionPreference = "Stop"

$moduleRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$targetRoot = Resolve-Path $TargetProjectRoot

function Ensure-Dir {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Path $Path | Out-Null
    }
}

function Copy-FileToDir {
    param(
        [string]$Source,
        [string]$DestinationDir
    )
    Ensure-Dir $DestinationDir
    Copy-Item -LiteralPath $Source -Destination $DestinationDir -Force
}

$automationDir = Join-Path $targetRoot "automation"
$workflowDir = Join-Path $targetRoot "docs\workflow"
$workflowPromptsTemplatesDir = Join-Path $targetRoot "docs\workflow\prompts\templates"
$templatesDir = Join-Path $targetRoot "templates"

Ensure-Dir $automationDir
Ensure-Dir (Join-Path $automationDir "question-banks")
Ensure-Dir (Join-Path $automationDir "output")
Ensure-Dir (Join-Path $automationDir "output\gemini-reviews")
Ensure-Dir (Join-Path $targetRoot "docs\references\textbooks")
Ensure-Dir (Join-Path $targetRoot "docs\references\exams")
Ensure-Dir (Join-Path $targetRoot "docs\references\curriculum")
Ensure-Dir $workflowDir
Ensure-Dir $workflowPromptsTemplatesDir
Ensure-Dir $templatesDir
Ensure-Dir (Join-Path $targetRoot "wayground")

Copy-Item -Path (Join-Path $moduleRoot "automation\*.js") -Destination $automationDir -Force

Copy-FileToDir (Join-Path $moduleRoot "AI_DEPLOY_PROMPT.md") $workflowDir
Copy-FileToDir (Join-Path $moduleRoot "README.md") $workflowDir
Copy-FileToDir (Join-Path $moduleRoot "END_TO_END_FLOW.md") $workflowDir
Copy-FileToDir (Join-Path $moduleRoot "DEPLOYMENT_CHECKLIST.md") $workflowDir
Copy-FileToDir (Join-Path $moduleRoot "WORKFLOW_SOP.md") $workflowDir
Copy-FileToDir (Join-Path $moduleRoot "TEXTBOOK_TO_BANK_SOP.md") $workflowDir
Copy-FileToDir (Join-Path $moduleRoot "DISTRACTOR_SELF_REVIEW.md") $workflowDir
Copy-FileToDir (Join-Path $moduleRoot "docs\question-bank-quality-spec.md") $workflowDir
Copy-FileToDir (Join-Path $moduleRoot "docs\tooling.md") $workflowDir

Copy-Item -Path (Join-Path $moduleRoot "prompts\*") -Destination $workflowPromptsTemplatesDir -Recurse -Force
Copy-Item -Path (Join-Path $moduleRoot "templates\*") -Destination $templatesDir -Recurse -Force

$projectConfig = Join-Path $targetRoot "project.config.md"
if (-not (Test-Path -LiteralPath $projectConfig)) {
    Copy-Item -LiteralPath (Join-Path $moduleRoot "PROJECT_CONFIG_TEMPLATE.md") -Destination $projectConfig -Force
}

$packageScripts = Join-Path $targetRoot "PACKAGE_SCRIPTS_SNIPPET.question-bank-wayground.json"
Copy-Item -LiteralPath (Join-Path $moduleRoot "PACKAGE_SCRIPTS_SNIPPET.json") -Destination $packageScripts -Force

Write-Host "Question-bank Wayground workflow module installed."
Write-Host "Target: $targetRoot"
Write-Host "Next steps:"
Write-Host "1. Merge scripts from PACKAGE_SCRIPTS_SNIPPET.question-bank-wayground.json into package.json."
Write-Host "2. Fill project.config.md."
Write-Host "3. Read docs\workflow\DEPLOYMENT_CHECKLIST.md."
