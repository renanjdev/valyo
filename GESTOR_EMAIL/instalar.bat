@echo off
setlocal enabledelayedexpansion
title Gestor Email CERPRO - Instalacao

echo.
echo  ============================================
echo    Gestor Email CERPRO  -  Instalador
echo  ============================================
echo.

:: ── Pasta de instalacao ────────────────────────────────────────────────────────
set "INSTALL_DIR=C:\GESTOR_EMAIL"
set "REPO_ZIP=https://github.com/renanjdev/gestor-email/archive/refs/heads/main.zip"
set "SHORTCUT=%USERPROFILE%\Desktop\Gestor Email CERPRO.lnk"

:: ── 1. Node.js ─────────────────────────────────────────────────────────────────
echo  [1/5] Verificando Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo        Instalando Node.js automaticamente...
    echo        (aguarde, pode levar alguns minutos)
    echo.

    winget install --id OpenJS.NodeJS.LTS -e --silent ^
        --accept-package-agreements --accept-source-agreements >nul 2>&1

    :: Atualizar PATH da sessao
    for /f "tokens=2*" %%A in (
        'reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul'
    ) do set "PATH=%%B;%PATH%"

    node --version >nul 2>&1
    if %errorlevel% neq 0 (
        :: Fallback: baixar MSI direto
        echo        Baixando instalador do nodejs.org...
        powershell -NoProfile -Command ^
            "Invoke-WebRequest 'https://nodejs.org/dist/v20.19.1/node-v20.19.1-x64.msi' -OutFile '$env:TEMP\nodejs.msi'"
        msiexec /i "%TEMP%\nodejs.msi" /qn /norestart
        del "%TEMP%\nodejs.msi" >nul 2>&1
        for /f "tokens=2*" %%A in (
            'reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul'
        ) do set "PATH=%%B;%PATH%"
    )

    node --version >nul 2>&1
    if %errorlevel% neq 0 (
        echo.
        echo  ERRO: Nao foi possivel instalar o Node.js.
        echo  Acesse https://nodejs.org, instale o botao "LTS" e rode este arquivo novamente.
        echo.
        pause & exit /b 1
    )
    echo        Node.js instalado!
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

powershell -NoProfile -Command ^
    "Invoke-WebRequest '%REPO_ZIP%' -OutFile '$env:TEMP\gestor-email.zip'"
if %errorlevel% neq 0 (
    echo.
    echo  ERRO: Nao foi possivel baixar os arquivos. Verifique a conexao com a internet.
    echo.
    pause & exit /b 1
)

echo        Extraindo arquivos...
if exist "%INSTALL_DIR%" rmdir /s /q "%INSTALL_DIR%"
powershell -NoProfile -Command ^
    "Expand-Archive '$env:TEMP\gestor-email.zip' -DestinationPath 'C:\' -Force; " ^
    "Rename-Item 'C:\gestor-email-main' 'GESTOR_EMAIL'"
del "%TEMP%\gestor-email.zip" >nul 2>&1

if not exist "%INSTALL_DIR%" (
    echo.
    echo  ERRO: Falha ao extrair os arquivos.
    echo.
    pause & exit /b 1
)
echo        Arquivos baixados em %INSTALL_DIR%

:install_deps
:: ── 3. Dependencias ────────────────────────────────────────────────────────────
echo.
echo  [3/5] Instalando dependencias...

cd /d "%INSTALL_DIR%\worker"
if not exist "node_modules" (
    echo        Instalando pacotes do worker (aguarde)...
    call npm install --prefer-offline --no-audit --no-fund >nul 2>&1
    if %errorlevel% neq 0 (
        echo  ERRO ao instalar dependencias. Verifique a conexao com a internet.
        pause & exit /b 1
    )
)

if not exist "web\node_modules" (
    echo        Instalando pacotes da interface web (aguarde)...
    cd web
    call npm install --prefer-offline --no-audit --no-fund >nul 2>&1
    if %errorlevel% neq 0 (
        echo  ERRO ao instalar dependencias da interface.
        pause & exit /b 1
    )
    cd ..
)
echo        Dependencias instaladas.

:: ── 4. Build ───────────────────────────────────────────────────────────────────
echo.
echo  [4/5] Compilando o sistema...

if not exist "dist\index.js" (
    echo        Compilando TypeScript + React (aguarde ~30s)...
    call npm run build >nul 2>&1
    if %errorlevel% neq 0 (
        echo.
        echo  ERRO durante a compilacao. Detalhes:
        call npm run build
        pause & exit /b 1
    )
)
echo        Sistema compilado.

:: ── 5. Atalho na area de trabalho ─────────────────────────────────────────────
echo.
echo  [5/5] Criando atalho na area de trabalho...

powershell -NoProfile -Command ^
    "$ws = New-Object -ComObject WScript.Shell; " ^
    "$s = $ws.CreateShortcut('%SHORTCUT%'); " ^
    "$s.TargetPath = '%INSTALL_DIR%\iniciar.vbs'; " ^
    "$s.WorkingDirectory = '%INSTALL_DIR%'; " ^
    "$s.IconLocation = '%SystemRoot%\System32\SHELL32.dll,12'; " ^
    "$s.Description = 'Gestor Email CERPRO'; " ^
    "$s.Save()" >nul 2>&1

if exist "%SHORTCUT%" (
    echo        Atalho criado na area de trabalho!
) else (
    echo        Atalho nao criado - acesse diretamente: %INSTALL_DIR%\iniciar.vbs
)

:: ── Concluido ──────────────────────────────────────────────────────────────────
echo.
echo  ============================================
echo    Pronto! Instalacao concluida.
echo  ============================================
echo.
echo  Para usar:  clique duas vezes no icone
echo              "Gestor Email CERPRO" na area de trabalho.
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
