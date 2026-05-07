# Probe live de Find-RegistryMatches contra fixture HKCU.
# Roda em prompt elevado ou nao (HKCU nao precisa admin).
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '..\limpar-registros.ps1')

$fix = 'HKCU:\Software\TestLimparRegistros'

# Cleanup previo
if (Test-Path $fix) { Remove-Item -Recurse -Force $fix }

# Setup
New-Item -Path $fix -Force | Out-Null
New-Item -Path "$fix\autodesk-key" -Force | Out-Null
New-ItemProperty -Path $fix -Name 'AutodeskValueName' -Value 'foo' -Force | Out-Null
New-ItemProperty -Path $fix -Name 'plain' -Value 'contains autodesk in data' -Force | Out-Null
New-ItemProperty -Path "$fix\autodesk-key" -Name '(default)' -Value 'data with Autodesk' -Force | Out-Null

# Probe
$matches = Find-RegistryMatches -HivePath 'Registry::HKEY_CURRENT_USER\Software\TestLimparRegistros' -Termos @('autodesk')

Write-Host ""
Write-Host "=== Resultados ===" -ForegroundColor Cyan
$matches | Format-Table Path, Type, ValueName, MatchedOn, MatchedTerm, Action -AutoSize | Out-String | Write-Host

# Validar
$expectedKey = $matches | Where-Object { $_.Type -eq 'Key' -and $_.MatchedOn -eq 'KeyName' -and $_.Path -like '*autodesk-key' }
$expectedVName = $matches | Where-Object { $_.Type -eq 'Value' -and $_.MatchedOn -eq 'ValueName' -and $_.ValueName -eq 'AutodeskValueName' }
$expectedVData = $matches | Where-Object { $_.Type -eq 'Value' -and $_.MatchedOn -eq 'ValueData' -and $_.ValueName -eq 'plain' }
$expectedDefault = $matches | Where-Object { $_.Type -eq 'Value' -and $_.MatchedOn -eq 'ValueData' -and $_.ValueName -eq '(default)' }

$ok = $true
if (-not $expectedKey)     { Write-Host "FAIL: KeyName match em autodesk-key nao encontrado"   -ForegroundColor Red; $ok = $false }
if (-not $expectedVName)   { Write-Host "FAIL: ValueName match em AutodeskValueName ausente"   -ForegroundColor Red; $ok = $false }
if (-not $expectedVData)   { Write-Host "FAIL: ValueData match em plain ausente"               -ForegroundColor Red; $ok = $false }
if (-not $expectedDefault) { Write-Host "FAIL: ValueData match em (default) ausente"           -ForegroundColor Red; $ok = $false }

# Cleanup
Remove-Item -Recurse -Force $fix

if ($ok) {
    Write-Host "`nProbe OK: 4 matches esperados encontrados." -ForegroundColor Green
    exit 0
} else {
    exit 1
}
