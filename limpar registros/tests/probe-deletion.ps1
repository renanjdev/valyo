# Probe pra Invoke-DeletionPlan (apaga em HKCU, sem precisar admin)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '..\limpar-registros.ps1')

$failures = 0

$fix = 'HKCU:\Software\TestLimparDelete'
if (Test-Path $fix) { Remove-Item -Recurse -Force $fix }
New-Item -Path $fix -Force | Out-Null
New-ItemProperty -Path $fix -Name 'foo' -Value 'bar' -Force | Out-Null
New-ItemProperty -Path $fix -Name 'baz' -Value 'quux' -Force | Out-Null

$plan = @(
    [pscustomobject]@{ Hive='HKEY_CURRENT_USER'; Path='HKEY_CURRENT_USER\Software\TestLimparDelete'; Type='Value'; ValueName='foo'; MatchedOn='ValueData'; MatchedTerm='bar'; Action='DeleteValue'; Reason=$null },
    [pscustomobject]@{ Hive='HKEY_CURRENT_USER'; Path='HKEY_CURRENT_USER\Software\TestLimparDelete'; Type='Value'; ValueName='baz'; MatchedOn='ValueData'; MatchedTerm='quux'; Action='DeleteValue'; Reason=$null }
)

$result = Invoke-DeletionPlan -Plan $plan

if ($result.ErrorCount -ne 0) { Write-Host "FAIL: ErrorCount=$($result.ErrorCount), esperado 0" -ForegroundColor Red; $failures++ }
if ($plan[0].Action -ne 'Deleted(Value)') { Write-Host "FAIL: plan[0].Action=$($plan[0].Action), esperado Deleted(Value)" -ForegroundColor Red; $failures++ }
if ($plan[1].Action -ne 'Deleted(Value)') { Write-Host "FAIL: plan[1].Action=$($plan[1].Action)" -ForegroundColor Red; $failures++ }

# Verificar que valores sumiram mas chave continua
$remaining = @((Get-Item $fix).GetValueNames())
if ($remaining.Count -ne 0) { Write-Host "FAIL: valores ainda existem: $($remaining -join ',')" -ForegroundColor Red; $failures++ }
if (-not (Test-Path $fix)) { Write-Host "FAIL: chave foi removida (so valores deveriam)" -ForegroundColor Red; $failures++ }

if ($failures -eq 0) { Write-Host "OK: Invoke-DeletionPlan apaga valores e chave permanece" -ForegroundColor Green }

Remove-Item -Recurse -Force $fix

if ($failures -gt 0) { exit 1 } else { exit 0 }
