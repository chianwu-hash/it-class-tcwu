param([string]$Endpoint,[string]$Method='GET',[string]$InputFile)
$ErrorActionPreference='Stop'
if($Method -eq 'POST' -and $Endpoint -match '(^|/)(?:v[0-9]+/)?deployments/?(?:\?|$)'){
 if(-not $InputFile){throw 'Deployment creation requires a checked JSON input file.'}
 & node (Join-Path $PSScriptRoot '../check-vercel-deployment-payload.mjs') $InputFile
 if($LASTEXITCODE -ne 0){throw 'Deployment payload check failed; upload blocked.'}
}
if($InputFile){& vercel api $Endpoint --scope chianwu-4755s-projects --method $Method --input $InputFile}
else{& vercel api $Endpoint --scope chianwu-4755s-projects --method $Method}
exit $LASTEXITCODE
