# limpar-registros.ps1 — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a single-file PowerShell 5.1 script that searches the Windows Registry for one or more terms (substring, case-insensitive) across configurable hives and deletes matching keys/values, mirroring the manual regedit Ctrl+F → Delete → F3 workflow, with dry-run-by-default safety, automatic .reg backup, embedded denylist, and dual `.log`/`.csv` reporting.

**Architecture:** Single file `limpar-registros.ps1` containing all functions plus a main-flow gate (`if ($MyInvocation.InvocationName -ne '.')`) so the file can be dot-sourced for testing without executing main. Per the approved spec, no Pester framework — validation is via inline sanity calls during development plus three end-to-end manual scenarios.

**Tech Stack:** PowerShell 5.1 (built-in), `reg.exe` (built-in), no external dependencies.

**Spec:** `docs/superpowers/specs/2026-05-07-limpar-registros-design.md`

---

## File structure

```
limpar registros/
  limpar-registros.ps1                          # Single-file script (functions + main flow gate)
  docs/
    superpowers/
      specs/2026-05-07-limpar-registros-design.md
      plans/2026-05-07-limpar-registros.md      # This document
  tests/
    sanity-checks.ps1                           # Hand-rolled sanity calls per function
    manual-scenarios.md                         # Step-by-step manual validation
  .gitignore                                    # Already exists; ignores output/
  output/                                       # Created at runtime, gitignored
```

The `limpar-registros.ps1` file is structured top-to-bottom as:

1. `[CmdletBinding()]` + `param(...)` block
2. `Set-StrictMode -Version Latest` + `$ErrorActionPreference = 'Stop'`
3. Constants (`$DenylistRules`, `$DangerousTerms`, `$HiveAliases`)
4. Pure helper functions (no side effects on registry/files)
5. I/O functions (registry mutation, file output)
6. Main-flow gate: `if ($MyInvocation.InvocationName -ne '.') { Invoke-MainFlow }`

Dot-sourcing (`. .\limpar-registros.ps1`) sets `InvocationName` to `.`, skipping the gate and exposing all functions for testing. Direct execution sets it to the file path or `&`, which falls through and runs `Invoke-MainFlow`.

**Note on `git add` paths:** All commit steps below assume the working directory is the project root `C:\Users\Renan\Desktop\clone\limpar registros\` (which is inside the `clone/` git repo). Paths in `git add` are relative to that working directory — `git` walks up to find the repo root automatically.

**Note on `Test-PathInDenylist` signature:** Spec describes the signature as `(path, rules)` for clarity. The implementation reads `$script:DenylistRules` directly (consistent with how other helpers reference `$script:` constants like `$DangerousTerms` and `$HiveAliases`). This is a deliberate single-file simplification — not a deviation in behavior.

---

## Chunk 1: Skeleton and pure helpers

This chunk builds the script skeleton and the side-effect-free helpers. Each function is committed in isolation with a sanity check.

### Task 1: Project skeleton

**Files:**
- Create: `limpar-registros.ps1`
- Create: `tests/sanity-checks.ps1`

- [ ] **Step 1.1: Write skeleton with param block and main-flow gate**

Create `limpar-registros.ps1` with:

```powershell
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
    [Parameter(Mandatory = $true)]
    [string[]] $Termo,

    [string[]] $Hives = @('HKLM_SOFTWARE', 'HKLM_WOW64', 'HKCU_SOFTWARE', 'HKCR'),

    [switch] $Apply,

    [switch] $Interactive,

    [switch] $Yes,

    [string[]] $Exclude = @(),

    [switch] $Force,

    [string] $OutDir = (Join-Path $PSScriptRoot 'output'),

    [int] $MaxDepth = 50
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# === Constants (filled in subsequent tasks) ===

# === Pure helpers (filled in subsequent tasks) ===

# === I/O functions (filled in subsequent tasks) ===

# === Main flow ===

function Invoke-MainFlow {
    Write-Host "limpar-registros.ps1 — placeholder main flow" -ForegroundColor Cyan
    Write-Host "Termos: $($Termo -join ', ')"
    Write-Host "Hives: $($Hives -join ', ')"
    Write-Host "Apply: $Apply | Interactive: $Interactive | Force: $Force"
}

# Main-flow gate: skip when dot-sourced
if ($MyInvocation.InvocationName -ne '.') {
    Invoke-MainFlow
}
```

- [ ] **Step 1.2: Create empty sanity-checks.ps1**

```powershell
# tests/sanity-checks.ps1
# Roda assercoes manuais nas funcoes puras de limpar-registros.ps1.
# Uso: pwsh -File .\tests\sanity-checks.ps1
#      ou: powershell.exe -File .\tests\sanity-checks.ps1

$ErrorActionPreference = 'Stop'
$scriptPath = Join-Path $PSScriptRoot '..\limpar-registros.ps1'
. $scriptPath  # dot-source — skips main-flow gate

