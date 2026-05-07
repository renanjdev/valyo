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
    backup-YYYY-MM-DD-HHMMSS/          # só quando -Apply
      manifest.txt
      *.reg                            # 1 arquivo por chave exportada
  .gitignore
```

## Interface (CLI)

### Parâmetros

| Parâmetro | Tipo | Default | Descrição |
|-----------|------|---------|-----------|
| `-Termo` | `string[]` | — (obrigatório) | Um ou mais termos a buscar (substring, case-insensitive) |
| `-Hives` | `string[]` | `HKLM_SOFTWARE,HKLM_WOW64,HKCU_SOFTWARE,HKCR` | Hives a varrer (aliases na tabela abaixo) |
| `-Apply` | `switch` | `$false` | Apaga de fato. Sem isto, é dry-run. |
| `-Interactive` | `switch` | `$false` | Pergunta `[s/n/a/q]` antes de cada delete |
| `-Yes` | `switch` | `$false` | Pula prompt de confirmação `APAGAR` (uso em scripts/CI). Não substitui `-Apply`. |
| `-Exclude` | `string[]` | `@()` | Padrões wildcard de paths a ignorar (somam à denylist) |
| `-Force` | `switch` | `$false` | Libera termos perigosos **e** termos < 4 chars (gates juntos). Não bypassa denylist embutida. |
| `-OutDir` | `string` | `.\output` | Pasta para relatório e backup. Resolvido para path absoluto **antes** de auto-eleve (pra sobreviver à mudança de CWD do processo elevado). |
| `-MaxDepth` | `int` | `50` | Profundidade máxima da recursão (proteção contra loops). |

### Aliases de hive

| Alias | Path PSDrive (PowerShell) |
|-------|---------------------------|
| `HKLM_SOFTWARE` | `Registry::HKEY_LOCAL_MACHINE\SOFTWARE` (excluindo `WOW6432Node`) |
| `HKLM_WOW64` | `Registry::HKEY_LOCAL_MACHINE\SOFTWARE\WOW6432Node` |
| `HKCU_SOFTWARE` | `Registry::HKEY_CURRENT_USER\SOFTWARE` |
| `HKCR` | `Registry::HKEY_CLASSES_ROOT` |

`HKLM_SOFTWARE` exclui `WOW6432Node` para evitar varredura dupla; `HKLM_WOW64` é hive separado por padrão.

### Códigos de saída

| Código | Significado |
|--------|-------------|
| 0 | Sucesso (dry-run completo, ou apply com 0 erros, ou interactive `q` com 0 erros antes do quit) |
| 1 | Erro de pré-condição (sem admin após eleve, sem termo, dir inacessível, stdin não-interativo sem `-Yes`) |
| 2 | Termo perigoso sem `-Force`, ou termo < 4 chars sem `-Force` |
| 3 | Falha em criar backup quando `-Apply` (apply abortado) |
| 4 | Apply rodou mas com erros parciais — inclui interactive `q` quando já houve ao menos 1 erro |
| 130 | Usuário cancelou no prompt de confirmação `APAGAR` |

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

1. **Resolver `-OutDir` para path absoluto** imediatamente (antes de qualquer eleve, pra não cair em `C:\Windows\system32` no processo elevado).
2. **Verificar elevação.** Se não admin: usar `Start-Process powershell -Verb RunAs -Wait -ArgumentList <args>` mantendo args originais (incluindo `-OutDir <abs>`). O processo pai espera o filho terminar e propaga o exit code do filho. Se o usuário cancela UAC → exit 1.
3. Verificar stdin: se não-interativo (`[Console]::IsInputRedirected -eq $true`) **e** `-Apply` foi passado **e** `-Yes` não foi → aborta código 1 com mensagem clara.
4. Validar `-Termo`: ao menos um termo, todos com ≥ 4 chars (a menos que `-Force`).
5. Validar termos perigosos (`microsoft`, `windows`, `system`, `intel`, `nvidia`, `amd`, `realtek`, `driver`, `kernel`, `policies`). Match (substring) sem `-Force` → aborta código 2.
6. Resolver `-Hives` aliases pra paths PSDrive (ver tabela em "Aliases de hive").
7. Criar `-OutDir` se não existir. Falha → aborta código 1.

**Convenção `-Force`:** habilita ambos os gates (termo curto + termo perigoso) simultaneamente. Se você precisa de granularidade, edite o script — não vale o overhead de duas flags.

### Fase 1 — Varredura (sempre executa)

Para cada hive:
1. `Get-ChildItem -Path "Registry::<hive>" -Recurse -Force -ErrorAction SilentlyContinue` — chaves inacessíveis caem em `$Error` mas não interrompem.
2. Pra cada chave visitada:
   - Comparar último segmento do path contra cada termo (substring case-insensitive). Hit → registro com `Type=Key, MatchedOn=KeyName`.
   - `Get-ItemProperty` da chave; pra cada valor:
     - Comparar nome do valor contra cada termo. **O valor `(default)` / `(Padrão)`** (que aparece como nome vazio no PowerShell) **não participa do matching de nome** (string vazia nunca casa nada). **Mas o dado do `(default)` participa normalmente do matching de dado.** Hit em nome → `Type=Value, MatchedOn=ValueName`.
     - Converter dado pra string (ver "Conversão de tipo" abaixo) e comparar contra cada termo. Hit → `Type=Value, MatchedOn=ValueData`.
3. Aplicar denylist embutida + `-Exclude`: caminhos que batem viram `Action=Skip(denylist)` mas continuam no relatório (visibilidade).

**Conversão de tipo** (`Get-ValueDataAsString`):

| Tipo registry | Conversão |
|---------------|-----------|
| `REG_SZ`, `REG_EXPAND_SZ` | string direto |
| `REG_MULTI_SZ` | join com `\n` |
| `REG_DWORD` | duas strings: decimal `$value.ToString()` e hex lowercase com prefixo `0x` sem padding (`0x1`, `0x1f`, `0xdeadbeef`). Termo casa se substring de qualquer uma. |
| `REG_QWORD` | mesma regra do DWORD (decimal + `0x` lowercase sem padding). |
| `REG_BINARY` | hex lowercase com bytes separados por `-`, sem prefixo (`01-02-ab-cd`). |
| `REG_NONE` / desconhecido | pula comparação de dado |

**Por que hex sem padding:** evita falso-positivo do tipo termo `0a` casando todo dword com byte `0A`. Padding zero levaria a muitos hits espúrios; sem padding, `0xa` exige o usuário buscar literalmente `0xa`. Pra dados binários (que são naturalmente paddeados byte-a-byte), o `-` separador limita a substring a no máximo 2 chars consecutivos sem hifen.

### Fase 2 — Otimizar plano (`Optimize-MatchPlan`)

1. Coletar todos os `DeleteKey`. Ordenar por path.
2. Pra cada match (não-Skip), verificar se algum ancestral está marcado `DeleteKey`. Se sim → descartar (redundante; será apagado em cascata).
3. Ordenar `DeleteKey` por profundidade decrescente (folhas primeiro).
4. Ordenar `DeleteValue` antes de `DeleteKey` que afeta seu path-pai (não estritamente necessário, mas ajuda no log).

### Fase 3 — Backup (só se `-Apply` e há matches a apagar)

1. Criar pasta `output/backup-YYYY-MM-DD-HHMMSS/` (uma pasta por execução).
2. Coletar set único de chaves a tocar (pra `DeleteKey`, a própria; pra `DeleteValue`, a chave pai).
3. Pra cada chave, gerar nome de arquivo seguro (substituir `\:*?"<>|` por `_`, truncar em 200 chars + hash do path original) e exportar via `reg.exe export "<full-path>" "<safe-name>.reg" /y`.
4. **Não concatenar** os `.reg` (concatenação gera múltiplos headers `Windows Registry Editor Version 5.00` e BOMs intercaladas, o que quebra re-import). Cada chave fica num `.reg` próprio dentro da pasta da execução. Restauração: usuário dá duplo-clique em cada `.reg` ou roda `for %f in (*.reg) do reg import "%f"`.
5. Escrever um `manifest.txt` na pasta listando, em ordem, cada `.reg` e o path de registry que ele cobre.
6. Falha em qualquer export → aborta código 3 (sem apply). Pasta parcial fica pro usuário inspecionar.
7. Imprimir caminho da pasta de backup.

