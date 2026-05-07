# limpar-registros — Design

**Data:** 2026-05-07
**Autor:** Renan (com Claude)
**Status:** Aprovado — pronto pra plano de implementação

## Objetivo

Automatizar a limpeza de registros do Windows que contêm uma palavra-chave (ex.: "autodesk"), reproduzindo o fluxo manual no `regedit` (Ctrl+F → apagar → F3 → apagar...) com segurança, backup e relatório.

Caso de uso real: após desinstalar uma suíte como Autodesk/Adobe, sobram chaves e valores espalhados por `HKLM\SOFTWARE`, `HKCR`, etc., que o uninstaller não removeu. Limpar esse lixo manualmente leva horas no regedit. O script faz em segundos, com segurança.

## Não-objetivos

- Não substituir System Restore — apenas recomenda criar um antes do `-Apply`.
- Não tentar consertar ACLs (`takeown`/`SetACL`) pra apagar chaves protegidas. Chaves protegidas são puladas com motivo no log.
- Não suportar regex (apenas substring case-insensitive com múltiplos termos).
- Não criar interface gráfica.
- Não rodar continuamente / como serviço — é uma ferramenta de execução pontual.

## Restrições e premissas

- Plataforma: Windows 10/11.
- Runtime: PowerShell 5.1 (built-in). Sem dependências externas além de `reg.exe`.
- O script roda elevado (admin). Auto-eleva via UAC se necessário.
- Apagar do registro é irreversível sem backup. Backup `.reg` automático é regra dura quando `-Apply` está ativo.
- Hives mexidos por padrão: `HKLM\SOFTWARE`, `HKLM\SOFTWARE\WOW6432Node`, `HKCU\SOFTWARE`, `HKEY_CLASSES_ROOT`.

## Decisões de design (resumo)

| # | Decisão | Escolha |
|---|---------|---------|
| 1 | Escopo de hives | `HKLM\SOFTWARE`, `HKLM\SOFTWARE\WOW6432Node`, `HKCU\SOFTWARE`, `HKCR` (configurável via `-Hives`) |
| 2 | Match em chave/valor/dado | Espelha regedit: chave casada → apaga chave inteira; valor/dado casado → apaga só o valor |
| 3 | Confirmação | Dry-run padrão; `-Apply` para apagar; `-Interactive` para passo-a-passo |
| 4 | Backup | Automático via `.reg` antes de qualquer `-Apply`. Sem backup → aborta. |
| 5 | Termo de busca | Substring case-insensitive, múltiplos termos numa execução |
| 6 | Linguagem | PowerShell `.ps1` |
| 7 | Privilégios | Auto-eleva via UAC; chaves protegidas viram skip+log |
| 8 | Proteção | Denylist embutida + lista de termos perigosos + `-Exclude` |
| 9 | Saída | `.log` (texto legível) + `.csv` (planilhado) |

## Arquitetura

Script único: `limpar-registros.ps1` na raiz do projeto.

```
limpar registros/
  limpar-registros.ps1
  docs/superpowers/specs/2026-05-07-limpar-registros-design.md
  output/                              # gerado em runtime, ignorado pelo git
    report-YYYY-MM-DD-HHMMSS.log
    report-YYYY-MM-DD-HHMMSS.csv
    backup-YYYY-MM-DD-HHMMSS.reg       # só quando -Apply
  .gitignore
```

## Interface (CLI)

### Parâmetros

| Parâmetro | Tipo | Default | Descrição |
|-----------|------|---------|-----------|
| `-Termo` | `string[]` | — (obrigatório) | Um ou mais termos a buscar (substring, case-insensitive) |
| `-Hives` | `string[]` | `HKLM_SOFTWARE,HKLM_WOW64,HKCU_SOFTWARE,HKCR` | Hives a varrer |
| `-Apply` | `switch` | `$false` | Apaga de fato. Sem isto, é dry-run. |
| `-Interactive` | `switch` | `$false` | Pergunta `[s/n/a/q]` antes de cada delete |
| `-Exclude` | `string[]` | `@()` | Padrões wildcard de paths a ignorar (somam à denylist) |
| `-Force` | `switch` | `$false` | Permite termos perigosos / curtos (não bypassa denylist embutida) |
| `-OutDir` | `string` | `.\output` | Pasta para relatório e backup |