$failures = 0
function Assert-Equal {
    param($Actual, $Expected, [string]$Label)
    if ($Actual -ne $Expected) {
        Write-Host "FAIL: $Label — esperado '$Expected', obteve '$Actual'" -ForegroundColor Red
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
```

- [ ] **Step 1.3: Run skeleton with required Termo param**

Run: `powershell.exe -ExecutionPolicy Bypass -File .\limpar-registros.ps1 -Termo autodesk`

Expected output:
```
limpar-registros.ps1 — placeholder main flow
Termos: autodesk
Hives: HKLM_SOFTWARE, HKLM_WOW64, HKCU_SOFTWARE, HKCR
Apply: False | Interactive: False | Force: False
```

- [ ] **Step 1.4: Run sanity-checks (no checks yet — should print "Todas...")**

Run: `powershell.exe -ExecutionPolicy Bypass -File .\tests\sanity-checks.ps1`

Expected: `Todas as assercoes passaram.`

- [ ] **Step 1.5: Commit**

Run all `git` commands below from the project root (`C:\Users\Renan\Desktop\clone\limpar registros\`).

```bash
git add limpar-registros.ps1 tests/sanity-checks.ps1
git commit -m "feat(limpar-registros): esqueleto do script + harness de sanity"
```

---

### Task 2: Constants — denylist, dangerous terms, hive aliases

**Files:**
- Modify: `limpar-registros.ps1` (constants section)
- Modify: `tests/sanity-checks.ps1`

- [ ] **Step 2.1: Add constants block**

Replace the `# === Constants ===` line with:

```powershell
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
    [pscustomobject]@{ Pattern = 'HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\*';            Mode = 'wildcard-with-exception'; ExceptionPattern = 'HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*' }
    [pscustomobject]@{ Pattern = 'HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\*';                        Mode = 'wildcard';                ExceptionPattern = $null }
    [pscustomobject]@{ Pattern = 'HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Cryptography\*';                      Mode = 'wildcard';                ExceptionPattern = $null }
    [pscustomobject]@{ Pattern = 'HKEY_LOCAL_MACHINE\SOFTWARE\Policies\*';                                    Mode = 'wildcard';                ExceptionPattern = $null }
    [pscustomobject]@{ Pattern = 'HKEY_LOCAL_MACHINE\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\*';Mode = 'wildcard-with-exception'; ExceptionPattern = 'HKEY_LOCAL_MACHINE\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*' }
    [pscustomobject]@{ Pattern = 'HKEY_LOCAL_MACHINE\SOFTWARE\WOW6432Node\Microsoft\Windows NT\*';            Mode = 'wildcard';                ExceptionPattern = $null }
    [pscustomobject]@{ Pattern = 'HKEY_CLASSES_ROOT\CLSID';                                                   Mode = 'exact-only';              ExceptionPattern = $null }
    [pscustomobject]@{ Pattern = 'HKEY_CLASSES_ROOT\Interface';                                               Mode = 'exact-only';              ExceptionPattern = $null }
    [pscustomobject]@{ Pattern = 'HKEY_CLASSES_ROOT\TypeLib';                                                 Mode = 'exact-only';              ExceptionPattern = $null }
)

$script:MinTermLength = 4
```

- [ ] **Step 2.2: Add sanity check for constants**

Append to `tests/sanity-checks.ps1` before the failures check:

```powershell
# --- Constants ---
Assert-Equal -Actual $script:DangerousTerms.Count -Expected 10 -Label 'DangerousTerms tem 10 itens'
Assert-Equal -Actual $script:HiveAliases['HKLM_SOFTWARE'] -Expected 'HKEY_LOCAL_MACHINE\SOFTWARE' -Label 'HiveAlias HKLM_SOFTWARE resolve correto'
Assert-Equal -Actual $script:HiveAliases['HKLM_WOW64'] -Expected 'HKEY_LOCAL_MACHINE\SOFTWARE\WOW6432Node' -Label 'HiveAlias HKLM_WOW64 resolve correto'
Assert-Equal -Actual $script:DenylistRules.Count -Expected 9 -Label 'DenylistRules tem 9 entradas'
```

- [ ] **Step 2.3: Run sanity checks**

Run: `powershell.exe -ExecutionPolicy Bypass -File .\tests\sanity-checks.ps1`

Expected: 4 OK lines + "Todas as assercoes passaram."

- [ ] **Step 2.4: Commit**

```bash
git add limpar-registros.ps1 tests/sanity-checks.ps1
git commit -m "feat(limpar-registros): constantes (denylist, termos perigosos, aliases)"
```

---

### Task 3: Test-IsAdmin

**Files:**
- Modify: `limpar-registros.ps1` (pure helpers section)

- [ ] **Step 3.1: Implement Test-IsAdmin**

Append to pure helpers section:

```powershell
function Test-IsAdmin {
    [OutputType([bool])]
    param()
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}
```

- [ ] **Step 3.2: Sanity check via prompt**

Skipped automated check — depends on session privilege. Manual: dot-source the script in a non-elevated prompt and call `Test-IsAdmin`. Expect `False`. Repeat in elevated prompt. Expect `True`.

- [ ] **Step 3.3: Commit**

```bash
git add limpar-registros.ps1
git commit -m "feat(limpar-registros): Test-IsAdmin"
```

---

### Task 4: Test-DangerousTerm

**Files:**
- Modify: `limpar-registros.ps1`
- Modify: `tests/sanity-checks.ps1`

- [ ] **Step 4.1: Add failing assertions for Test-DangerousTerm**

Append to `tests/sanity-checks.ps1`:

```powershell
# --- Test-DangerousTerm ---
Assert-True  -Condition (Test-DangerousTerm -Termos @('microsoft'))                  -Label 'microsoft eh perigoso'
Assert-True  -Condition (Test-DangerousTerm -Termos @('AutoCAD','windows'))          -Label 'um perigoso entre normais bloqueia'
Assert-True  -Condition (Test-DangerousTerm -Termos @('Microsoft Office'))           -Label 'substring perigosa bloqueia (case-insensitive)'
Assert-True  -Condition (Test-DangerousTerm -Termos @('ad'))                         -Label 'termo curto bloqueia'
Assert-False -Condition (Test-DangerousTerm -Termos @('autodesk'))                   -Label 'autodesk nao eh perigoso'
Assert-False -Condition (Test-DangerousTerm -Termos @('autocad','adobe'))            -Label 'lista normal nao bloqueia'
```

- [ ] **Step 4.2: Run sanity checks — expect failures**

Run: `powershell.exe -ExecutionPolicy Bypass -File .\tests\sanity-checks.ps1`

Expected: 6 FAIL lines (`Test-DangerousTerm not recognized`).

- [ ] **Step 4.3: Implement Test-DangerousTerm**

Append to pure helpers in `limpar-registros.ps1`:

```powershell
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
```

- [ ] **Step 4.4: Run sanity checks — expect pass**

Run: `powershell.exe -ExecutionPolicy Bypass -File .\tests\sanity-checks.ps1`

Expected: all OK.

- [ ] **Step 4.5: Commit**

```bash
git add limpar-registros.ps1 tests/sanity-checks.ps1
git commit -m "feat(limpar-registros): Test-DangerousTerm com gate de termo curto/perigoso"
```

---

### Task 5: Resolve-HiveAlias

**Files:**
- Modify: `limpar-registros.ps1`
- Modify: `tests/sanity-checks.ps1`

- [ ] **Step 5.1: Add failing assertions**

Append to `tests/sanity-checks.ps1`:

```powershell
# --- Resolve-HiveAlias ---
Assert-Equal -Actual (Resolve-HiveAlias -Alias 'HKLM_SOFTWARE') -Expected 'Registry::HKEY_LOCAL_MACHINE\SOFTWARE' -Label 'Alias HKLM_SOFTWARE'
Assert-Equal -Actual (Resolve-HiveAlias -Alias 'HKCR')          -Expected 'Registry::HKEY_CLASSES_ROOT'           -Label 'Alias HKCR'
Assert-Equal -Actual (Resolve-HiveAlias -Alias 'HKLM_WOW64')    -Expected 'Registry::HKEY_LOCAL_MACHINE\SOFTWARE\WOW6432Node' -Label 'Alias HKLM_WOW64'

$threw = $false
try { Resolve-HiveAlias -Alias 'HKLM_INVENTADO' } catch { $threw = $true }
Assert-True -Condition $threw -Label 'Alias invalido lanca excecao'
```

- [ ] **Step 5.2: Run sanity checks — expect failures**

Run: `powershell.exe -ExecutionPolicy Bypass -File .\tests\sanity-checks.ps1`

Expected: assertions for Resolve-HiveAlias fail.

- [ ] **Step 5.3: Implement Resolve-HiveAlias**

Append:

```powershell
function Resolve-HiveAlias {
    [OutputType([string])]
    param([Parameter(Mandatory)] [string] $Alias)

    if (-not $script:HiveAliases.ContainsKey($Alias)) {
        throw "Alias de hive desconhecido: '$Alias'. Aliases validos: $($script:HiveAliases.Keys -join ', ')"
    }
    return "Registry::$($script:HiveAliases[$Alias])"
}
```

- [ ] **Step 5.4: Run sanity checks — expect pass**

Run: `powershell.exe -ExecutionPolicy Bypass -File .\tests\sanity-checks.ps1`

Expected: all OK.

- [ ] **Step 5.5: Commit**

```bash
git add limpar-registros.ps1 tests/sanity-checks.ps1
git commit -m "feat(limpar-registros): Resolve-HiveAlias"
```

---

### Task 6: Test-PathInDenylist

**Files:**
- Modify: `limpar-registros.ps1`
- Modify: `tests/sanity-checks.ps1`

- [ ] **Step 6.1: Add failing assertions**

Append to `tests/sanity-checks.ps1`:

```powershell
# --- Test-PathInDenylist ---
# wildcard rules
Assert-True  -Condition (Test-PathInDenylist -Path 'HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\Foo')                        -Label 'wildcard: Windows NT bloqueado'
Assert-True  -Condition (Test-PathInDenylist -Path 'HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\X')                            -Label 'wildcard: Policies bloqueado'

# wildcard-with-exception: Uninstall liberado
Assert-True  -Condition (Test-PathInDenylist -Path 'HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Run')            -Label 'wildcard-exc: CurrentVersion\Run bloqueado'
Assert-False -Condition (Test-PathInDenylist -Path 'HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\Foo') -Label 'wildcard-exc: Uninstall\Foo liberado'
Assert-False -Condition (Test-PathInDenylist -Path 'HKEY_LOCAL_MACHINE\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\Bar') -Label 'wildcard-exc: WOW Uninstall liberado'

# exact-only: raiz protegida, subchaves liberadas
Assert-True  -Condition (Test-PathInDenylist -Path 'HKEY_CLASSES_ROOT\CLSID')                                                     -Label 'exact-only: CLSID raiz bloqueada'
Assert-False -Condition (Test-PathInDenylist -Path 'HKEY_CLASSES_ROOT\CLSID\{FOO}')                                               -Label 'exact-only: CLSID\{...} liberada'

# user exclude
Assert-True  -Condition (Test-PathInDenylist -Path 'HKEY_CURRENT_USER\SOFTWARE\Adobe\Acrobat\X' -UserExcludes @('*\Adobe\Acrobat\*')) -Label 'user-exclude bate'
Assert-False -Condition (Test-PathInDenylist -Path 'HKEY_CURRENT_USER\SOFTWARE\Adobe\Photoshop\X' -UserExcludes @('*\Adobe\Acrobat\*')) -Label 'user-exclude nao bate em path diferente'

# fora da denylist
Assert-False -Condition (Test-PathInDenylist -Path 'HKEY_LOCAL_MACHINE\SOFTWARE\Autodesk\REX')                                    -Label 'path normal nao bloqueado'
```

- [ ] **Step 6.2: Run sanity checks — expect failures**

Expected: assertions for Test-PathInDenylist fail.

- [ ] **Step 6.3: Implement Test-PathInDenylist**

Append:

```powershell
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
```

- [ ] **Step 6.4: Run sanity checks — expect pass**

- [ ] **Step 6.5: Commit**

```bash
git add limpar-registros.ps1 tests/sanity-checks.ps1
git commit -m "feat(limpar-registros): Test-PathInDenylist com 3 modos + user excludes"
```

---

### Task 7: Get-ValueDataAsString

**Files:**
- Modify: `limpar-registros.ps1`
- Modify: `tests/sanity-checks.ps1`

- [ ] **Step 7.1: Add failing assertions**

Append:

```powershell
# --- Get-ValueDataAsString ---
$dword = Get-ValueDataAsString -Kind 'DWord' -Data ([uint32]31)  # 0x1f
Assert-True -Condition ($dword -contains '31')   -Label 'DWord exporta decimal'
Assert-True -Condition ($dword -contains '0x1f') -Label 'DWord exporta hex 0x lowercase sem padding'

$qword = Get-ValueDataAsString -Kind 'QWord' -Data ([uint64]0xDEADBEEFCAFE)
Assert-True -Condition ($qword -contains '0xdeadbeefcafe') -Label 'QWord exporta hex lowercase com prefixo 0x'

$sz = Get-ValueDataAsString -Kind 'String' -Data 'Autodesk.REX.Loader'
Assert-True -Condition ($sz -contains 'Autodesk.REX.Loader') -Label 'String pass-through'

$multi = Get-ValueDataAsString -Kind 'MultiString' -Data @('foo', 'bar')
Assert-Equal -Actual $multi.Count -Expected 1 -Label 'MultiString concatena com newline'
Assert-True  -Condition ($multi[0] -match 'foo') -Label 'MultiString contem foo'
Assert-True  -Condition ($multi[0] -match 'bar') -Label 'MultiString contem bar'

$bin = Get-ValueDataAsString -Kind 'Binary' -Data ([byte[]]@(0x01, 0x02, 0xAB))
Assert-True -Condition ($bin -contains '01-02-ab') -Label 'Binary hex lowercase com hifen'

$none = Get-ValueDataAsString -Kind 'None' -Data $null
Assert-Equal -Actual $none.Count -Expected 0 -Label 'None retorna array vazio'
```

- [ ] **Step 7.2: Run sanity checks — expect failures**

- [ ] **Step 7.3: Implement Get-ValueDataAsString**

Append:

```powershell
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
            return @($u.ToString(), '0x' + $u.ToString('x'))
        }
        'QWord' {
            if ($null -eq $Data) { return @() }
            $u = [uint64]$Data
            return @($u.ToString(), '0x' + $u.ToString('x'))
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
```

- [ ] **Step 7.4: Run sanity checks — expect pass**

- [ ] **Step 7.5: Commit**

```bash
git add limpar-registros.ps1 tests/sanity-checks.ps1
git commit -m "feat(limpar-registros): Get-ValueDataAsString cobrindo 6 tipos REG_*"
```

---

### Task 8: Optimize-MatchPlan

**Files:**
- Modify: `limpar-registros.ps1`
- Modify: `tests/sanity-checks.ps1`

`Optimize-MatchPlan` recebe um array de match records e:
1. Descarta itens cujo path começa com o path de algum `DeleteKey` (ancestor já planejado pra apagar).
2. Ordena `DeleteKey` por profundidade decrescente (folhas primeiro).
3. Mantém `DeleteValue` antes de `DeleteKey` no mesmo path-pai.

Cada match record tem: `Hive, Path, Type ('Key'|'Value'), ValueName, MatchedOn, MatchedTerm, Action, Reason`.

- [ ] **Step 8.1: Add failing assertions**

Append:

```powershell
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

# Caso 1: dedup — DeleteValue dentro de DeleteKey deve sumir
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
# Apos dedup: B\C\D sai (esta sob B\C). Restam A e B\C, ambos profundidade 3.
# Ordem: profundidade decrescente, depois lexicografica.
Assert-Equal -Actual $result.Count -Expected 2 -Label 'Optimize: B\C\D removido por B\C ser ancestor'

# Caso 3: skip nao eh ordenado/dedupado
$plan = @(
    (New-FakeMatch -Path 'HKEY_LOCAL_MACHINE\SOFTWARE\X' -Action 'Skip(denylist)'),
    (New-FakeMatch -Path 'HKEY_LOCAL_MACHINE\SOFTWARE\Y' -Action 'DeleteKey')
)
$result = @(Optimize-MatchPlan -Plan $plan)
Assert-Equal -Actual $result.Count -Expected 2 -Label 'Optimize: Skip preservado'
```

- [ ] **Step 8.2: Run sanity checks — expect failures**

- [ ] **Step 8.3: Implement Optimize-MatchPlan**

Append:

```powershell
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
        # Itens que serao apagados em cascata por um ancestor DeleteKey
        $isUnder = _IsUnderAncestor -path $item.Path -ancestors $deleteKeyPaths -selfAllowed $true
        if ($isUnder) { continue }
        $kept.Add($item) | Out-Null
    }

    # Ordenacao: Skips no fim, deletes ordenados por profundidade desc, path asc
    $sorted = $kept | Sort-Object @(
        @{ Expression = { if ($_.Action -like 'Skip*') { 1 } else { 0 } }; Ascending = $true }
        @{ Expression = { -(($_.Path -split '\\').Count) }; Ascending = $true }
        @{ Expression = { $_.Path }; Ascending = $true }
    )
    return @($sorted)
}
```

- [ ] **Step 8.4: Run sanity checks — expect pass**

- [ ] **Step 8.5: Commit**

```bash
git add limpar-registros.ps1 tests/sanity-checks.ps1
git commit -m "feat(limpar-registros): Optimize-MatchPlan dedup + ordenacao por profundidade"
```

---

## Chunk 1 review checkpoint

After Task 8, the script has skeleton + 6 pure helpers, all sanity-checked. Stop here and have the plan reviewer audit Chunk 1 before proceeding to scanning + execution.

---

## Chunk 2: Scanning, execution, main flow, validation

### Task 9: Find-RegistryMatches

**Files:**
- Modify: `limpar-registros.ps1`
- Create: temporary fixture `HKCU\Software\TestLimparRegistros` for live varredura test

`Find-RegistryMatches` é a varredura recursiva de Fase 1. Recebe um hive resolvido + termos + maxdepth + denylist application; retorna match records.

- [ ] **Step 9.1: Implement Find-RegistryMatches**

Append:

```powershell
function Find-RegistryMatches {
    [OutputType([object[]])]
    param(
        [Parameter(Mandatory)] [string] $HivePath,        # 'Registry::HKEY_...'
        [Parameter(Mandatory)] [string[]] $Termos,
        [int] $MaxDepth = 50,
        [string[]] $UserExcludes = @()
    )

    $results = New-Object System.Collections.Generic.List[object]
    $termosLower = $Termos | ForEach-Object { $_.ToLowerInvariant() }

    function _Match {
        param([string]$Hay)
        if ([string]::IsNullOrEmpty($Hay)) { return $null }
        $hayLower = $Hay.ToLowerInvariant()
        foreach ($t in $termosLower) {
            if ($hayLower.Contains($t)) { return $t }
        }
        return $null
    }

    function _Visit {
        param([string]$Path, [int]$Depth)
        if ($Depth -gt $MaxDepth) { return }

        $key = $null
        try {
            $key = Get-Item -LiteralPath $Path -ErrorAction Stop
        } catch {
            return
        }

        # Path canonicalizado (remove prefixo Registry::)
        $canonical = $key.Name  # ex: HKEY_LOCAL_MACHINE\SOFTWARE\Foo
        $denied = Test-PathInDenylist -Path $canonical -UserExcludes $UserExcludes
        $hive = ($canonical -split '\\')[0]

        # Match no nome da chave (ultimo segmento)
        $segs = $canonical -split '\\'
        $leafName = $segs[-1]
        $hitTerm = _Match -Hay $leafName
        if ($hitTerm) {
            $action = if ($denied) { 'Skip(denylist)' } else { 'DeleteKey' }
            $results.Add([pscustomobject]@{
                Hive = $hive; Path = $canonical; Type = 'Key'; ValueName = $null
                MatchedOn = 'KeyName'; MatchedTerm = $hitTerm
                Action = $action; Reason = if ($denied) { 'Path em denylist' } else { $null }
            }) | Out-Null
        }

        # Match em valores (nome e dado)
        try {
            $valueNames = $key.GetValueNames()
        } catch { $valueNames = @() }

        foreach ($vname in $valueNames) {
            # Match no nome do valor — pular nome vazio ((default)/(Padrao))
            if (-not [string]::IsNullOrEmpty($vname)) {
                $hitTerm = _Match -Hay $vname
                if ($hitTerm) {
                    $action = if ($denied) { 'Skip(denylist)' } else { 'DeleteValue' }
                    $results.Add([pscustomobject]@{
                        Hive = $hive; Path = $canonical; Type = 'Value'; ValueName = $vname
                        MatchedOn = 'ValueName'; MatchedTerm = $hitTerm
                        Action = $action; Reason = if ($denied) { 'Path em denylist' } else { $null }
                    }) | Out-Null
                }
            }

            # Match no dado do valor (sempre, inclusive (default))
            try {
                $vkind = $key.GetValueKind($vname).ToString()
                $vdata = $key.GetValue($vname, $null, [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
            } catch { continue }

            $stringForms = Get-ValueDataAsString -Kind $vkind -Data $vdata
            foreach ($form in $stringForms) {
                $hitTerm = _Match -Hay $form
                if ($hitTerm) {
                    $action = if ($denied) { 'Skip(denylist)' } else { 'DeleteValue' }
                    $results.Add([pscustomobject]@{
                        Hive = $hive; Path = $canonical; Type = 'Value'
                        ValueName = if ([string]::IsNullOrEmpty($vname)) { '(default)' } else { $vname }
                        MatchedOn = 'ValueData'; MatchedTerm = $hitTerm
                        Action = $action; Reason = if ($denied) { 'Path em denylist' } else { $null }
                    }) | Out-Null
                    break  # nao criar duplicatas se decimal e hex casarem
                }
            }
        }

        # Recursao
        try {
            foreach ($subName in $key.GetSubKeyNames()) {
                _Visit -Path (Join-Path $Path $subName) -Depth ($Depth + 1)
            }
        } catch { return }
    }

    _Visit -Path $HivePath -Depth 0
    return @($results)
}
```

- [ ] **Step 9.2: Live sanity check via fixture**

In an elevated PowerShell prompt, run a one-shot probe (not added to sanity-checks.ps1 since it mutates registry):

```powershell
# Setup fixture
$fix = 'HKCU:\Software\TestLimparRegistros'
if (Test-Path $fix) { Remove-Item -Recurse -Force $fix }
New-Item -Path $fix -Force | Out-Null
New-Item -Path "$fix\autodesk-key" -Force | Out-Null
New-ItemProperty -Path $fix -Name 'AutodeskValueName' -Value 'foo' -Force | Out-Null
New-ItemProperty -Path $fix -Name 'plain' -Value 'contains autodesk in data' -Force | Out-Null
New-ItemProperty -Path "$fix\autodesk-key" -Name '(default)' -Value 'data with Autodesk' -Force | Out-Null

# Probe
. .\limpar-registros.ps1
$matches = Find-RegistryMatches -HivePath 'Registry::HKEY_CURRENT_USER\Software\TestLimparRegistros' -Termos @('autodesk')
$matches | Format-Table Path, Type, ValueName, MatchedOn, Action -AutoSize
```

Expected: 4 matches:
1. KeyName match em `...\TestLimparRegistros\autodesk-key` → DeleteKey
2. ValueName match em `AutodeskValueName` → DeleteValue
3. ValueData match em `plain` → DeleteValue
4. ValueData match em `(default)` da subchave → DeleteValue

- [ ] **Step 9.3: Cleanup fixture**

```powershell
Remove-Item -Recurse -Force 'HKCU:\Software\TestLimparRegistros'
```

- [ ] **Step 9.4: Commit**

```bash
git add limpar-registros.ps1
git commit -m "feat(limpar-registros): Find-RegistryMatches varredura recursiva"
```

---

### Task 10: Export-RegistryBackup

**Files:**
- Modify: `limpar-registros.ps1`

- [ ] **Step 10.1: Implement Export-RegistryBackup**

Append:

```powershell
function Export-RegistryBackup {
    [OutputType([string])]
    param(
        [Parameter(Mandatory)] [object[]] $Plan,
        [Parameter(Mandatory)] [string] $OutDir,
        [Parameter(Mandatory)] [string] $Timestamp
    )

    # Coletar set unico de chaves a tocar (para DeleteKey: a propria; para DeleteValue: a chave pai)
    $keysToBackup = New-Object System.Collections.Generic.HashSet[string]
    foreach ($item in $Plan) {
        if ($item.Action -notlike 'Delete*') { continue }
        $null = $keysToBackup.Add($item.Path)  # Path eh sempre a chave (mesmo pra DeleteValue)
    }

    if ($keysToBackup.Count -eq 0) { return $null }

    $backupDir = Join-Path $OutDir "backup-$Timestamp"
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

    $manifestLines = New-Object System.Collections.Generic.List[string]
    $manifestLines.Add("# Backup gerado em $Timestamp") | Out-Null
    $manifestLines.Add("# Cada .reg cobre uma chave inteira (subarvore). Restaure via duplo-clique ou:")  | Out-Null
    $manifestLines.Add("# for %f in (*.reg) do reg import `"%f`"") | Out-Null
    $manifestLines.Add("") | Out-Null

    $i = 0
    foreach ($keyPath in $keysToBackup) {
        $i++
        # Nome de arquivo seguro
        $safe = $keyPath -replace '[\\:*?"<>|]', '_'
        if ($safe.Length -gt 180) { $safe = $safe.Substring(0, 180) }
        $hashInput = [System.Text.Encoding]::UTF8.GetBytes($keyPath)
        $hash = [System.BitConverter]::ToString(([System.Security.Cryptography.SHA1]::Create()).ComputeHash($hashInput)).Replace('-', '').Substring(0, 8).ToLower()
        $fname = "{0:D4}_{1}_{2}.reg" -f $i, $safe, $hash
        $fullOut = Join-Path $backupDir $fname

        # reg.exe export usa formato HKLM\... (sem Registry::)
        & reg.exe export $keyPath $fullOut /y 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "Falha ao exportar '$keyPath' (reg.exe exit $LASTEXITCODE). Backup abortado."
        }
        $manifestLines.Add("$fname  =>  $keyPath") | Out-Null
    }

    $manifestPath = Join-Path $backupDir 'manifest.txt'
    [System.IO.File]::WriteAllLines($manifestPath, $manifestLines, [System.Text.UTF8Encoding]::new($true))

    # Aviso se backup total > 100MB (spec)
    $totalBytes = (Get-ChildItem -LiteralPath $backupDir -File | Measure-Object -Sum Length).Sum
    if ($totalBytes -gt 100MB) {
        $mb = [math]::Round($totalBytes / 1MB, 1)
        Write-Host "AVISO: backup total $mb MB (> 100MB). Espaco em disco e tempo de import podem ser significativos." -ForegroundColor Yellow
    }

    return $backupDir
}
```

- [ ] **Step 10.2: Live sanity check**

```powershell
$fix = 'HKCU:\Software\TestLimparBackup'
if (Test-Path $fix) { Remove-Item -Recurse -Force $fix }
New-Item -Path $fix -Force | Out-Null
New-ItemProperty -Path $fix -Name 'foo' -Value 'bar' -Force | Out-Null

