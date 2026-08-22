$ErrorActionPreference = 'Stop'

Set-Location (Split-Path $PSScriptRoot -Parent)

$promptedForUrl = -not $env:CLIENTFLOW_DATABASE_URL
if ($promptedForUrl) {
  $targetSecure = Read-Host 'Paste CLIENTFLOW_DATABASE_URL (target database)' -AsSecureString
  $targetPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($targetSecure)
  try {
    $env:CLIENTFLOW_DATABASE_URL = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($targetPointer)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($targetPointer)
  }
}

try {
  $targetUri = [Uri]$env:CLIENTFLOW_DATABASE_URL
  if ($targetUri.Scheme -notin @('postgres', 'postgresql')) {
    throw 'CLIENTFLOW_DATABASE_URL must be a PostgreSQL URL.'
  }

  Write-Host "Target: $($targetUri.Host)$($targetUri.AbsolutePath)"

  npm run prisma:deploy:clientflow
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  npm run clientflow:forms:audit
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  $confirmation = Read-Host 'Review the audit above. Type APPLY to normalize these records'
  if ($confirmation.Trim() -ne 'APPLY') {
    Write-Host 'Normalization cancelled. The schema migration was deployed, but no form records were changed.'
    exit 0
  }

  npm run clientflow:forms:normalize
  exit $LASTEXITCODE
} finally {
  if ($promptedForUrl) {
    Remove-Item Env:CLIENTFLOW_DATABASE_URL -ErrorAction SilentlyContinue
  }
}