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

# === Sanity checks ===

# --- Constants ---
Assert-Equal -Actual $script:DangerousTerms.Count -Expected 10 -Label 'DangerousTerms tem 10 itens'
Assert-Equal -Actual $script:HiveAliases['HKLM_SOFTWARE'] -Expected 'HKEY_LOCAL_MACHINE\SOFTWARE' -Label 'HiveAlias HKLM_SOFTWARE resolve correto'
Assert-Equal -Actual $script:HiveAliases['HKLM_WOW64'] -Expected 'HKEY_LOCAL_MACHINE\SOFTWARE\WOW6432Node' -Label 'HiveAlias HKLM_WOW64 resolve correto'
Assert-Equal -Actual $script:DenylistRules.Count -Expected 9 -Label 'DenylistRules tem 9 entradas'

# --- Test-DangerousTerm ---
Assert-True  -Condition (Test-DangerousTerm -Termos @('microsoft'))         -Label 'microsoft eh perigoso'
Assert-True  -Condition (Test-DangerousTerm -Termos @('AutoCAD','windows')) -Label 'um perigoso entre normais bloqueia'
Assert-True  -Condition (Test-DangerousTerm -Termos @('Microsoft Office'))  -Label 'substring perigosa bloqueia (case-insensitive)'
Assert-True  -Condition (Test-DangerousTerm -Termos @('ad'))                -Label 'termo curto bloqueia'
Assert-False -Condition (Test-DangerousTerm -Termos @('autodesk'))          -Label 'autodesk nao eh perigoso'
Assert-False -Condition (Test-DangerousTerm -Termos @('autocad','adobe'))   -Label 'lista normal nao bloqueia'

# --- Resolve-HiveAlias ---
Assert-Equal -Actual (Resolve-HiveAlias -Alias 'HKLM_SOFTWARE') -Expected 'Registry::HKEY_LOCAL_MACHINE\SOFTWARE' -Label 'Alias HKLM_SOFTWARE'
Assert-Equal -Actual (Resolve-HiveAlias -Alias 'HKCR')          -Expected 'Registry::HKEY_CLASSES_ROOT'           -Label 'Alias HKCR'
Assert-Equal -Actual (Resolve-HiveAlias -Alias 'HKLM_WOW64')    -Expected 'Registry::HKEY_LOCAL_MACHINE\SOFTWARE\WOW6432Node' -Label 'Alias HKLM_WOW64'

$threw = $false
try { Resolve-HiveAlias -Alias 'HKLM_INVENTADO' } catch { $threw = $true }
Assert-True -Condition $threw -Label 'Alias invalido lanca excecao'

# --- Test-PathInDenylist ---
Assert-True  -Condition (Test-PathInDenylist -Path 'HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\Foo')                                  -Label 'wildcard: Windows NT bloqueado'
Assert-True  -Condition (Test-PathInDenylist -Path 'HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\X')                                      -Label 'wildcard: Policies bloqueado'
Assert-True  -Condition (Test-PathInDenylist -Path 'HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Run')                      -Label 'wildcard-exc: CurrentVersion\Run bloqueado'
Assert-False -Condition (Test-PathInDenylist -Path 'HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\Foo')            -Label 'wildcard-exc: Uninstall\Foo liberado'
Assert-False -Condition (Test-PathInDenylist -Path 'HKEY_LOCAL_MACHINE\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\Bar') -Label 'wildcard-exc: WOW Uninstall liberado'
Assert-True  -Condition (Test-PathInDenylist -Path 'HKEY_CLASSES_ROOT\CLSID')                                                                -Label 'exact-only: CLSID raiz bloqueada'
Assert-False -Condition (Test-PathInDenylist -Path 'HKEY_CLASSES_ROOT\CLSID\{FOO}')                                                          -Label 'exact-only: CLSID\{...} liberada'
Assert-True  -Condition (Test-PathInDenylist -Path 'HKEY_CURRENT_USER\SOFTWARE\Adobe\Acrobat\X' -UserExcludes @('*\Adobe\Acrobat\*'))        -Label 'user-exclude bate'
Assert-False -Condition (Test-PathInDenylist -Path 'HKEY_CURRENT_USER\SOFTWARE\Adobe\Photoshop\X' -UserExcludes @('*\Adobe\Acrobat\*'))      -Label 'user-exclude nao bate em path diferente'
Assert-False -Condition (Test-PathInDenylist -Path 'HKEY_LOCAL_MACHINE\SOFTWARE\Autodesk\REX')                                               -Label 'path normal nao bloqueado'