. .\limpar-registros.ps1
$plan = @(
    [pscustomobject]@{ Path = 'HKEY_CURRENT_USER\Software\TestLimparBackup'; Action = 'DeleteKey'; Type = 'Key' }
)
$ts = '2026-05-07-test'
$out = Join-Path $env:TEMP 'limpar-test'
if (Test-Path $out) { Remove-Item -Recurse -Force $out }
New-Item -ItemType Directory -Path $out -Force | Out-Null
$dir = Export-RegistryBackup -Plan $plan -OutDir $out -Timestamp $ts
Get-ChildItem $dir
Get-Content (Join-Path $dir 'manifest.txt')
Remove-Item -Recurse -Force $fix
Remove-Item -Recurse -Force $out
```

Expected: pasta `backup-2026-05-07-test/` contém 1 `.reg` + `manifest.txt`. Manifest tem cabeçalho + linha mapeando arquivo → chave.

- [ ] **Step 10.3: Commit**

```bash
git add limpar-registros.ps1
git commit -m "feat(limpar-registros): Export-RegistryBackup com 1 .reg por chave + manifest"
```

---

### Task 11: Show-ConfirmPrompt and Show-InteractivePrompt

**Files:**
- Modify: `limpar-registros.ps1`

- [ ] **Step 11.1: Implement Show-ConfirmPrompt**

Append:

```powershell
function Show-ConfirmPrompt {
    [OutputType([bool])]
    param(
        [Parameter(Mandatory)] [object[]] $Plan,
        [Parameter(Mandatory)] [string] $BackupDir,
        [switch] $BypassYes
    )

    $deleteKey = ($Plan | Where-Object { $_.Action -eq 'DeleteKey' }).Count
    $deleteVal = ($Plan | Where-Object { $_.Action -eq 'DeleteValue' }).Count
    $skips = ($Plan | Where-Object { $_.Action -like 'Skip*' }).Count

    Write-Host ""
    Write-Host "Vai apagar $deleteKey chaves e $deleteVal valores." -ForegroundColor Yellow
    Write-Host "Backup em: $BackupDir"
    Write-Host "Skips: $skips (ver report.log)"

    $total = $deleteKey + $deleteVal
    if ($total -gt 5000) {
        Write-Host ""
        Write-Host "AVISO: Plano grande ($total itens). Recomendado revisar report.csv antes de confirmar." -ForegroundColor Red
    }

    if ($BypassYes) {
        Write-Host "(-Yes informado, pulando prompt)" -ForegroundColor DarkGray
        return $true
    }

    Write-Host ""
    Write-Host "Pra confirmar, digite APAGAR (em maiusculas):" -NoNewline
    Write-Host " " -NoNewline
    $input = Read-Host
    return ($input -ceq 'APAGAR')
}
```

- [ ] **Step 11.2: Implement Show-InteractivePrompt**

Append:

```powershell
function Show-InteractivePrompt {
    [OutputType([string])]
    param([Parameter(Mandatory)] [object] $Item)

    $desc = if ($Item.Type -eq 'Key') {
        "[Key]   $($Item.Path)"
    } else {
        "[Value] $($Item.Path) value=`"$($Item.ValueName)`""
    }
    Write-Host ""
    Write-Host $desc -ForegroundColor Yellow
    Write-Host "  Match: $($Item.MatchedOn)='$($Item.MatchedTerm)'"
    while ($true) {
        Write-Host "  [s]im / [n]ao / [a]plicar tudo / [q]uit: " -NoNewline
        $r = Read-Host
        switch ($r.ToLowerInvariant()) {
            's' { return 's' }
            'n' { return 'n' }
            'a' { return 'a' }
            'q' { return 'q' }
            default { Write-Host "    Opcao invalida." -ForegroundColor Red }
        }
    }
}
```

- [ ] **Step 11.3: Manual sanity (opcional)**

Pode chamar diretamente em prompt elevado pra ver fluxo. Sem assertion automatizada.

- [ ] **Step 11.4: Commit**

```bash
git add limpar-registros.ps1
git commit -m "feat(limpar-registros): Show-ConfirmPrompt e Show-InteractivePrompt"
```

---

### Task 12: Invoke-DeletionPlan

**Files:**
- Modify: `limpar-registros.ps1`

- [ ] **Step 12.1: Implement Invoke-DeletionPlan**

Append:

```powershell
function Invoke-DeletionPlan {
    [OutputType([object[]])]
    param(
        [Parameter(Mandatory)] [object[]] $Plan,
        [switch] $Interactive
    )

    $applyAll = -not $Interactive  # se nao interativo, aplica tudo direto
    $userQuit = $false
    $errorCount = 0

    foreach ($item in $Plan) {
        if ($userQuit) { break }
        if ($item.Action -like 'Skip*') { continue }

        if ($Interactive -and -not $applyAll) {
            $resp = Show-InteractivePrompt -Item $item
            switch ($resp) {
                'n' { $item.Action = 'Skip(user)'; $item.Reason = 'pulado pelo usuario'; continue }
                'a' { $applyAll = $true }
                'q' { $userQuit = $true; continue }
                's' { } # cai pra delete
            }
        }

        try {
            $registryPath = "Registry::$($item.Path)"
            if ($item.Type -eq 'Key') {
                Remove-Item -LiteralPath $registryPath -Recurse -Force -ErrorAction Stop
            } else {
                Remove-ItemProperty -LiteralPath $registryPath -Name $item.ValueName -Force -ErrorAction Stop
            }
            $item.Action = if ($item.Type -eq 'Key') { 'Deleted(Key)' } else { 'Deleted(Value)' }
        } catch {
            $errorCount++
            $msg = $_.Exception.Message
            $reason = if ($msg -match 'access|denied|denegado|negado') { 'AccessDenied' }
                      elseif ($msg -match 'use|process|outro processo') { 'InUse' }
                      elseif ($msg -match 'not found|nao foi encontrado|cannot find') { 'NotFound' }
                      else { 'Other' }
            $item.Action = "Skip($reason)"
            $item.Reason = $msg
        }
    }

    return @{
        Plan = $Plan
        ErrorCount = $errorCount
        UserQuit = $userQuit
    }
}
```

- [ ] **Step 12.2: Live sanity (opcional, em chave de teste)**

```powershell
# Setup
$fix = 'HKCU:\Software\TestLimparDelete'
if (Test-Path $fix) { Remove-Item -Recurse -Force $fix }
New-Item -Path $fix -Force | Out-Null
New-ItemProperty -Path $fix -Name 'foo' -Value 'bar' -Force | Out-Null

. .\limpar-registros.ps1
$plan = @(
    [pscustomobject]@{ Path = 'HKEY_CURRENT_USER\Software\TestLimparDelete'; Type = 'Value'; ValueName = 'foo'; Action = 'DeleteValue'; Reason = $null; Hive='HKEY_CURRENT_USER'; MatchedOn='ValueData'; MatchedTerm='bar' }
)
$result = Invoke-DeletionPlan -Plan $plan
$result.ErrorCount  # 0
$result.Plan[0].Action  # 'Deleted(Value)'
Test-Path $fix  # ainda existe (so o valor sumiu)
(Get-Item $fix).GetValueNames()  # vazio
Remove-Item -Recurse -Force $fix
```

- [ ] **Step 12.3: Commit**

```bash
git add limpar-registros.ps1
git commit -m "feat(limpar-registros): Invoke-DeletionPlan com classificacao de erro"
```

---

### Task 13: Write-Report (.log + .csv)

**Files:**
- Modify: `limpar-registros.ps1`

- [ ] **Step 13.1: Implement Write-Report**

Append:

```powershell
function Write-Report {
    param(
        [Parameter(Mandatory)] [object[]] $Plan,
        [Parameter(Mandatory)] [string] $OutDir,
        [Parameter(Mandatory)] [string] $Timestamp,
        [Parameter(Mandatory)] [string] $Mode,            # 'dry-run' | 'apply' | 'interactive'
        [Parameter(Mandatory)] [string[]] $Termos,
        [Parameter(Mandatory)] [string[]] $HiveLabels,
        [string] $BackupDir = $null
    )

    $logPath = Join-Path $OutDir "report-$Timestamp.log"
    $csvPath = Join-Path $OutDir "report-$Timestamp.csv"

    $deleteKey = ($Plan | Where-Object { $_.Action -eq 'DeleteKey' -or $_.Action -eq 'Deleted(Key)' }).Count
    $deleteVal = ($Plan | Where-Object { $_.Action -eq 'DeleteValue' -or $_.Action -eq 'Deleted(Value)' }).Count
    $skipDeny  = ($Plan | Where-Object { $_.Action -eq 'Skip(denylist)' }).Count
    $skipErr   = ($Plan | Where-Object { $_.Action -like 'Skip(*' -and $_.Action -ne 'Skip(denylist)' -and $_.Action -ne 'Skip(user)' }).Count
    $skipUser  = ($Plan | Where-Object { $_.Action -eq 'Skip(user)' }).Count

    # --- LOG ---
    $log = New-Object System.Collections.Generic.List[string]
    $log.Add("limpar-registros.ps1 — $Timestamp") | Out-Null
    $log.Add("Modo: $Mode") | Out-Null
    $log.Add("Termos: $($Termos -join ', ')") | Out-Null
    $log.Add("Hives: $($HiveLabels -join ', ')") | Out-Null
    $log.Add("Backup: $(if ($BackupDir) { $BackupDir } else { 'nenhum em dry-run' })") | Out-Null
    $log.Add("") | Out-Null
    $log.Add("Sumario:") | Out-Null
    $log.Add("  Chaves a apagar/apagadas: $deleteKey") | Out-Null
    $log.Add("  Valores a apagar/apagados: $deleteVal") | Out-Null
    $log.Add("  Pulados (denylist):       $skipDeny") | Out-Null
    $log.Add("  Pulados (usuario):        $skipUser") | Out-Null
    $log.Add("  Pulados (erro):           $skipErr") | Out-Null
    $log.Add("") | Out-Null

    $byHive = $Plan | Group-Object Hive
    foreach ($g in $byHive) {
        $log.Add("=== $($g.Name) ===") | Out-Null
        foreach ($it in $g.Group) {
            $tag = "[$($it.Action)]"
            if ($it.Type -eq 'Key') {
                $log.Add("$tag $($it.Path)   (matched: $($it.MatchedOn)='$($it.MatchedTerm)')") | Out-Null
            } else {
                $log.Add("$tag $($it.Path) value=`"$($it.ValueName)`" (matched: $($it.MatchedOn)='$($it.MatchedTerm)')") | Out-Null
            }
            if ($it.Reason) { $log.Add("    Reason: $($it.Reason)") | Out-Null }
        }
        $log.Add("") | Out-Null
    }

    [System.IO.File]::WriteAllLines($logPath, $log, [System.Text.UTF8Encoding]::new($true))

    # --- CSV ---
    $csv = New-Object System.Collections.Generic.List[string]
    $csv.Add('Hive;Path;Type;ValueName;MatchedOn;MatchedTerm;Action;Reason') | Out-Null
    foreach ($it in $Plan) {
        $row = @(
            $it.Hive, $it.Path, $it.Type, $it.ValueName,
            $it.MatchedOn, $it.MatchedTerm, $it.Action, $it.Reason
        ) | ForEach-Object {
            $s = if ($null -eq $_) { '' } else { [string]$_ }
            if ($s -match '[;"\r\n]') { '"' + ($s -replace '"', '""') + '"' } else { $s }
        }
        $csv.Add(($row -join ';')) | Out-Null
    }
    [System.IO.File]::WriteAllLines($csvPath, $csv, [System.Text.UTF8Encoding]::new($true))

    return [pscustomobject]@{ LogPath = $logPath; CsvPath = $csvPath }
}
```

- [ ] **Step 13.2: Sanity check com plano sintético**

```powershell
. .\limpar-registros.ps1
$plan = @(
    [pscustomobject]@{ Hive='HKLM'; Path='HKLM\SOFTWARE\Test'; Type='Key'; ValueName=$null; MatchedOn='KeyName'; MatchedTerm='test'; Action='DeleteKey'; Reason=$null },
    [pscustomobject]@{ Hive='HKCU'; Path='HKCU\SOFTWARE\X';    Type='Value'; ValueName='val;with;semis'; MatchedOn='ValueName'; MatchedTerm='val'; Action='DeleteValue'; Reason=$null },
    [pscustomobject]@{ Hive='HKCU'; Path='HKCU\SOFTWARE\Y';    Type='Key'; ValueName=$null; MatchedOn='KeyName'; MatchedTerm='y'; Action='Skip(denylist)'; Reason='proibida' }
)
$out = Join-Path $env:TEMP 'limpar-report-test'
if (Test-Path $out) { Remove-Item -Recurse -Force $out }
New-Item -ItemType Directory -Path $out -Force | Out-Null
$r = Write-Report -Plan $plan -OutDir $out -Timestamp 'test' -Mode 'dry-run' -Termos @('test') -HiveLabels @('HKLM\SOFTWARE')
Get-Content $r.LogPath
Get-Content $r.CsvPath
Remove-Item -Recurse -Force $out
```

Esperado:
- `.log` tem cabeçalho com `Modo: dry-run`, sumário com 1 chave + 1 valor + 1 skip(denylist), seção `=== HKLM ===` e `=== HKCU ===`.
- `.csv` tem header `Hive;Path;...`. A linha do `val;with;semis` está quotada com aspas: `"val;with;semis"`. Sem quoting onde não há `;`/`"`.

