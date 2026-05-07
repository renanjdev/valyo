# Probe pra Export-RegistryBackup + Write-Report
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '..\limpar-registros.ps1')

$failures = 0

# === Export-RegistryBackup ===
$fix = 'HKCU:\Software\TestLimparBackup'
if (Test-Path $fix) { Remove-Item -Recurse -Force $fix }
New-Item -Path $fix -Force | Out-Null
New-ItemProperty -Path $fix -Name 'foo' -Value 'bar' -Force | Out-Null

$plan = @(
    [pscustomobject]@{ Hive='HKEY_CURRENT_USER'; Path='HKEY_CURRENT_USER\Software\TestLimparBackup'; Type='Key'; ValueName=$null; MatchedOn='KeyName'; MatchedTerm='test'; Action='DeleteKey'; Reason=$null }
)
$out = Join-Path $env:TEMP 'limpar-test'
if (Test-Path $out) { Remove-Item -Recurse -Force $out }
New-Item -ItemType Directory -Path $out -Force | Out-Null

$dir = Export-RegistryBackup -Plan $plan -OutDir $out -Timestamp '2026-05-07-test'

if (-not (Test-Path $dir)) { Write-Host "FAIL: backup dir nao criado" -ForegroundColor Red; $failures++ }
$regs = @(Get-ChildItem -LiteralPath $dir -Filter '*.reg')
if ($regs.Count -ne 1) { Write-Host "FAIL: esperado 1 .reg, obtido $($regs.Count)" -ForegroundColor Red; $failures++ }
if (-not (Test-Path (Join-Path $dir 'manifest.txt'))) { Write-Host "FAIL: manifest.txt ausente" -ForegroundColor Red; $failures++ }

if ($failures -eq 0) { Write-Host "OK: Export-RegistryBackup criou pasta + 1 .reg + manifest" -ForegroundColor Green }

# Cleanup backup test
Remove-Item -Recurse -Force $fix
Remove-Item -Recurse -Force $out

# === Write-Report ===
$plan = @(
    [pscustomobject]@{ Hive='HKLM'; Path='HKLM\SOFTWARE\Test'; Type='Key'; ValueName=$null; MatchedOn='KeyName'; MatchedTerm='test'; Action='DeleteKey'; Reason=$null },
    [pscustomobject]@{ Hive='HKCU'; Path='HKCU\SOFTWARE\X';    Type='Value'; ValueName='val;with;semis'; MatchedOn='ValueName'; MatchedTerm='val'; Action='DeleteValue'; Reason=$null },
    [pscustomobject]@{ Hive='HKCU'; Path='HKCU\SOFTWARE\Y';    Type='Key'; ValueName=$null; MatchedOn='KeyName'; MatchedTerm='y'; Action='Skip(denylist)'; Reason='proibida' }
)
$out = Join-Path $env:TEMP 'limpar-report-test'
if (Test-Path $out) { Remove-Item -Recurse -Force $out }
New-Item -ItemType Directory -Path $out -Force | Out-Null

$r = Write-Report -Plan $plan -OutDir $out -Timestamp 'rt' -Mode 'dry-run' -Termos @('test') -HiveLabels @('HKLM\SOFTWARE')

$logContent = Get-Content $r.LogPath -Raw
$csvContent = Get-Content $r.CsvPath -Raw

if ($logContent -notmatch 'Modo: dry-run') { Write-Host "FAIL: log sem 'Modo: dry-run'" -ForegroundColor Red; $failures++ }
if ($logContent -notmatch 'Chaves a apagar/apagadas: 1') { Write-Host "FAIL: log sem sumario chaves=1" -ForegroundColor Red; $failures++ }
if ($logContent -notmatch 'Valores a apagar/apagados: 1') { Write-Host "FAIL: log sem sumario valores=1" -ForegroundColor Red; $failures++ }
if ($logContent -notmatch 'Pulados \(denylist\):       1') { Write-Host "FAIL: log sem skip(denylist)=1" -ForegroundColor Red; $failures++ }
if ($csvContent -notmatch '"val;with;semis"') { Write-Host "FAIL: CSV nao quotou valor com ;" -ForegroundColor Red; $failures++ }
if ($csvContent -notmatch 'Hive;Path;Type') { Write-Host "FAIL: CSV header errado" -ForegroundColor Red; $failures++ }

if ($failures -eq 0) { Write-Host "OK: Write-Report gera log + csv corretamente" -ForegroundColor Green }

Remove-Item -Recurse -Force $out

if ($failures -gt 0) { exit 1 } else {
    Write-Host "`nProbes OK." -ForegroundColor Green
    exit 0
}