# --- Get-ValueDataAsString ---
$dword = Get-ValueDataAsString -Kind 'DWord' -Data ([uint32]31)
Assert-True -Condition ($dword -contains '31')   -Label 'DWord exporta decimal'
Assert-True -Condition ($dword -contains '0x1f') -Label 'DWord exporta hex 0x lowercase sem padding'

$qword = Get-ValueDataAsString -Kind 'QWord' -Data ([uint64]0xDEADBEEFCAFE)
Assert-True -Condition ($qword -contains '0xdeadbeefcafe') -Label 'QWord exporta hex lowercase com prefixo 0x'

$sz = Get-ValueDataAsString -Kind 'String' -Data 'Autodesk.REX.Loader'
Assert-True -Condition ($sz -contains 'Autodesk.REX.Loader') -Label 'String pass-through'

# Wrap em @() pra evitar unwrap de array de 1 elemento pelo PowerShell
$multi = @(Get-ValueDataAsString -Kind 'MultiString' -Data @('foo', 'bar'))
Assert-Equal -Actual $multi.Count -Expected 1 -Label 'MultiString concatena com newline'
Assert-True  -Condition ($multi[0] -match 'foo') -Label 'MultiString contem foo'
Assert-True  -Condition ($multi[0] -match 'bar') -Label 'MultiString contem bar'

$bin = @(Get-ValueDataAsString -Kind 'Binary' -Data ([byte[]]@(0x01, 0x02, 0xAB)))
Assert-True -Condition ($bin -contains '01-02-ab') -Label 'Binary hex lowercase com hifen'

$none = @(Get-ValueDataAsString -Kind 'None' -Data $null)
Assert-Equal -Actual $none.Count -Expected 0 -Label 'None retorna array vazio'

# --- Optimize-MatchPlan ---
function New-FakeMatch {
    param($Path, $Type = 'Key', $ValueName = $null, $Action = 'DeleteKey')
    return [pscustomobject]@{
        Hive = ($Path -split '\\')[0]
        Path = $Path
        Type = $Type
        ValueName = $ValueName
        MatchedOn = 'KeyName'
        MatchedTerm = 'autodesk'
        Action = $Action
        Reason = $null
    }
}

# Caso 1: dedup
$plan = @(
    (New-FakeMatch -Path 'HKEY_LOCAL_MACHINE\SOFTWARE\Autodesk' -Action 'DeleteKey'),
    (New-FakeMatch -Path 'HKEY_LOCAL_MACHINE\SOFTWARE\Autodesk\Sub' -Type 'Value' -ValueName 'X' -Action 'DeleteValue'),
    (New-FakeMatch -Path 'HKEY_LOCAL_MACHINE\SOFTWARE\Outro' -Action 'DeleteKey')
)
$result = @(Optimize-MatchPlan -Plan $plan)
Assert-Equal -Actual $result.Count -Expected 2 -Label 'Optimize: DeleteValue sob DeleteKey eh removido'

# Caso 2: profundidade decrescente
$plan = @(
    (New-FakeMatch -Path 'HKEY_LOCAL_MACHINE\SOFTWARE\A'         -Action 'DeleteKey'),
    (New-FakeMatch -Path 'HKEY_LOCAL_MACHINE\SOFTWARE\B\C\D'     -Action 'DeleteKey'),
    (New-FakeMatch -Path 'HKEY_LOCAL_MACHINE\SOFTWARE\B\C'       -Action 'DeleteKey')
)
$result = @(Optimize-MatchPlan -Plan $plan)
Assert-Equal -Actual $result.Count -Expected 2 -Label 'Optimize: B\C\D removido por B\C ser ancestor'

# Caso 3: skip preservado
$plan = @(
    (New-FakeMatch -Path 'HKEY_LOCAL_MACHINE\SOFTWARE\X' -Action 'Skip(denylist)'),
    (New-FakeMatch -Path 'HKEY_LOCAL_MACHINE\SOFTWARE\Y' -Action 'DeleteKey')
)
$result = @(Optimize-MatchPlan -Plan $plan)
Assert-Equal -Actual $result.Count -Expected 2 -Label 'Optimize: Skip preservado'

if ($failures -gt 0) {
    Write-Host "`n$failures falha(s) detectada(s)." -ForegroundColor Red
    exit 1
} else {
    Write-Host "`nTodas as assercoes passaram." -ForegroundColor Green
}