### Códigos de saída

| Código | Significado |
|--------|-------------|
| 0 | Sucesso (dry-run completo, ou apply com 0 erros) |
| 1 | Erro de pré-condição (sem admin após eleve, sem termo, dir inacessível) |
| 2 | Termo perigoso sem `-Force`, ou termo < 4 chars sem `-Force` |
| 3 | Falha em criar backup quando `-Apply` (apply abortado) |
| 4 | Apply rodou mas com erros parciais (alguns deletes falharam — log tem detalhes) |
| 130 | Usuário cancelou no prompt de confirmação |

### Exemplos

```powershell
# Dry-run: lista o que seria apagado
.\limpar-registros.ps1 -Termo autodesk,autocad

# Apply real (faz backup .reg, exige digitar "APAGAR" na confirmação)
.\limpar-registros.ps1 -Termo autodesk,autocad -Apply

# Modo interativo
.\limpar-registros.ps1 -Termo autodesk -Interactive

# Restringir hives
.\limpar-registros.ps1 -Termo autodesk -Hives HKLM_SOFTWARE,HKCU_SOFTWARE

# Excluir paths extras
.\limpar-registros.ps1 -Termo adobe -Exclude "*\Adobe\Adobe Acrobat\*"

# Override de termo perigoso
.\limpar-registros.ps1 -Termo microsoft -Force
```

## Algoritmo

### Fase 0 — Pré-condições

1. Verificar elevação. Se não admin → relançar com `Start-Process powershell -Verb RunAs` mantendo args originais; sair.
2. Validar `-Termo`: ao menos um termo, todos com ≥ 4 chars (a menos que `-Force`).
3. Validar termos perigosos (`microsoft`, `windows`, `system`, `intel`, `nvidia`, `amd`, `realtek`, `driver`, `kernel`, `policies`). Match (substring) sem `-Force` → aborta com código 2.
4. Resolver `-Hives` aliases pra paths PSDrive (`Registry::HKEY_LOCAL_MACHINE\SOFTWARE`).
5. Criar `-OutDir` se não existir. Falha → aborta código 1.

### Fase 1 — Varredura (sempre executa)

Para cada hive:
1. `Get-ChildItem -Path "Registry::<hive>" -Recurse -Force -ErrorAction SilentlyContinue` — chaves inacessíveis caem em `$Error` mas não interrompem.
2. Pra cada chave visitada:
   - Comparar último segmento do path contra cada termo (substring case-insensitive). Hit → registro com `Type=Key, MatchedOn=KeyName`.
   - `Get-ItemProperty` da chave; pra cada valor:
     - Comparar nome do valor (exceto `(default)`/`(Padrão)` ainda casa). Hit → `Type=Value, MatchedOn=ValueName`.
     - Converter dado pra string (ver "Conversão de tipo" abaixo) e comparar. Hit → `Type=Value, MatchedOn=ValueData`.
3. Aplicar denylist embutida + `-Exclude`: caminhos que batem viram `Action=Skip(denylist)` mas continuam no relatório (visibilidade).

**Conversão de tipo** (`Get-ValueDataAsString`):

| Tipo registry | Conversão |
|---------------|-----------|
| `REG_SZ`, `REG_EXPAND_SZ` | string direto |
| `REG_MULTI_SZ` | join com `\n` |
| `REG_DWORD`, `REG_QWORD` | `$value.ToString()` (decimal) e também hex `0x...` (compara contra ambos) |
| `REG_BINARY` | hex string `01-02-AB-...` |
| `REG_NONE` / desconhecido | pula comparação de dado |

### Fase 2 — Otimizar plano (`Optimize-MatchPlan`)

1. Coletar todos os `DeleteKey`. Ordenar por path.
2. Pra cada match (não-Skip), verificar se algum ancestral está marcado `DeleteKey`. Se sim → descartar (redundante; será apagado em cascata).
3. Ordenar `DeleteKey` por profundidade decrescente (folhas primeiro).
4. Ordenar `DeleteValue` antes de `DeleteKey` que afeta seu path-pai (não estritamente necessário, mas ajuda no log).

### Fase 3 — Backup (só se `-Apply` e há matches a apagar)