**Tamanho do backup:** o `reg.exe export` exporta a chave **e toda a sua subárvore**. Pra `DeleteKey`, isso é desejado (vai ser tudo apagado). Pra `DeleteValue`, exporta a chave pai inteira — pode ser muito maior que só o valor afetado, mas é o trade-off por ter um backup que `regedit` reimporta sem fricção. Aviso amarelo se backup total excede 100MB.

### Fase 4 — Confirmação (só se `-Apply`)

Mostrar resumo:
```
Vai apagar X chaves e Y valores em N hives.
Backup salvo em: <path da pasta>
Skips: Z (ver report.log)

Pra confirmar, digite APAGAR (em maiúsculas):
```

Input ≠ `APAGAR` (case-sensitive) → cancela código 130.

Se `-Yes` foi passado, pula o prompt e prossegue (mas sempre imprime o resumo). Se stdin é não-interativo e `-Yes` não foi passado, Fase 0 já abortou — aqui assumimos stdin disponível.

**Aviso > 5000 matches:** se total (chaves + valores) > 5000, exibir warning vermelho `Plano grande (X itens). Recomendado revisar report.csv antes de confirmar.` antes do prompt.

### Fase 5 — Execução (só se `-Apply` ou `-Interactive`)

Pra cada item do plano:
- `-Interactive`: chamar `Show-InteractivePrompt` antes de cada delete. Retorna `s|n|a|q`. `a` setа flag `applyAll=true` que faz `Show-InteractivePrompt` retornar `s` em todas as chamadas seguintes sem perguntar. `q` interrompe a execução.
- `DeleteKey`: `Remove-Item -Path "Registry::..." -Recurse -Force -ErrorAction Stop`
- `DeleteValue`: `Remove-ItemProperty -Path "Registry::<keyPath>" -Name "<valueName>" -Force -ErrorAction Stop`
- Erro: capturar exceção, classificar (`AccessDenied` / `InUse` / `NotFound` / `Other`), marcar item `Action=Skip(motivo)`, continuar.

