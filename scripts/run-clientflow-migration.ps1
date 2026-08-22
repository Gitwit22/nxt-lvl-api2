$ErrorActionPreference = 'Stop'

Set-Location (Split-Path $PSScriptRoot -Parent)
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
Remove-Item Env:CLIENTFLOW_DATABASE_URL -ErrorAction SilentlyContinue

$sourceSecure = Read-Host '1 of 2 - Paste EXACT Render API DATABASE_URL (legacy source)' -AsSecureString
$sourcePointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sourceSecure)
try {
  $env:DATABASE_URL = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($sourcePointer)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($sourcePointer)
}

$targetSecure = Read-Host '2 of 2 - Paste NEW CLIENTFLOW_DATABASE_URL (target)' -AsSecureString
$targetPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($targetSecure)
try {
  $env:CLIENTFLOW_DATABASE_URL = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($targetPointer)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($targetPointer)
}

$sourceUri = [Uri]$env:DATABASE_URL
$targetUri = [Uri]$env:CLIENTFLOW_DATABASE_URL
if ($sourceUri.Scheme -notin @('postgres', 'postgresql') -or $targetUri.Scheme -notin @('postgres', 'postgresql')) {
  throw 'Both values must be PostgreSQL URLs.'
}
if ($sourceUri.AbsoluteUri -eq $targetUri.AbsoluteUri) {
  throw 'Source and target database URLs must be different.'
}

Write-Host "Source: $($sourceUri.Host)$($sourceUri.AbsolutePath)"
Write-Host "Target: $($targetUri.Host)$($targetUri.AbsolutePath)"

npm run prisma:deploy:clientflow
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

npm run clientflow:data:copy
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

npm run clientflow:data:verify
exit $LASTEXITCODE
