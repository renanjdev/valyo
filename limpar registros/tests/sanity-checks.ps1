# tests/sanity-checks.ps1
# Roda assercoes manuais nas funcoes puras de limpar-registros.ps1.
# Uso: pwsh -File .\tests\sanity-checks.ps1
#      ou: powershell.exe -File .\tests\sanity-checks.ps1

$ErrorActionPreference = 'Stop'
$scriptPath = Join-Path $PSScriptRoot '..\limpar-registros.ps1'
. $scriptPath  # dot-source - skips main-flow gate

$failures = 0
function Assert-Equal {
    param($Actual, $Expected, [string]$Label)
    if ($Actual -ne $Expected) {
        Write-Host "FAIL: $Label - esperado '$Expected', obteve '$Actual'" -ForegroundColor Red
        $script:failures++
    } else {
        Write-Host "OK:   $Label" -ForegroundColor Green
    }
}

function Assert-True {
    param([bool]$Condition, [string]$Label)
    Assert-Equal -Actual $Condition -Expected $true -Label $Label
}

function Assert-False {
    param([bool]$Condition, [string]$Label)
    Assert-Equal -Actual $Condition -Expected $false -Label $Label
}

# === Sanity checks (filled in subsequent tasks) ===

if ($failures -gt 0) {
    Write-Host "`n$failures falha(s) detectada(s)." -ForegroundColor Red
    exit 1
} else {
    Write-Host "`nTodas as assercoes passaram." -ForegroundColor Green
}