**Exit code:**
- 0 erros → 0
- ≥ 1 erro → 4
- `-Interactive` `q` antes de qualquer delete → 0
- `-Interactive` `q` após pelo menos 1 erro → 4
- `-Interactive` `q` após sucesso parcial sem erros → 0

### Fase 6 — Relatório

Sempre escreve `report-YYYY-MM-DD-HHMMSS.log` e `.csv` em `-OutDir`.

**`.log` formato:**
```
limpar-registros.ps1 — 2026-05-07 14:30:22
Modo: dry-run | apply | interactive
Termos: autodesk, autocad
Hives: HKLM\SOFTWARE, HKLM\SOFTWARE\WOW6432Node, HKCU\SOFTWARE, HKCR
Backup: output/backup-2026-05-07-143022/  (ou: nenhum em dry-run)

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

**CSV — encoding e delimitador:** UTF-8 com BOM, delimitador `;` (compatível com Excel em locale PT-BR — `,` quebra colunas no Excel local). Strings com `;`, `"` ou newline são quotadas com `"` e `"` interno escapado como `""`.

**Logging contract — stdout vs .log:**
- `stdout` (console): banner inicial, validações de pré-condição, sumário de Fase 1, prompt de confirmação Fase 4, prompts interativos Fase 5, sumário final. Erros vão pro `stderr`.
- `.log`: tudo que vai pro stdout **+** lista detalhada de cada match (igual à seção `=== HKLM\... ===` mostrada acima). O `.log` é a referência completa; o stdout é resumo.

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
Show-ConfirmPrompt                # plano + bypassYes -> bool (digitou APAGAR ou bypassou?)
Show-InteractivePrompt            # item + [ref]applyAllFlag -> 's'|'n'|'q' (nunca 'a' — 'a' já foi consumido setando applyAllFlag=$true)
Write-Report                      # array + metadados -> log + csv
```

Cada função recebe input explícito e retorna output explícito. Estado global mínimo: `$script:Logger` (objeto com métodos Info/Warn/Error que escrevem em console + buffer pro `.log`) e `$script:applyAll` (flag setada por `[a]plicar tudo`).

**Boundary `Invoke-DeletionPlan` ↔ `Show-InteractivePrompt`:** `Invoke-DeletionPlan` decide *quando* perguntar (só se `-Interactive` e `applyAll==false`); `Show-InteractivePrompt` é a UI pura. Isso mantém `Show-InteractivePrompt` testável manualmente sem rodar o plano todo.

## Denylist embutida

Aplicada a *todos* os matches, mesmo com `-Force`. Apenas `-Exclude` é cumulativo (você adiciona mais, não remove os embutidos).

A denylist é uma **lista de regras**, cada uma com `pattern` e `mode`:

| Pattern | Mode | Significa |
|---------|------|-----------|
| `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\*` | `wildcard-with-exception` | Skip se path bate, **exceto** se também bate `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*` |
| `HKLM\SOFTWARE\Microsoft\Windows NT\*` | `wildcard` | Skip se path bate |
| `HKLM\SOFTWARE\Microsoft\Cryptography\*` | `wildcard` | Skip se path bate |
| `HKLM\SOFTWARE\Policies\*` | `wildcard` | Skip se path bate |
| `HKLM\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\*` | `wildcard-with-exception` | Idem, exceção `\Uninstall\*` |
| `HKLM\SOFTWARE\WOW6432Node\Microsoft\Windows NT\*` | `wildcard` | Skip se path bate |
| `HKEY_CLASSES_ROOT\CLSID` | `exact-only` | Skip **somente** se path == este (subchaves liberadas) |
| `HKEY_CLASSES_ROOT\Interface` | `exact-only` | Idem |
| `HKEY_CLASSES_ROOT\TypeLib` | `exact-only` | Idem |

**Predicado `Test-PathInDenylist(path, rules)` (pseudocódigo):**
```
foreach rule in rules:
    if rule.mode == "exact-only":
        if path -ieq rule.pattern: return $true
    elif rule.mode == "wildcard":
        if path -ilike rule.pattern: return $true
    elif rule.mode == "wildcard-with-exception":
        if path -ilike rule.pattern and not (path -ilike rule.exceptionPattern):
            return $true
