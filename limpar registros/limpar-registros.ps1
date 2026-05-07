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
            # Win32 retorna DWORD como Int32 com sinal; reinterpretar bytes pra UInt32
            $bytes = [System.BitConverter]::GetBytes([int32]$Data)
            $u = [System.BitConverter]::ToUInt32($bytes, 0)
            $hex = '0x' + $u.ToString('x')
            return @($u.ToString(), $hex)
        }
        'QWord' {
            if ($null -eq $Data) { return @() }
            $bytes = [System.BitConverter]::GetBytes([int64]$Data)
            $u = [System.BitConverter]::ToUInt64($bytes, 0)
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

$script:VisitCounter = 0

# Mapa de nome de hive raiz -> RegistryKey
$script:HiveRoots = @{
    'HKEY_LOCAL_MACHINE' = [Microsoft.Win32.Registry]::LocalMachine
    'HKEY_CURRENT_USER'  = [Microsoft.Win32.Registry]::CurrentUser
    'HKEY_CLASSES_ROOT'  = [Microsoft.Win32.Registry]::ClassesRoot
    'HKEY_USERS'         = [Microsoft.Win32.Registry]::Users
    'HKEY_CURRENT_CONFIG'= [Microsoft.Win32.Registry]::CurrentConfig
}

function _OpenHiveSubKey {
    param([string]$CanonicalPath)
    $segs = $CanonicalPath -split '\\', 2
    $rootName = $segs[0]
    if (-not $script:HiveRoots.ContainsKey($rootName)) { return $null }
    $root = $script:HiveRoots[$rootName]
    if ($segs.Count -lt 2 -or [string]::IsNullOrEmpty($segs[1])) { return $root }
    return $root.OpenSubKey($segs[1])
}

function _VisitRegistryKeyDirect {
    param(
        [Microsoft.Win32.RegistryKey]$Key,
        [string]$CanonicalPath,
        [int]$Depth,
        [int]$MaxDepth,
        [string[]]$TermsLower,
        [string[]]$UserExcludes,
        $Results
    )

    if ($Depth -gt $MaxDepth) { return }
    if ($null -eq $Key) { return }

    $script:VisitCounter++
    if (($script:VisitCounter % 1000) -eq 0) {
        Write-Host "    visitadas: $($script:VisitCounter) chaves..." -ForegroundColor DarkGray
    }

    $denied = Test-PathInDenylist -Path $CanonicalPath -UserExcludes $UserExcludes
    $hive = ($CanonicalPath -split '\\')[0]
    $reason = if ($denied) { 'Path em denylist' } else { $null }

    # Match no nome da chave
    $segs = $CanonicalPath -split '\\'
    $leafName = $segs[-1]
    $hitTerm = _MatchTerm -Hay $leafName -TermsLower $TermsLower
    if ($hitTerm) {
        $a = if ($denied) { 'Skip(denylist)' } else { 'DeleteKey' }
        $Results.Add([pscustomobject]@{
            Hive = $hive; Path = $CanonicalPath; Type = 'Key'; ValueName = $null
            MatchedOn = 'KeyName'; MatchedTerm = $hitTerm
            Action = $a; Reason = $reason
        }) | Out-Null
    }

    # Valores
    $valueNames = @()
    try { $valueNames = @($Key.GetValueNames()) } catch { }

    foreach ($vname in $valueNames) {
        if (-not [string]::IsNullOrEmpty($vname)) {
            $hitTerm = _MatchTerm -Hay $vname -TermsLower $TermsLower
            if ($hitTerm) {
                $a = if ($denied) { 'Skip(denylist)' } else { 'DeleteValue' }
                $Results.Add([pscustomobject]@{
                    Hive = $hive; Path = $CanonicalPath; Type = 'Value'; ValueName = $vname
                    MatchedOn = 'ValueName'; MatchedTerm = $hitTerm
                    Action = $a; Reason = $reason
                }) | Out-Null
            }
        }

        $vkind = $null
        $vdata = $null
        try {
            $vkind = $Key.GetValueKind($vname).ToString()
            $vdata = $Key.GetValue($vname)
        } catch { continue }

        $stringForms = @()
        try {
            $stringForms = @(Get-ValueDataAsString -Kind $vkind -Data $vdata)
        } catch { continue }

        foreach ($form in $stringForms) {
            $hitTerm = _MatchTerm -Hay $form -TermsLower $TermsLower
            if ($hitTerm) {
                $a = if ($denied) { 'Skip(denylist)' } else { 'DeleteValue' }
                $displayName = if ([string]::IsNullOrEmpty($vname)) { '(default)' } else { $vname }
                $Results.Add([pscustomobject]@{
                    Hive = $hive; Path = $CanonicalPath; Type = 'Value'; ValueName = $displayName
                    MatchedOn = 'ValueData'; MatchedTerm = $hitTerm
                    Action = $a; Reason = $reason
                }) | Out-Null
                break
            }
        }
    }

    # Recursao via OpenSubKey
    $subNames = @()
    try { $subNames = @($Key.GetSubKeyNames()) } catch { }

    foreach ($subName in $subNames) {
        $sub = $null
        try { $sub = $Key.OpenSubKey($subName) } catch { continue }
        if ($null -eq $sub) { continue }
        try {
            _VisitRegistryKeyDirect -Key $sub `
                -CanonicalPath "$CanonicalPath\$subName" `
                -Depth ($Depth + 1) -MaxDepth $MaxDepth `
                -TermsLower $TermsLower -UserExcludes $UserExcludes `
                -Results $Results
        } finally {
            $sub.Dispose()
        }
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

    # Resolve hive root direto (mais rapido que Get-Item por path)
    $canonical = $HivePath -replace '^Registry::', ''
    $script:VisitCounter = 0

    $rootKey = _OpenHiveSubKey -CanonicalPath $canonical
    if ($null -eq $rootKey) {
        Write-Host "AVISO: nao consegui abrir hive '$canonical' (acesso negado ou nao existe)." -ForegroundColor Yellow
        return @()
    }

    # Detectar se eh hive raiz (singleton, nao deve ser disposed)
    $isHiveRoot = $false
    foreach ($r in $script:HiveRoots.Values) {
        if ([object]::ReferenceEquals($r, $rootKey)) { $isHiveRoot = $true; break }
    }

    try {
        _VisitRegistryKeyDirect -Key $rootKey -CanonicalPath $canonical `
            -Depth 0 -MaxDepth $MaxDepth -TermsLower $termsLower `
            -UserExcludes $UserExcludes -Results $results
    } finally {
        if (-not $isHiveRoot -and $rootKey) {
            $rootKey.Dispose()
        }
    }

    Write-Host "    Total visitadas: $($script:VisitCounter) chaves" -ForegroundColor DarkGray
    , $results.ToArray()
}

function Export-RegistryBackup {
    [OutputType([string])]
    param(
        [Parameter(Mandatory)] [object[]] $Plan,
        [Parameter(Mandatory)] [string] $OutDir,
        [Parameter(Mandatory)] [string] $Timestamp
    )

    # Coletar set unico de chaves a tocar
    $keysToBackup = New-Object 'System.Collections.Generic.HashSet[string]'
    foreach ($item in $Plan) {
        if ($item.Action -notlike 'Delete*') { continue }
        $null = $keysToBackup.Add($item.Path)
    }

    if ($keysToBackup.Count -eq 0) { return $null }

    $backupDir = Join-Path $OutDir "backup-$Timestamp"
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

    $manifestLines = New-Object 'System.Collections.Generic.List[string]'
    $manifestLines.Add("# Backup gerado em $Timestamp") | Out-Null
    $manifestLines.Add("# Cada .reg cobre uma chave inteira (subarvore). Restaure via duplo-clique ou:") | Out-Null
    $manifestLines.Add("# for %f in (*.reg) do reg import `"%f`"") | Out-Null
    $manifestLines.Add("") | Out-Null

    $i = 0
    foreach ($keyPath in $keysToBackup) {
        $i++
        $safe = $keyPath -replace '[\\:*?"<>|]', '_'
        if ($safe.Length -gt 180) { $safe = $safe.Substring(0, 180) }
        $hashInput = [System.Text.Encoding]::UTF8.GetBytes($keyPath)
        $sha = [System.Security.Cryptography.SHA1]::Create()
        $hash = [System.BitConverter]::ToString($sha.ComputeHash($hashInput)).Replace('-', '').Substring(0, 8).ToLower()
        $sha.Dispose()
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

    # Aviso se backup total > 100MB
    $totalBytes = (Get-ChildItem -LiteralPath $backupDir -File | Measure-Object -Sum Length).Sum
    if ($totalBytes -gt 100MB) {
        $mb = [math]::Round($totalBytes / 1MB, 1)
        Write-Host "AVISO: backup total $mb MB (> 100MB). Espaco em disco e tempo de import podem ser significativos." -ForegroundColor Yellow
    }

    return $backupDir
}

function Show-ConfirmPrompt {
    [OutputType([bool])]
    param(
        [Parameter(Mandatory)] [object[]] $Plan,
        [string] $BackupDir,
        [switch] $BypassYes
    )

    $deleteKey = @($Plan | Where-Object { $_.Action -eq 'DeleteKey' }).Count
    $deleteVal = @($Plan | Where-Object { $_.Action -eq 'DeleteValue' }).Count
    $skips     = @($Plan | Where-Object { $_.Action -like 'Skip*' }).Count

    Write-Host ""
    Write-Host "Vai apagar $deleteKey chaves e $deleteVal valores." -ForegroundColor Yellow
    if ($BackupDir) { Write-Host "Backup em: $BackupDir" }
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
    Write-Host "Pra confirmar, digite APAGAR (em maiusculas): " -NoNewline
    $userInput = Read-Host
    return ($userInput -ceq 'APAGAR')
}

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

function Invoke-DeletionPlan {
    param(
        [Parameter(Mandatory)] [object[]] $Plan,
        [switch] $Interactive
    )

    $applyAll = -not $Interactive
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
                $item.Action = 'Deleted(Key)'
            } else {
                Remove-ItemProperty -LiteralPath $registryPath -Name $item.ValueName -Force -ErrorAction Stop
                $item.Action = 'Deleted(Value)'
            }
        } catch {
            $errorCount++
            $msg = $_.Exception.Message
            $reason = if ($msg -match 'access|denied|denegado|negado') { 'AccessDenied' }
                      elseif ($msg -match 'use|process|outro processo') { 'InUse' }
                      elseif ($msg -match 'not found|nao foi encontrado|cannot find|nao existe') { 'NotFound' }
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

function Write-Report {
    param(
        [Parameter(Mandatory)] [object[]] $Plan,
        [Parameter(Mandatory)] [string] $OutDir,
        [Parameter(Mandatory)] [string] $Timestamp,
        [Parameter(Mandatory)] [string] $Mode,
        [Parameter(Mandatory)] [string[]] $Termos,
        [Parameter(Mandatory)] [string[]] $HiveLabels,
        [string] $BackupDir = $null
    )

    $logPath = Join-Path $OutDir "report-$Timestamp.log"
    $csvPath = Join-Path $OutDir "report-$Timestamp.csv"

    $deleteKey = @($Plan | Where-Object { $_.Action -eq 'DeleteKey' -or $_.Action -eq 'Deleted(Key)' }).Count
    $deleteVal = @($Plan | Where-Object { $_.Action -eq 'DeleteValue' -or $_.Action -eq 'Deleted(Value)' }).Count
    $skipDeny  = @($Plan | Where-Object { $_.Action -eq 'Skip(denylist)' }).Count
    $skipUser  = @($Plan | Where-Object { $_.Action -eq 'Skip(user)' }).Count
    $skipErr   = @($Plan | Where-Object { $_.Action -like 'Skip(*' -and $_.Action -ne 'Skip(denylist)' -and $_.Action -ne 'Skip(user)' }).Count

    # --- LOG ---
    $log = New-Object 'System.Collections.Generic.List[string]'
    $log.Add("limpar-registros.ps1 - $Timestamp") | Out-Null
    $log.Add("Modo: $Mode") | Out-Null
    $log.Add("Termos: $($Termos -join ', ')") | Out-Null
    $log.Add("Hives: $($HiveLabels -join ', ')") | Out-Null
    $backupLabel = if ($BackupDir) { $BackupDir } else { 'nenhum em dry-run' }
    $log.Add("Backup: $backupLabel") | Out-Null
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
    $csv = New-Object 'System.Collections.Generic.List[string]'
    $csv.Add('Hive;Path;Type;ValueName;MatchedOn;MatchedTerm;Action;Reason') | Out-Null
    foreach ($it in $Plan) {
        $row = @($it.Hive, $it.Path, $it.Type, $it.ValueName,
                 $it.MatchedOn, $it.MatchedTerm, $it.Action, $it.Reason) | ForEach-Object {
            $s = if ($null -eq $_) { '' } else { [string]$_ }
            if ($s -match '[;"\r\n]') { '"' + ($s -replace '"', '""') + '"' } else { $s }
        }
        $csv.Add(($row -join ';')) | Out-Null
    }
    [System.IO.File]::WriteAllLines($csvPath, $csv, [System.Text.UTF8Encoding]::new($true))

    return [pscustomobject]@{ LogPath = $logPath; CsvPath = $csvPath }
}

function Invoke-SelfElevate {
    param(
        [Parameter(Mandatory)] [string] $ScriptPath,
        [Parameter(Mandatory)] [hashtable] $BoundParams
    )

    $argList = New-Object 'System.Collections.Generic.List[string]'
    $argList.Add('-NoProfile') | Out-Null
    $argList.Add('-ExecutionPolicy') | Out-Null
    $argList.Add('Bypass') | Out-Null
    $argList.Add('-File') | Out-Null
    $argList.Add("`"$ScriptPath`"") | Out-Null

    foreach ($k in $BoundParams.Keys) {
        $v = $BoundParams[$k]
        if ($v -is [switch]) {
            if ($v.IsPresent) { $argList.Add("-$k") | Out-Null }
        } elseif ($v -is [array]) {
            $argList.Add("-$k") | Out-Null
            $joined = ($v | ForEach-Object { "`"$_`"" }) -join ','
            $argList.Add($joined) | Out-Null
        } else {
            $argList.Add("-$k") | Out-Null
            $argList.Add("`"$v`"") | Out-Null
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

# === Main flow ===

function Invoke-MainFlow {
    # === Fase 0: pre-condicoes ===

    # 0.1 Validacao basica de Termo
    if (-not $Termo -or $Termo.Count -eq 0) {
        Write-Host "ERRO: parametro -Termo eh obrigatorio." -ForegroundColor Red
        exit 1
    }

    # 0.2 Resolver -OutDir absoluto antes de eleve (sobrevive a CWD do filho)
    if (-not [System.IO.Path]::IsPathRooted($OutDir)) {
        $absOutDir = Join-Path (Get-Location).Path $OutDir
    } else {
        $absOutDir = $OutDir
    }
    $absOutDir = [System.IO.Path]::GetFullPath($absOutDir)

    # 0.3 Eleve se nao admin
    if (-not (Test-IsAdmin)) {
        Write-Host "Elevando privilegios via UAC..." -ForegroundColor Cyan
        $bp = @{} + $PSBoundParameters
        $bp['OutDir'] = $absOutDir
        $code = Invoke-SelfElevate -ScriptPath $PSCommandPath -BoundParams $bp
        exit $code
    }

    # 0.4 stdin nao-interativo + apply sem -Yes
    if ($Apply -and -not $Yes -and [Console]::IsInputRedirected) {
        Write-Host "ERRO: stdin nao-interativo com -Apply requer -Yes." -ForegroundColor Red
        exit 1
    }

    # 0.5 Validar termos perigosos / curtos
    if (Test-DangerousTerm -Termos $Termo) {
        if (-not $Force) {
            Write-Host "ERRO: termo perigoso ou < $script:MinTermLength chars detectado. Use -Force pra prosseguir." -ForegroundColor Red
            exit 2
        }
        Write-Host "AVISO: -Force ativo, ignorando gate de termo perigoso/curto." -ForegroundColor Yellow
    }

    # 0.6 Resolver hives
    $hivePaths = @($Hives | ForEach-Object { Resolve-HiveAlias -Alias $_ })
    $hiveLabels = @($Hives | ForEach-Object { $script:HiveAliases[$_] })

    # 0.7 Criar OutDir
    if (-not (Test-Path $absOutDir)) {
        try { New-Item -ItemType Directory -Path $absOutDir -Force | Out-Null }
        catch {
            Write-Host "ERRO: nao consegui criar OutDir '$absOutDir': $($_.Exception.Message)" -ForegroundColor Red
            exit 1
        }
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
    $allMatches = New-Object 'System.Collections.Generic.List[object]'
    for ($i = 0; $i -lt $hivePaths.Count; $i++) {
        Write-Host "  [$($i+1)/$($hivePaths.Count)] $($hiveLabels[$i])"
        $hits = Find-RegistryMatches -HivePath $hivePaths[$i] -Termos $Termo -MaxDepth $MaxDepth -UserExcludes $Exclude
        foreach ($h in $hits) { $allMatches.Add($h) | Out-Null }
    }

    # === Fase 2: otimizar ===
    $plan = @(Optimize-MatchPlan -Plan $allMatches.ToArray())

    $deleteCount = @($plan | Where-Object { $_.Action -like 'Delete*' }).Count
    $skipCount = @($plan | Where-Object { $_.Action -like 'Skip*' }).Count
    $dedupCount = $allMatches.Count - $plan.Count

    Write-Host ""
    Write-Host "Encontrados $deleteCount itens a apagar ($dedupCount deduplicados, $skipCount skips)." -ForegroundColor Cyan

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
            Write-Host "ERRO no backup: $($_.Exception.Message)" -ForegroundColor Red
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

    if ($exec.UserQuit) {
        Write-Host "Modo interativo: cancelado pelo usuario (q)." -ForegroundColor Yellow
    }

    # === Fase 6: relatorio ===
    $r = Write-Report -Plan $exec.Plan -OutDir $absOutDir -Timestamp $timestamp -Mode $mode -Termos $Termo -HiveLabels $hiveLabels -BackupDir $backupDir
    Write-Host ""
    Write-Host "Relatorio: $($r.LogPath)" -ForegroundColor Green
    Write-Host "CSV:       $($r.CsvPath)" -ForegroundColor Green

    if ($exec.ErrorCount -gt 0) { exit 4 } else { exit 0 }
}

# Main-flow gate: skip when dot-sourced
if ($MyInvocation.InvocationName -ne '.') {
    Invoke-MainFlow
}