- [ ] **Step 13.3: Commit**

```bash
git add limpar-registros.ps1
git commit -m "feat(limpar-registros): Write-Report (.log + .csv com delimitador ';')"
```

---

### Task 14: Invoke-SelfElevate

**Files:**
- Modify: `limpar-registros.ps1`

- [ ] **Step 14.1: Implement Invoke-SelfElevate**

Append:

```powershell
function Invoke-SelfElevate {
    param(
        [Parameter(Mandatory)] [string] $ScriptPath,
        [Parameter(Mandatory)] [hashtable] $BoundParams
    )

    # Reconstroi argumentos a partir de BoundParams
    $argList = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$ScriptPath`"")
    foreach ($k in $BoundParams.Keys) {
        $v = $BoundParams[$k]
        if ($v -is [switch]) {
            if ($v.IsPresent) { $argList += "-$k" }
        } elseif ($v -is [array]) {
            $argList += "-$k"
            $argList += ($v | ForEach-Object { "`"$_`"" }) -join ','
        } else {
            $argList += "-$k"
            $argList += "`"$v`""
        }
    }

    try {
        $proc = Start-Process -FilePath 'powershell.exe' -ArgumentList $argList -Verb RunAs -Wait -PassThru -ErrorAction Stop
        return $proc.ExitCode
    } catch {
        Write-Host "Falha ao auto-elevar: $($_.Exception.Message)" -ForegroundColor Red
        return 1
    }
}
```

- [ ] **Step 14.2: Commit**

```bash
git add limpar-registros.ps1
git commit -m "feat(limpar-registros): Invoke-SelfElevate via UAC com propagacao de exit code"
```

---

### Task 15: Wire up Invoke-MainFlow

**Files:**
- Modify: `limpar-registros.ps1` (replace placeholder Invoke-MainFlow)

- [ ] **Step 15.1: Replace Invoke-MainFlow with full pipeline**

Replace the placeholder `Invoke-MainFlow` function with:

```powershell
function Invoke-MainFlow {
    # === Fase 0: pre-condicoes ===

    # 0.1: Resolver -OutDir absoluto
    $absOutDir = [System.IO.Path]::GetFullPath($OutDir)

    # 0.2: Eleve se nao admin
    if (-not (Test-IsAdmin)) {
        Write-Host "Elevando privilegios via UAC..." -ForegroundColor Cyan
        # Inclui -OutDir absoluto pra sobreviver a mudanca de CWD
        $bp = @{} + $PSBoundParameters
        $bp['OutDir'] = $absOutDir
        $code = Invoke-SelfElevate -ScriptPath $PSCommandPath -BoundParams $bp
        exit $code
    }

    # 0.3: stdin nao-interativo + apply sem -Yes
    if ($Apply -and -not $Yes -and [Console]::IsInputRedirected) {
        Write-Host "ERRO: stdin nao-interativo com -Apply requer -Yes." -ForegroundColor Red
        exit 1
    }

    # 0.4 + 0.5: validar termos
    if (Test-DangerousTerm -Termos $Termo) {
        if (-not $Force) {
            Write-Host "ERRO: termo perigoso ou < $script:MinTermLength chars detectado. Use -Force pra prosseguir." -ForegroundColor Red
            exit 2
        }
        Write-Host "AVISO: -Force ativo, ignorando gate de termo perigoso/curto." -ForegroundColor Yellow
    }

    # 0.6: resolver hives
    $hivePaths = $Hives | ForEach-Object { Resolve-HiveAlias -Alias $_ }
    $hiveLabels = $Hives | ForEach-Object { $script:HiveAliases[$_] }

    # 0.7: criar OutDir
    if (-not (Test-Path $absOutDir)) {
        try { New-Item -ItemType Directory -Path $absOutDir -Force | Out-Null }
        catch { Write-Host "ERRO: nao consegui criar OutDir '$absOutDir': $_" -ForegroundColor Red; exit 1 }
    }

    $timestamp = Get-Date -Format 'yyyy-MM-dd-HHmmss'
    $mode = if ($Apply) { 'apply' } elseif ($Interactive) { 'interactive' } else { 'dry-run' }

    Write-Host ""
    Write-Host "=== limpar-registros ===" -ForegroundColor Cyan
    Write-Host "Modo: $mode | Termos: $($Termo -join ', ')"
    Write-Host "Hives: $($hiveLabels -join ', ')"
    Write-Host ""

    # === Fase 1: varredura ===
    Write-Host "Varrendo registro..." -ForegroundColor Cyan
    $allMatches = New-Object System.Collections.Generic.List[object]
    for ($i = 0; $i -lt $hivePaths.Count; $i++) {
        Write-Host "  [$($i+1)/$($hivePaths.Count)] $($hiveLabels[$i])"
        $hits = Find-RegistryMatches -HivePath $hivePaths[$i] -Termos $Termo -MaxDepth $MaxDepth -UserExcludes $Exclude
        foreach ($h in $hits) { $allMatches.Add($h) | Out-Null }
    }

    # === Fase 2: otimizar ===
    $plan = Optimize-MatchPlan -Plan $allMatches.ToArray()

    $deleteCount = ($plan | Where-Object { $_.Action -like 'Delete*' }).Count
    Write-Host ""
    Write-Host "Encontrados $deleteCount itens a apagar (mais $($allMatches.Count - $deleteCount - ($plan | Where-Object { $_.Action -like 'Skip*' }).Count) deduplicados, $(($plan | Where-Object { $_.Action -like 'Skip*' }).Count) skips)." -ForegroundColor Cyan

    # Dry-run: gera relatorio e sai
    if (-not $Apply -and -not $Interactive) {
        $r = Write-Report -Plan $plan -OutDir $absOutDir -Timestamp $timestamp -Mode 'dry-run' -Termos $Termo -HiveLabels $hiveLabels
        Write-Host "Relatorio: $($r.LogPath)" -ForegroundColor Green
        Write-Host "CSV:       $($r.CsvPath)" -ForegroundColor Green
        exit 0
    }

    # === Fase 3: backup ===
    $backupDir = $null
    if ($Apply -and $deleteCount -gt 0) {
        Write-Host "Criando backup..." -ForegroundColor Cyan
        try {
            $backupDir = Export-RegistryBackup -Plan $plan -OutDir $absOutDir -Timestamp $timestamp
            Write-Host "Backup: $backupDir" -ForegroundColor Green
        } catch {
            Write-Host "ERRO no backup: $_" -ForegroundColor Red
            Write-Report -Plan $plan -OutDir $absOutDir -Timestamp $timestamp -Mode 'apply-aborted' -Termos $Termo -HiveLabels $hiveLabels | Out-Null
            exit 3
        }
    }

    # === Fase 4: confirmacao ===
    if ($Apply) {
        $ok = Show-ConfirmPrompt -Plan $plan -BackupDir $backupDir -BypassYes:$Yes
        if (-not $ok) {
            Write-Host "Cancelado pelo usuario." -ForegroundColor Yellow
            Write-Report -Plan $plan -OutDir $absOutDir -Timestamp $timestamp -Mode 'cancelled' -Termos $Termo -HiveLabels $hiveLabels -BackupDir $backupDir | Out-Null
            exit 130
        }
    }

    # === Fase 5: execucao ===
    Write-Host ""
    Write-Host "Executando..." -ForegroundColor Cyan
    $exec = Invoke-DeletionPlan -Plan $plan -Interactive:$Interactive

    # === Fase 6: relatorio ===
    $r = Write-Report -Plan $exec.Plan -OutDir $absOutDir -Timestamp $timestamp -Mode $mode -Termos $Termo -HiveLabels $hiveLabels -BackupDir $backupDir
    Write-Host ""
    Write-Host "Relatorio: $($r.LogPath)" -ForegroundColor Green
    Write-Host "CSV:       $($r.CsvPath)" -ForegroundColor Green

    if ($exec.ErrorCount -gt 0) { exit 4 } else { exit 0 }
}
```

- [ ] **Step 15.2: Smoke test em modo dry-run**

```powershell
# Em prompt elevado:
cd "C:\Users\Renan\Desktop\clone\limpar registros"
.\limpar-registros.ps1 -Termo nonexistentterm12345 -Hives HKCU_SOFTWARE
```

Expected: varredura roda, encontra 0 matches, gera report-XXX.log e .csv em `output/`, exit 0.

- [ ] **Step 15.3: Commit**

```bash
git add limpar-registros.ps1
git commit -m "feat(limpar-registros): wire up Invoke-MainFlow (Fases 0-6)"
```

---

### Task 16: Manual validation scenarios

**Files:**
- Create: `tests/manual-scenarios.md`

- [ ] **Step 16.1: Document the three scenarios from spec**

Create `tests/manual-scenarios.md`:

```markdown
# Cenarios de validacao manual

Rodar **em prompt elevado** (`Run as administrator`).

## Cenario 1: Dry-run em hive vazio

```powershell
# Setup: garantir que nao existe
Remove-Item -Recurse -Force HKCU:\Software\TestLimparEmpty -ErrorAction SilentlyContinue
New-Item -Path HKCU:\Software\TestLimparEmpty | Out-Null

# Run
.\limpar-registros.ps1 -Termo autodesk -Hives HKCU_SOFTWARE
```

**Esperado:**
- Console: "Encontrados 0 itens a apagar..."
- `output/report-XXX.log` e `.csv` gerados
- Exit code 0
- Nada apagado

Cleanup: `Remove-Item HKCU:\Software\TestLimparEmpty`

## Cenario 2: Dry-run com matches conhecidos

```powershell
# Setup
$base = 'HKCU:\Software\TestLimparMatch'
Remove-Item -Recurse -Force $base -ErrorAction SilentlyContinue
New-Item -Path $base -Force | Out-Null
New-Item -Path "$base\Autodesk-Sub" -Force | Out-Null
New-ItemProperty -Path $base -Name 'AutodeskValue' -Value 'plain' -Force | Out-Null
New-ItemProperty -Path $base -Name 'normal' -Value 'data with autodesk inside' -Force | Out-Null

# Run
.\limpar-registros.ps1 -Termo autodesk -Hives HKCU_SOFTWARE
```

**Esperado:**
- Sumario mostra 1 chave + 2 valores a apagar
- `report.log` lista:
  - `[DeleteKey] HKEY_CURRENT_USER\Software\TestLimparMatch\Autodesk-Sub`
  - `[DeleteValue] ...\TestLimparMatch value="AutodeskValue"`
  - `[DeleteValue] ...\TestLimparMatch value="normal"` (matched: ValueData)
- Nada apagado de fato (`Test-Path $base\Autodesk-Sub` => True)

Cleanup: `Remove-Item -Recurse -Force HKCU:\Software\TestLimparMatch`

## Cenario 3: Apply real + restauracao

```powershell
# Mesmo setup do Cenario 2

# Run com -Apply
.\limpar-registros.ps1 -Termo autodesk -Hives HKCU_SOFTWARE -Apply
# Digitar APAGAR no prompt
```

**Esperado:**
- Pasta `output/backup-XXX/` criada com 1 `.reg` (chave inteira de TestLimparMatch foi exportada) + `manifest.txt`
- `Test-Path HKCU:\Software\TestLimparMatch\Autodesk-Sub` => False
- `(Get-Item HKCU:\Software\TestLimparMatch).GetValueNames()` nao inclui 'AutodeskValue' nem 'normal'
- Exit code 0

**Restauracao:**
```powershell
Get-ChildItem output\backup-XXX\*.reg | ForEach-Object { reg import $_.FullName }
```

- Apos restaurar, todas as chaves/valores apagados voltam.

Cleanup final: `Remove-Item -Recurse -Force HKCU:\Software\TestLimparMatch; Remove-Item -Recurse -Force output\*`

## Cenarios adversariais

### A: termo perigoso sem -Force
```powershell
.\limpar-registros.ps1 -Termo microsoft
```
Esperado: erro vermelho, exit 2.

### B: termo curto sem -Force
```powershell
.\limpar-registros.ps1 -Termo ad
```
Esperado: erro vermelho, exit 2.

### C: cancelar prompt
Roda Cenario 3 mas digita `nao` no prompt APAGAR. Esperado: exit 130, nada apagado.

### D: -Exclude funciona
```powershell
.\limpar-registros.ps1 -Termo autodesk -Hives HKCU_SOFTWARE -Exclude '*\TestLimparMatch\Autodesk-Sub*'
```
Esperado: a subchave `Autodesk-Sub` aparece com `Action=Skip(denylist)` no relatorio.

### E: stdin redirecionado
```powershell
echo "" | .\limpar-registros.ps1 -Termo autodesk -Apply
```
Esperado: erro vermelho, exit 1 (stdin nao-interativo sem -Yes).

### F: -Yes pula prompt
```powershell
echo "" | .\limpar-registros.ps1 -Termo autodesk -Apply -Yes -Hives HKCU_SOFTWARE
```
Esperado: roda sem pedir confirmacao.

### G: -Interactive (s/n/a/q)

Setup igual ao Cenario 2 (com `Autodesk-Sub`, `AutodeskValue`, `normal`).

```powershell
.\limpar-registros.ps1 -Termo autodesk -Hives HKCU_SOFTWARE -Interactive
```

Sub-cenarios (rodar setup de novo cada vez):

- **G1 (s,s,s):** Apertar `s` em todos os 3 prompts. Esperado: tudo apagado, exit 0.
- **G2 (n,n,n):** Apertar `n` em todos. Esperado: nada apagado, todos com `Action=Skip(user)`, exit 0.
- **G3 (a):** Apertar `a` no primeiro. Esperado: 1 prompt, depois apaga os outros 2 sem perguntar, exit 0.
- **G4 (q apos 1 delete):** Apertar `s` no primeiro, `q` no segundo. Esperado: 1 deletado, 2 nao processados, exit 0 (sem erro).

Verificar no `report.log` o `Action` final de cada item.
```

- [ ] **Step 16.2: Run cenario 1 (vazio)**

Validar manualmente conforme documento.

- [ ] **Step 16.3: Run cenario 2 (matches conhecidos, dry-run)**

Validar manualmente.

- [ ] **Step 16.4: Run cenario 3 (apply + restauracao)**

Validar manualmente. Em particular: confirmar que `reg import` reconstroi tudo.

- [ ] **Step 16.5: Run adversariais A, B, C, D, E, F, G (G1-G4)**

Validar manualmente.

- [ ] **Step 16.6: Commit**

```bash
git add tests/manual-scenarios.md
git commit -m "docs(limpar-registros): cenarios de validacao manual"
```

---

### Task 17: README mínimo

**Files:**
- Create: `README.md`

- [ ] **Step 17.1: Write README**

Create `README.md`:

```markdown
# limpar-registros.ps1

Limpa registros do Windows que contem um termo de busca, replicando o fluxo manual do regedit (Ctrl+F -> Apagar -> F3 -> Apagar) com seguranca.

## Uso rapido

```powershell
# Dry-run (padrao): so lista o que seria apagado
.\limpar-registros.ps1 -Termo autodesk,autocad

# Apagar de verdade (faz backup .reg automatico antes)
.\limpar-registros.ps1 -Termo autodesk,autocad -Apply

# Modo passo-a-passo (igual F3 manual)
.\limpar-registros.ps1 -Termo autodesk -Interactive
```

Roda sempre como **administrador** (auto-eleva via UAC). Backup automatico antes de qualquer apply, em `output/backup-YYYY-MM-DD-HHMMSS/`. Restaurar:

```powershell
for %f in (output\backup-XXX\*.reg) do reg import "%f"
```

Detalhes: ver [docs/superpowers/specs/2026-05-07-limpar-registros-design.md](docs/superpowers/specs/2026-05-07-limpar-registros-design.md).
Validacao: ver [tests/manual-scenarios.md](tests/manual-scenarios.md).
```

- [ ] **Step 17.2: Commit**

```bash
git add README.md
git commit -m "docs(limpar-registros): README com uso rapido"
```

---

## Done

After Task 17, the script is complete and validated. Final state:

- `limpar-registros.ps1` — single-file script, dot-source-friendly
- `tests/sanity-checks.ps1` — pure-function assertions
- `tests/manual-scenarios.md` — 3 main + 6 adversarial scenarios
- `README.md`, spec, plan committed

Total commits ≈ 17 (one per task) — clean history for review.
