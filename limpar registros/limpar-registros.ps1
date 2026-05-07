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

# === Pure helpers (filled in subsequent tasks) ===

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
