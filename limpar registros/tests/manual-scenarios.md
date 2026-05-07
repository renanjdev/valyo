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
$base = 'HKCU:\Software\TestLimparMatch'
Remove-Item -Recurse -Force $base -ErrorAction SilentlyContinue
New-Item -Path $base -Force | Out-Null
New-Item -Path "$base\Autodesk-Sub" -Force | Out-Null
New-ItemProperty -Path $base -Name 'AutodeskValue' -Value 'plain' -Force | Out-Null
New-ItemProperty -Path $base -Name 'normal' -Value 'data with autodesk inside' -Force | Out-Null

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

.\limpar-registros.ps1 -Termo autodesk -Hives HKCU_SOFTWARE -Apply
# Digitar APAGAR no prompt
```

**Esperado:**
- Pasta `output/backup-XXX/` criada com 1+ `.reg` + `manifest.txt`
- `Test-Path HKCU:\Software\TestLimparMatch\Autodesk-Sub` => False
- `(Get-Item HKCU:\Software\TestLimparMatch).GetValueNames()` nao inclui 'AutodeskValue' nem 'normal'
- Exit code 0

**Restauracao:**
```cmd
for %f in (output\backup-XXX\*.reg) do reg import "%f"
```

Apos restaurar, todas as chaves/valores apagados voltam.

Cleanup: `Remove-Item -Recurse -Force HKCU:\Software\TestLimparMatch; Remove-Item -Recurse -Force output\*`

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

Setup igual ao Cenario 2.

```powershell
.\limpar-registros.ps1 -Termo autodesk -Hives HKCU_SOFTWARE -Interactive
```

Sub-cenarios (rodar setup de novo cada vez):

- **G1 (s,s,s):** Apertar `s` em todos os 3 prompts. Esperado: tudo apagado, exit 0.
- **G2 (n,n,n):** Apertar `n` em todos. Esperado: nada apagado, todos com `Action=Skip(user)`, exit 0.
- **G3 (a):** Apertar `a` no primeiro. Esperado: 1 prompt, depois apaga os outros 2 sem perguntar, exit 0.
- **G4 (q apos 1 delete):** Apertar `s` no primeiro, `q` no segundo. Esperado: 1 deletado, 2 nao processados, exit 0 (sem erro).

Verificar no `report.log` o `Action` final de cada item.

## Probes automatizados

Existem em `tests/`:

- `tests/sanity-checks.ps1` - assercoes nas funcoes puras (rodar a qualquer momento, nao mexe no registry)
- `tests/probe-find.ps1` - testa `Find-RegistryMatches` contra fixture HKCU
- `tests/probe-backup-report.ps1` - testa `Export-RegistryBackup` + `Write-Report`
- `tests/probe-deletion.ps1` - testa `Invoke-DeletionPlan` apagando fixture HKCU

Rodar todos: `Get-ChildItem tests\*.ps1 | ForEach-Object { powershell.exe -NoProfile -File $_.FullName }`
