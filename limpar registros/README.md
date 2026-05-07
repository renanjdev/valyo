# limpar-registros.ps1

Limpa registros do Windows que contem um termo de busca, replicando o fluxo manual do regedit (Ctrl+F → Apagar → F3 → Apagar) com seguranca.

## Uso rapido

```powershell
# Dry-run (padrao): so lista o que seria apagado
.\limpar-registros.ps1 -Termo autodesk,autocad

# Apagar de verdade (faz backup .reg automatico antes)
.\limpar-registros.ps1 -Termo autodesk,autocad -Apply

# Modo passo-a-passo (igual F3 manual)
.\limpar-registros.ps1 -Termo autodesk -Interactive
```

Roda sempre como **administrador** (auto-eleva via UAC). Backup automatico antes de qualquer apply, em `output/backup-YYYY-MM-DD-HHMMSS/`.

Restaurar:
```cmd
for %f in (output\backup-XXX\*.reg) do reg import "%f"
```

## Hives (escopo padrao)

- `HKLM\SOFTWARE`
- `HKLM\SOFTWARE\WOW6432Node`
- `HKCU\SOFTWARE`
- `HKEY_CLASSES_ROOT`

Restringir via `-Hives HKLM_SOFTWARE,HKCU_SOFTWARE`.

## Seguranca

- **Dry-run padrao** — `-Apply` requerido pra apagar.
- **Backup automatico** antes de qualquer apply.
- **Confirmacao dupla** — pede pra digitar `APAGAR` em maiusculas.
- **Denylist** embutida bloqueia caminhos criticos do Windows.
- **Termos perigosos** (`microsoft`, `windows`, `system`, etc.) e **termos curtos** (< 4 chars) precisam de `-Force`.

## Documentacao

- Spec: [docs/superpowers/specs/2026-05-07-limpar-registros-design.md](docs/superpowers/specs/2026-05-07-limpar-registros-design.md)
- Plano de implementacao: [docs/superpowers/plans/2026-05-07-limpar-registros.md](docs/superpowers/plans/2026-05-07-limpar-registros.md)
- Cenarios de validacao: [tests/manual-scenarios.md](tests/manual-scenarios.md)