1. Coletar set único de chaves a tocar (pra `DeleteKey`, a própria; pra `DeleteValue`, a chave pai).
2. Pra cada chave, `reg.exe export "<full-path>" "<temp.reg>" /y`.
3. Concatenar todos `.reg` num único `output/backup-YYYY-MM-DD-HHMMSS.reg` com header Windows Registry Editor 5.00.
4. Falha em qualquer export → aborta código 3 (sem apply).
5. Imprimir caminho do backup.

### Fase 4 — Confirmação (só se `-Apply`)

Mostrar resumo:
```
Vai apagar X chaves e Y valores em N hives.
Backup salvo em: <path>
Skips: Z (ver report.log)

Pra confirmar, digite APAGAR (em maiúsculas):
```

Input ≠ `APAGAR` → cancela código 130.

### Fase 5 — Execução (só se `-Apply` ou `-Interactive`)

Pra cada item do plano:
- `-Interactive`: prompt `[s]im / [n]ão / [a]plicar tudo a partir daqui / [q]uit` antes de cada delete. `a` desliga prompts subsequentes; `q` aborta com código 0 (parcial OK).
- `DeleteKey`: `Remove-Item -Path "Registry::..." -Recurse -Force -ErrorAction Stop`
- `DeleteValue`: `Remove-ItemProperty -Path "Registry::<keyPath>" -Name "<valueName>" -Force -ErrorAction Stop`
- Erro: capturar exceção, classificar (`AccessDenied` / `InUse` / `NotFound` / `Other`), marcar item `Action=Skip(motivo)`, continuar.

Se houve ao menos 1 erro, código de saída final = 4.

### Fase 6 — Relatório

Sempre escreve `report-YYYY-MM-DD-HHMMSS.log` e `.csv` em `-OutDir`.

**`.log` formato:**
```
limpar-registros.ps1 — 2026-05-07 14:30:22
Modo: dry-run | apply | interactive
Termos: autodesk, autocad
Hives: HKLM\SOFTWARE, HKLM\SOFTWARE\WOW6432Node, HKCU\SOFTWARE, HKCR
Backup: output/backup-2026-05-07-143022.reg  (ou: nenhum em dry-run)

Sumário:
  Chaves a apagar:    142
  Valores a apagar:   38
  Pulados (denylist): 4
  Pulados (erro):     2 (ver detalhes abaixo)

=== HKLM\SOFTWARE ===
[DeleteKey]   HKLM\SOFTWARE\Autodesk   (matched: KeyName=autodesk)
[DeleteValue] HKLM\SOFTWARE\Classes\... value="ProgID" (matched: ValueData=Autodesk.Foo)
[Skip:denylist] HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run value="AcadStartup"
...
```

**`.csv` colunas:** `Hive, Path, Type, ValueName, MatchedOn, MatchedTerm, Action, Reason`

## Funções internas (estrutura do código)

```
Test-IsAdmin
Invoke-SelfElevate
Test-DangerousTerm                # retorna $true se algum termo bate em blocklist ou < 4 chars
Resolve-HiveAlias                 # "HKLM_SOFTWARE" -> "HKEY_LOCAL_MACHINE\SOFTWARE"
Test-PathInDenylist               # path + lista de wildcards -> bool
Get-ValueDataAsString             # tipo + valor -> string(s) comparáveis
Find-RegistryMatches              # hive + termos -> array de match records
Optimize-MatchPlan                # array -> array filtrada+ordenada
Export-RegistryBackup             # array de chaves -> path do .reg
Invoke-DeletionPlan               # array + flags -> array com Action atualizada
Show-ConfirmPrompt                # plano -> bool (digitou APAGAR?)
Show-InteractivePrompt            # item -> 's'|'n'|'a'|'q'
Write-Report                      # array + metadados -> log + csv
```

Cada função recebe input explícito e retorna output explícito (sem estado global além da `$script:Logger`).

## Denylist embutida

Aplicada a *todos* os matches, mesmo com `-Force`. Apenas `-Exclude` é cumulativo (você adiciona mais, não remove os embutidos).

```
HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\*       (exceto \Uninstall\*)
HKLM\SOFTWARE\Microsoft\Windows NT\*
HKLM\SOFTWARE\Microsoft\Cryptography\*
HKLM\SOFTWARE\Policies\*
HKLM\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\*  (exceto \Uninstall\*)
HKLM\SOFTWARE\WOW6432Node\Microsoft\Windows NT\*
HKEY_CLASSES_ROOT\CLSID                                (chave raiz; subchaves liberadas)
HKEY_CLASSES_ROOT\Interface                            (idem)
HKEY_CLASSES_ROOT\TypeLib                              (idem)
```

