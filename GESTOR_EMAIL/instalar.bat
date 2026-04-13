@echo off
setlocal enabledelayedexpansion
title Gestor Email CERPRO - Instalacao

echo.
echo  ============================================
echo    Gestor Email CERPRO  -  Instalador
echo  ============================================
echo.

set "INSTALL_DIR=C:\GESTOR_EMAIL"
set "REPO_ZIP=https://github.com/renanjdev/gestor-email/archive/refs/heads/main.zip"
set "ZIP_FILE=%TEMP%\gestor-email.zip"
set "EXTRACT_DIR=%TEMP%\gestor-email-extract"
set "SHORTCUT=%USERPROFILE%\Desktop\Gestor Email CERPRO.lnk"

:: ── 1. Node.js ─────────────────────────────────────────────────────────────────
echo  [1/5] Verificando Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo        Node.js nao encontrado. Instalando...

    winget install --id OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements >nul 2>&1

    :: Atualizar PATH da sessao atual
    for /f "tokens=2*" %%A in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set "PATH=%%B;%PATH%"

    node --version >nul 2>&1
    if !errorlevel! neq 0 (
        echo        Baixando instalador do Node.js...
        powershell -NoProfile -Command "Invoke-WebRequest 'https://nodejs.org/dist/v20.19.1/node-v20.19.1-x64.msi' -OutFile '%TEMP%\nodejs.msi'"
        msiexec /i "%TEMP%\nodejs.msi" /qn /norestart
        del "%TEMP%\nodejs.msi" >nul 2>&1
        for /f "tokens=2*" %%A in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set "PATH=%%B;!PATH!"
    )

    node --version >nul 2>&1
    if !errorlevel! neq 0 (
        echo.
        echo  ERRO: Nao foi possivel instalar o Node.js automaticamente.
        echo  Acesse https://nodejs.org e instale o botao "LTS" manualmente.
        echo  Depois execute este arquivo novamente.
        echo.
        pause & exit /b 1
    )
    echo        Node.js instalado com sucesso!
) else (
    for /f %%V in ('node --version') do echo        Node.js %%V encontrado.
)

:: ── 2. Baixar o programa ───────────────────────────────────────────────────────
echo.
echo  [2/5] Baixando o Gestor Email...

if exist "%INSTALL_DIR%\worker\src" (
    echo        Arquivos ja existem em %INSTALL_DIR%. Pulando download.
    goto :install_deps
)

echo        Baixando arquivos do GitHub...
powershell -NoProfile -Command "Invoke-WebRequest '%REPO_ZIP%' -OutFile '%ZIP_FILE%'"
if %errorlevel% neq 0 (
    echo.
    echo  ERRO: Nao foi possivel baixar os arquivos.
    echo  Verifique a conexao com a internet e tente novamente.
    echo.
    pause & exit /b 1
)

echo        Extraindo arquivos...
if exist "%EXTRACT_DIR%" rmdir /s /q "%EXTRACT_DIR%"
powershell -NoProfile -Command "Expand-Archive '%ZIP_FILE%' -DestinationPath '%EXTRACT_DIR%' -Force"
del "%ZIP_FILE%" >nul 2>&1

if exist "%INSTALL_DIR%" rmdir /s /q "%INSTALL_DIR%"
move "%EXTRACT_DIR%\gestor-email-main" "%INSTALL_DIR%" >nul
rmdir /s /q "%EXTRACT_DIR%" >nul 2>&1

if not exist "%INSTALL_DIR%" (
    echo.
    echo  ERRO: Falha ao extrair os arquivos.
    echo.
    pause & exit /b 1
)
echo        Arquivos instalados em %INSTALL_DIR%

:install_deps
:: ── 3. Dependencias ────────────────────────────────────────────────────────────
echo.
echo  [3/5] Instalando dependencias...

cd /d "%INSTALL_DIR%\worker"

if not exist "node_modules" (
    echo        Instalando pacotes do worker (aguarde)...
    call npm install --prefer-offline --no-audit --no-fund
    if !errorlevel! neq 0 (
        echo  ERRO ao instalar dependencias do worker.
        pause & exit /b 1
    )
) else (
    echo        Dependencias do worker ja instaladas.
)

if not exist "web\node_modules" (
    echo        Instalando pacotes da interface (aguarde)...
    cd web
    call npm install --prefer-offline --no-audit --no-fund
    if !errorlevel! neq 0 (
        echo  ERRO ao instalar dependencias da interface.
        pause & exit /b 1
    )
    cd ..
) else (
    echo        Dependencias da interface ja instaladas.
)

:: ── 4. Build ───────────────────────────────────────────────────────────────────
echo.
echo  [4/5] Compilando o sistema (aguarde ~30s)...

if not exist "dist\index.js" (
    call npm run build
    if !errorlevel! neq 0 (
        echo.
        echo  ERRO durante a compilacao.
        pause & exit /b 1
    )
) else (
    echo        Sistema ja compilado.
)

:: ── 5. Atalho na area de trabalho ─────────────────────────────────────────────
echo.
echo  [5/5] Criando atalho na area de trabalho...

set "VBS_PATH=%INSTALL_DIR%\iniciar.vbs"
powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT%'); $s.TargetPath = '%VBS_PATH%'; $s.WorkingDirectory = '%INSTALL_DIR%'; $s.IconLocation = '%SystemRoot%\System32\SHELL32.dll,12'; $s.Description = 'Gestor Email CERPRO'; $s.Save()"

if exist "%SHORTCUT%" (
    echo        Atalho criado na area de trabalho!
) else (
    echo        (crie o atalho manualmente a partir de: %VBS_PATH%)
)

:: ── Concluido ──────────────────────────────────────────────────────────────────
echo.
echo  ============================================
echo    Pronto! Instalacao concluida.
echo  ============================================
echo.
echo  Para usar: clique duas vezes no icone
echo             "Gestor Email CERPRO" na area de trabalho.
echo.
echo  Na primeira abertura, configure seu e-mail
echo  e a chave da API fornecida pelo TI.
echo.

set /p ABRIR="  Abrir agora? [S/N]: "
if /i "!ABRIR!"=="S" (
    start "" wscript.exe "%INSTALL_DIR%\iniciar.vbs"
    timeout /t 3 /nobreak >nul
    start "" http://localhost:3030
)

echo.
pause
