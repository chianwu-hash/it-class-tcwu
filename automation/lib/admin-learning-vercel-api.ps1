param([string]$Endpoint,[string]$Method='GET',[string]$InputFile)
$ErrorActionPreference='Stop'
if($InputFile){& vercel api $Endpoint --scope chianwu-4755s-projects --method $Method --input $InputFile}
else{& vercel api $Endpoint --scope chianwu-4755s-projects --method $Method}
exit $LASTEXITCODE