return $false
```

`Uninstall\*` é exceção explícita porque é exatamente onde lixo de software desinstalado mora (entradas `Add/Remove Programs`). Toda a subárvore de `Uninstall` é liberada — o usuário pode apagar `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{Autodesk-GUID}` inteira.

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
3. **Apply real no cenário acima** — confirma pasta `backup-XXX/` criada com 1 `.reg` por chave + `manifest.txt`, chaves apagadas, restauração via `for %f in (output\backup-XXX\*.reg) do reg import "%f"` (ou duplo-clique em cada um) recupera tudo.

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

## Convenções

- Spec, comentários e mensagens ao usuário em **português brasileiro**.
- Nomes de função, parâmetro, variável e flag em **inglês** (PowerShell convention: `Verb-Noun`, parâmetros PascalCase).
- Encoding de arquivos gerados: UTF-8 com BOM (`.log`, `.csv`, `manifest.txt`).
- Encoding do `.reg`: UTF-16 LE com BOM (formato exigido pelo `reg.exe import`).

## Fora de escopo (futuro)

- Suporte a regex.
- Modo "wizard" interativo pra escolher hives via menu.
- Integração com System Restore Point automático.
- GUI.
- Suporte a remote registry (outro PC na rede).
- Pré-sets nomeados (ex.: `--preset autodesk` que carrega lista de termos `autodesk,autocad,acad,adsk,...`).
