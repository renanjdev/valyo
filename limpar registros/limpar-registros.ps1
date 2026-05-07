<#
.SYNOPSIS
    Limpa registros do Windows que contem um ou mais termos de busca.

.DESCRIPTION
    Espelha o fluxo manual do regedit (Ctrl+F -> Apagar -> F3 -> Apagar) com
    dry-run padrao, backup .reg automatico, denylist embutida e confirmacao
    dupla. Veja docs/superpowers/specs/2026-05-07-limpar-registros-design.md.

.EXAMPLE
    .\limpar-registros.ps1 -Termo autodesk,autocad

.EXAMPLE
    .\limpar-registros.ps1 -Termo autodesk -Apply

.EXAMPLE
    .\limpar-registros.ps1 -Termo autodesk -Interactive
#>
[CmdletBinding()]
param(
    # Validacao feita em Invoke-MainFlow (mandatory aqui quebraria dot-source)
    [string[]] $Termo,

    [string[]] $Hives = @('HKLM_SOFTWARE', 'HKLM_WOW64', 'HKCU_SOFTWARE', 'HKCR'),

    [switch] $Apply,

    [switch] $Interactive,

    [switch] $Yes,

    [string[]] $Exclude = @(),

    [switch] $Force,

    # OutDir resolvido para absoluto na Fase 0 (relativo ao CWD por padrao)
    [string] $OutDir = 'output',

    [int] $MaxDepth = 50
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# === Constants ===

$script:DangerousTerms = @(
    'microsoft', 'windows', 'system', 'intel', 'nvidia',
    'amd', 'realtek', 'driver', 'kernel', 'policies'
)

$script:HiveAliases = @{
    'HKLM_SOFTWARE' = 'HKEY_LOCAL_MACHINE\SOFTWARE'
    'HKLM_WOW64'    = 'HKEY_LOCAL_MACHINE\SOFTWARE\WOW6432Node'
    'HKCU_SOFTWARE' = 'HKEY_CURRENT_USER\SOFTWARE'
    'HKCR'          = 'HKEY_CLASSES_ROOT'
}

# Denylist rules: cada item tem Pattern, Mode, e (opcional) ExceptionPattern.
# Mode: 'exact-only' | 'wildcard' | 'wildcard-with-exception'
$script:DenylistRules = @(
    [pscustomobject]@{ Pattern = 'HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\*';             Mode = 'wildcard-with-exception'; ExceptionPattern = 'HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*' }
    [pscustomobject]@{ Pattern = 'HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\*';                         Mode = 'wildcard';                ExceptionPattern = $null }
    [pscustomobject]@{ Pattern = 'HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Cryptography\*';                       Mode = 'wildcard';                ExceptionPattern = $null }
    [pscustomobject]@{ Pattern = 'HKEY_LOCAL_MACHINE\SOFTWARE\Policies\*';                                     Mode = 'wildcard';                ExceptionPattern = $null }
    [pscustomobject]@{ Pattern = 'HKEY_LOCAL_MACHINE\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\*'; Mode = 'wildcard-with-exception'; ExceptionPattern = 'HKEY_LOCAL_MACHINE\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*' }
    [pscustomobject]@{ Pattern = 'HKEY_LOCAL_MACHINE\SOFTWARE\WOW6432Node\Microsoft\Windows NT\*';             Mode = 'wildcard';                ExceptionPattern = $null }
    [pscustomobject]@{ Pattern = 'HKEY_CLASSES_ROOT\CLSID';                                                    Mode = 'exact-only';              ExceptionPattern = $null }
    [pscustomobject]@{ Pattern = 'HKEY_CLASSES_ROOT\Interface';                                                Mode = 'exact-only';              ExceptionPattern = $null }
    [pscustomobject]@{ Pattern = 'HKEY_CLASSES_ROOT\TypeLib';                                                  Mode = 'exact-only';              ExceptionPattern = $null }
)

$script:MinTermLength = 4

# === Pure helpers ===

function Test-IsAdmin {
    [OutputType([bool])]
    param()
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Test-DangerousTerm {
    [OutputType([bool])]
    param([Parameter(Mandatory)] [string[]] $Termos)

    foreach ($term in $Termos) {
        if ([string]::IsNullOrWhiteSpace($term)) { continue }
        if ($term.Length -lt $script:MinTermLength) { return $true }
        $lower = $term.ToLowerInvariant()
        foreach ($danger in $script:DangerousTerms) {
            if ($lower.Contains($danger)) { return $true }
        }
    }
    return $false
}

function Resolve-HiveAlias {
    [OutputType([string])]
    param([Parameter(Mandatory)] [string] $Alias)

    if (-not $script:HiveAliases.ContainsKey($Alias)) {
        throw "Alias de hive desconhecido: '$Alias'. Aliases validos: $($script:HiveAliases.Keys -join ', ')"
    }
    return "Registry::$($script:HiveAliases[$Alias])"
}

function Test-PathInDenylist {
    [OutputType([bool])]
    param(
        [Parameter(Mandatory)] [string] $Path,
        [string[]] $UserExcludes = @()
    )

    foreach ($rule in $script:DenylistRules) {
        switch ($rule.Mode) {
            'exact-only' {
                if ($Path -ieq $rule.Pattern) { return $true }
            }
            'wildcard' {
                if ($Path -ilike $rule.Pattern) { return $true }
            }
            'wildcard-with-exception' {
                if (($Path -ilike $rule.Pattern) -and -not ($Path -ilike $rule.ExceptionPattern)) {
                    return $true
                }
            }
            default {
                throw "Modo de denylist desconhecido: $($rule.Mode)"
            }
        }
    }
    foreach ($pattern in $UserExcludes) {
        if ([string]::IsNullOrWhiteSpace($pattern)) { continue }
        if ($Path -ilike $pattern) { return $true }
    }
    return $false
}

function Get-ValueDataAsString {
    [OutputType([string[]])]
    param(
        [Parameter(Mandatory)] [string] $Kind,
        [object] $Data
    )

    switch ($Kind) {
        { $_ -in @('String', 'ExpandString') } {
            if ($null -eq $Data) { return @() }
            return @([string]$Data)
        }
        'MultiString' {
            if ($null -eq $Data) { return @() }
            return @(($Data -join "`n"))
        }
        'DWord' {
            if ($null -eq $Data) { return @() }
            $u = [uint32]$Data
            $hex = '0x' + $u.ToString('x')
            return @($u.ToString(), $hex)
        }
        'QWord' {
            if ($null -eq $Data) { return @() }
            $u = [uint64]$Data
            $hex = '0x' + $u.ToString('x')
            return @($u.ToString(), $hex)
        }
        'Binary' {
            if ($null -eq $Data) { return @() }
            $bytes = [byte[]]$Data
            $hex = ($bytes | ForEach-Object { $_.ToString('x2') }) -join '-'
            return @($hex)
        }
        default {
            return @()
        }
    }
}

function Optimize-MatchPlan {
    [OutputType([object[]])]
    param([Parameter(Mandatory)] [object[]] $Plan)

    $deleteKeyPaths = @($Plan | Where-Object { $_.Action -eq 'DeleteKey' } | ForEach-Object { $_.Path })

    function _IsUnderAncestor {
        param($path, $ancestors, $selfAllowed)
        foreach ($a in $ancestors) {
            if ($selfAllowed -and ($path -ieq $a)) { continue }
            if ($path -ilike "$a\*") { return $true }
        }
        return $false
    }

    $kept = New-Object System.Collections.Generic.List[object]
    foreach ($item in $Plan) {
        if ($item.Action -like 'Skip*') {
            $kept.Add($item) | Out-Null
            continue
        }
        $isUnder = _IsUnderAncestor -path $item.Path -ancestors $deleteKeyPaths -selfAllowed $true
        if ($isUnder) { continue }
        $kept.Add($item) | Out-Null
    }

    # Skips no fim, deletes ordenados por profundidade desc, path asc
    $sorted = $kept | Sort-Object @(
        @{ Expression = { if ($_.Action -like 'Skip*') { 1 } else { 0 } }; Ascending = $true }
        @{ Expression = { -(($_.Path -split '\\').Count) }; Ascending = $true }
        @{ Expression = { $_.Path }; Ascending = $true }
    )
    return @($sorted)
}

# === I/O functions ===

function _MatchTerm {
    param(
        [string]$Hay,
        [string[]]$TermsLower
    )
    if ([string]::IsNullOrEmpty($Hay)) { return $null }
    $hayLower = $Hay.ToLowerInvariant()
    foreach ($t in $TermsLower) {
        if ($hayLower.Contains($t)) { return $t }
    }
    return $null
}

function _VisitRegistryKey {
    param(
        $Path,
        $Depth,
        $MaxDepth,
        $TermsLower,
        $UserExcludes,
        $Results
    )

    if ($Depth -gt $MaxDepth) { return }

    $key = $null
    try {
        $key = Get-Item -LiteralPath $Path -ErrorAction Stop
    } catch {
        return
    }

    $canonical = $key.Name
    $denied = Test-PathInDenylist -Path $canonical -UserExcludes $UserExcludes
    $hive = ($canonical -split '\\')[0]
    $action = if ($denied) { 'Skip(denylist)' } else { $null }
    $reason = if ($denied) { 'Path em denylist' } else { $null }

    # Match no nome da chave
    $segs = $canonical -split '\\'
    $leafName = $segs[-1]
    $hitTerm = _MatchTerm -Hay $leafName -TermsLower $TermsLower
    if ($hitTerm) {
        $a = if ($denied) { 'Skip(denylist)' } else { 'DeleteKey' }
        $Results.Add([pscustomobject]@{
            Hive = $hive; Path = $canonical; Type = 'Key'; ValueName = $null
            MatchedOn = 'KeyName'; MatchedTerm = $hitTerm
            Action = $a; Reason = $reason
        }) | Out-Null
    }

    # Match em valores
    $valueNames = @()
    try { $valueNames = @($key.GetValueNames()) } catch { }

    foreach ($vname in $valueNames) {
        # Match no nome do valor (pula nome vazio = (default))
        if (-not [string]::IsNullOrEmpty($vname)) {
            $hitTerm = _MatchTerm -Hay $vname -TermsLower $TermsLower
            if ($hitTerm) {
                $a = if ($denied) { 'Skip(denylist)' } else { 'DeleteValue' }
                $Results.Add([pscustomobject]@{
                    Hive = $hive; Path = $canonical; Type = 'Value'; ValueName = $vname
                    MatchedOn = 'ValueName'; MatchedTerm = $hitTerm
                    Action = $a; Reason = $reason
                }) | Out-Null
            }
        }

        # Match no dado
        $vkind = $null
        $vdata = $null
        try {
            $vkind = $key.GetValueKind($vname).ToString()
            $vdata = $key.GetValue($vname)
        } catch { continue }

        $stringForms = @(Get-ValueDataAsString -Kind $vkind -Data $vdata)
        foreach ($form in $stringForms) {
            $hitTerm = _MatchTerm -Hay $form -TermsLower $TermsLower
            if ($hitTerm) {
                $a = if ($denied) { 'Skip(denylist)' } else { 'DeleteValue' }
                $displayName = if ([string]::IsNullOrEmpty($vname)) { '(default)' } else { $vname }
                $Results.Add([pscustomobject]@{
                    Hive = $hive; Path = $canonical; Type = 'Value'; ValueName = $displayName
                    MatchedOn = 'ValueData'; MatchedTerm = $hitTerm
                    Action = $a; Reason = $reason
                }) | Out-Null
                break
            }
        }
    }

    # Recursao
    $subNames = @()
    try { $subNames = @($key.GetSubKeyNames()) } catch { }
    foreach ($subName in $subNames) {
        $childPath = "$Path\$subName"
        _VisitRegistryKey -Path $childPath -Depth ($Depth + 1) `
            -MaxDepth $MaxDepth -TermsLower $TermsLower `
            -UserExcludes $UserExcludes -Results $Results
    }
}

function Find-RegistryMatches {
    [OutputType([object[]])]
    param(
        [Parameter(Mandatory)] [string] $HivePath,        # 'Registry::HKEY_...'
        [Parameter(Mandatory)] [string[]] $Termos,
        [int] $MaxDepth = 50,
        [string[]] $UserExcludes = @()
    )

    $results = New-Object 'System.Collections.Generic.List[object]'
    $termsLower = @($Termos | ForEach-Object { $_.ToLowerInvariant() })

    _VisitRegistryKey -Path $HivePath -Depth 0 `
        -MaxDepth $MaxDepth -TermsLower $termsLower `
        -UserExcludes $UserExcludes -Results $results

    # Comma operator forca array de qualquer tamanho (incluindo 0 e 1)
    , $results.ToArray()
}

# === Main flow ===

function Invoke-MainFlow {
    if (-not $Termo -or $Termo.Count -eq 0) {
        Write-Host "ERRO: parametro -Termo eh obrigatorio." -ForegroundColor Red
        exit 1
    }
    Write-Host "limpar-registros.ps1 - placeholder main flow" -ForegroundColor Cyan
    Write-Host "Termos: $($Termo -join ', ')"
    Write-Host "Hives: $($Hives -join ', ')"
    Write-Host "Apply: $Apply | Interactive: $Interactive | Force: $Force"
}

# Main-flow gate: skip when dot-sourced
if ($MyInvocation.InvocationName -ne '.') {
    Invoke-MainFlow
}