A regra "raiz protegida, subchaves liberadas" é codificada como: path EXATAMENTE igual à raiz é skip; subpaths são liberados. Implementação: comparação `-eq` em vez de `-like` pra essas raízes.

`Uninstall\*` é exceção porque é exatamente onde lixo de software desinstalado mora (entradas `Add/Remove Programs`).

## Termos perigosos (blocklist)

`microsoft`, `windows`, `system`, `intel`, `nvidia`, `amd`, `realtek`, `driver`, `kernel`, `policies`.

Match = substring case-insensitive. Aborta com mensagem em vermelho indicando qual termo bateu e exigindo `-Force` pra prosseguir. Termos < 4 chars idem.

## Casos extremos e tratamento

| Cenário | Tratamento |
|---------|------------|
| Chave protegida (TrustedInstaller) | `Remove-Item` lança AccessDenied → captura, registra `Skip(AccessDenied)`, continua |
| Chave em uso (handle aberto) | Lança InUse → captura, `Skip(InUse)`, continua |
| Chave já apagada por cascata | NotFound → não deveria acontecer pós-Optimize-MatchPlan; se acontecer, `Skip(NotFound)` |
| Loop simbólico no registro | `Get-ChildItem -Recurse` do PowerShell já trata; ainda assim, depth limit de 50 como guarda |
| Termo gera dezenas de milhares de matches | Sem limite hard. Aviso se > 5000 matches no resumo de confirmação. |
| Backup `.reg` muito grande (>100MB) | Aceitar; só warning. |
| Falha parcial no backup (uma chave não exporta) | Aborta apply (regra dura: backup completo ou nada) |
| Path com chars Unicode estranhos | PowerShell e `reg.exe` lidam nativamente; relatório `.log`/`.csv` em UTF-8 com BOM |

## Testabilidade

Sem framework de testes (não há Pester instalado por padrão e não vale o overhead pra um script). Validação manual em três cenários:

1. **Dry-run em hive vazio simulado** — varre `HKCU\Software\TestEmpty` (criada antes), sem matches → relatório com 0 matches, sai 0.
2. **Dry-run com matches conhecidos** — criar manualmente algumas chaves de teste em `HKCU\Software\TestLimpar\Autodesk*`, rodar com `-Termo autodesk`, conferir que relatório lista exatamente o esperado.
3. **Apply real no cenário acima** — confirma backup criado, chaves apagadas, restauração via duplo-clique no `.reg` recupera tudo.

Cenários adversariais a testar:
- Termo `microsoft` sem `-Force` → erro código 2.
- Termo `ad` sem `-Force` → erro código 2 (curto demais).
- Sem `-Apply` → backup *não* é criado, relatório é gerado.
- `-Apply` mas digitar `nao` na confirmação → cancela código 130, nada apagado.
- `-Exclude "*\TestLimpar\KeepThis\*"` → essa subchave não aparece com `Action=Delete`.

## Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| Apagar registro crítico do sistema | Denylist embutida + termos perigosos + dry-run padrão + backup automático + confirmação `APAGAR` |
| Backup falhar e apply rodar mesmo assim | Regra dura: falha em backup = aborta apply (código 3) |
| Match em GUID compartilhado quebrar COM não relacionado | Decisão de design "espelhar regedit": GUID com valor casado → apaga só o valor, não a chave inteira |
| Usuário rodar sem entender o que faz | Dry-run padrão. Pra apagar precisa: passar `-Apply`, ler resumo, digitar `APAGAR` |
| Loop infinito na varredura | Depth limit 50 + `Get-ChildItem` do PS já é robusto |
| Ataque por path injection no `-Termo` | Termos são tratados como strings literais em comparação substring; nunca interpretados como path/regex |

## Fora de escopo (futuro)

- Suporte a regex.
- Modo "wizard" interativo pra escolher hives via menu.
- Integração com System Restore Point automático.
- GUI.
- Suporte a remote registry (outro PC na rede).
- Pré-sets nomeados (ex.: `--preset autodesk` que carrega lista de termos `autodesk,autocad,acad,adsk,...`).
