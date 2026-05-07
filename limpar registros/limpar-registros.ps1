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

# === I/O functions (filled in subsequent tasks) ===

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
