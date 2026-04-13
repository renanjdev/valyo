@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title Gestor Email CERPRO - Instalacao

echo.
echo  ============================================
echo    Gestor Email CERPRO  -  Instalador
echo  ============================================
echo.

:: ── 1. Node.js ────────────────────────────────────────────────────────────────
echo  [1/4] Verificando Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo        Node.js nao encontrado. Instalando...
    echo        (isso pode levar alguns minutos, aguarde)
    echo.

    :: Tentar via winget (Windows 10/11 com App Installer)
    winget install --id OpenJS.NodeJS.LTS -e --silent ^
        --accept-package-agreements --accept-source-agreements >nul 2>&1

    :: Verificar se instalou
    where node >nul 2>&1
    if %errorlevel% neq 0 (
        :: Fallback: baixar MSI direto do nodejs.org
        echo        Baixando instalador do Node.js...
        powershell -NoProfile -Command ^
            "Invoke-WebRequest 'https://nodejs.org/dist/v20.19.1/node-v20.19.1-x64.msi' -OutFile '$env:TEMP\nodejs.msi'" >nul 2>&1
        echo        Instalando Node.js (aguarde)...
        msiexec /i "%TEMP%\nodejs.msi" /qn /norestart >nul 2>&1
        del "%TEMP%\nodejs.msi" >nul 2>&1

        :: Atualizar PATH na sessao atual
        for /f "tokens=2*" %%A in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set "SYS_PATH=%%B"
        set "PATH=%SYS_PATH%;%PATH%"
    )

    :: Verificar novamente
    node --version >nul 2>&1
    if %errorlevel% neq 0 (
        echo.
        echo  ERRO: Nao foi possivel instalar o Node.js automaticamente.
        echo  Acesse https://nodejs.org e instale manualmente (botao LTS).
        echo  Depois execute este arquivo novamente.
        echo.
        pause
        exit /b 1
    )
    echo        Node.js instalado com sucesso!
) else (
    for /f %%V in ('node --version') do echo        Node.js %%V ja instalado.
)

:: ── 2. Dependencias ────────────────────────────────────────────────────────────
echo.
echo  [2/4] Instalando dependencias...

if not exist "worker\node_modules" (
    echo        Instalando pacotes do worker...
    cd worker
    call npm install --prefer-offline --no-audit --no-fund >nul 2>&1
    if %errorlevel% neq 0 (
        echo  ERRO ao instalar dependencias do worker.
        pause & exit /b 1
    )
    cd ..
) else (
    echo        Dependencias do worker ja instaladas.
)

if not exist "worker\web\node_modules" (
    echo        Instalando pacotes da interface web...
    cd worker\web
    call npm install --prefer-offline --no-audit --no-fund >nul 2>&1
    if %errorlevel% neq 0 (
        echo  ERRO ao instalar dependencias da interface web.
        pause & exit /b 1
    )
    cd ..\..
) else (
    echo        Dependencias da interface ja instaladas.
)

:: ── 3. Build ────────────────────────────────────────────────────────────────
echo.
echo  [3/4] Compilando o sistema...

if not exist "worker\dist\index.js" (
    echo        Compilando TypeScript + React (aguarde ~30s)...
    cd worker
    call npm run build >nul 2>&1
    if %errorlevel% neq 0 (
        echo  ERRO durante a compilacao.
        echo  Tente rodar manualmente: cd worker ^&^& npm run build
        pause & exit /b 1
    )
    cd ..
) else (
    echo        Sistema ja compilado.
)

:: ── 4. Atalho na area de trabalho ─────────────────────────────────────────────
echo.
echo  [4/4] Criando atalho na area de trabalho...

set "DEST=%USERPROFILE%\Desktop\Gestor Email CERPRO.lnk"
set "TARGET=%~dp0iniciar.vbs"
set "ICON=%SystemRoot%\System32\SHELL32.dll,12"

powershell -NoProfile -Command ^
    "$ws = New-Object -ComObject WScript.Shell; " ^
    "$s = $ws.CreateShortcut('%DEST%'); " ^
    "$s.TargetPath = '%TARGET%'; " ^
    "$s.WorkingDirectory = '%~dp0'; " ^
    "$s.IconLocation = '%ICON%'; " ^
    "$s.Description = 'Gestor Email CERPRO'; " ^
    "$s.Save()" >nul 2>&1

if exist "%DEST%" (
    echo        Atalho criado na area de trabalho!
) else (
    echo        (nao foi possivel criar o atalho - crie manualmente)
)

:: ── Concluido ──────────────────────────────────────────────────────────────────
echo.
echo  ============================================
echo    Instalacao concluida com sucesso!
echo  ============================================
echo.
echo  Para usar o sistema:
echo    - Clique duas vezes em "Gestor Email CERPRO"
echo      na area de trabalho
echo    - Na primeira abertura, configure seu
echo      e-mail e a chave da API
echo.

set /p ABRIR="  Deseja abrir o sistema agora? [S/N]: "
if /i "%ABRIR%"=="S" (
    echo.
    echo  Iniciando...
    start "" wscript.exe "%~dp0iniciar.vbs"
    timeout /t 3 /nobreak >nul
    start "" http://localhost:3030
)

echo.
pause
