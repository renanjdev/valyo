@echo off
setlocal enabledelayedexpansion
title Gestor Email CERPRO - Instalador

set "INSTALL_DIR=C:\GESTOR_EMAIL"
set "REPO_ZIP=https://github.com/renanjdev/gestor-email/archive/refs/heads/main.zip"
set "ZIP_FILE=%TEMP%\gestor-email.zip"
set "EXTRACT_DIR=%TEMP%\gestor-email-extract"
set "SHORTCUT=%USERPROFILE%\Desktop\Gestor Email CERPRO.lnk"

goto :inicio

:: --- Subrotina: redesenha tela com barra de progresso -----------------------
:tela
cls
echo.
echo  ================================================
echo    Gestor Email CERPRO  -  Instalador
echo  ================================================
echo.
set /a "PCT=(%~1 * 100) / %~2"
set /a "FILLED=(%~1 * 20) / %~2"
set /a "EMPTY=20 - !FILLED!"
set "BAR="
for /l %%i in (1,1,!FILLED!) do set "BAR=!BAR!#"
for /l %%i in (1,1,!EMPTY!)  do set "BAR=!BAR!-"
echo   Progresso: [!BAR!] !PCT!%%
echo.
echo  ------------------------------------------------
echo   Etapa %~1 de %~2: %~3
if not "%~4"=="" echo   %~4
echo  ------------------------------------------------
echo.
goto :eof

:inicio
:: ======================================================================
:: ETAPA 1 - Node.js
:: ======================================================================
call :tela 0 5 "Verificando Node.js..." ""

node --version >nul 2>&1
if %errorlevel% neq 0 (
    call :tela 0 5 "Instalando Node.js..." "Aguarde, pode levar alguns minutos"

    winget install --id OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements >nul 2>&1

    for /f "tokens=2*" %%A in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set "PATH=%%B;%PATH%"

    node --version >nul 2>&1
    if !errorlevel! neq 0 (
        call :tela 0 5 "Baixando instalador do Node.js..." "A janela pode parecer travada - aguarde"
        powershell -NoProfile -Command "Invoke-WebRequest 'https://nodejs.org/dist/v20.19.1/node-v20.19.1-x64.msi' -OutFile '%TEMP%\nodejs.msi'"
        msiexec /i "%TEMP%\nodejs.msi" /qn /norestart
        del "%TEMP%\nodejs.msi" >nul 2>&1
        for /f "tokens=2*" %%A in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set "PATH=%%B;!PATH!"
    )

    node --version >nul 2>&1
    if !errorlevel! neq 0 (
        echo.
        echo  ERRO: Nao foi possivel instalar o Node.js.
        echo  Acesse https://nodejs.org e instale a versao "LTS" manualmente.
        echo  Depois execute este arquivo novamente.
        echo.
        pause & exit /b 1
    )
)

for /f %%V in ('node --version') do set "NODE_VER=%%V"
call :tela 1 5 "Node.js OK" "Versao: !NODE_VER!"
timeout /t 1 /nobreak >nul

:: ======================================================================
:: ETAPA 2 - Baixar arquivos
:: ======================================================================
if exist "%INSTALL_DIR%\worker\src" (
    call :tela 2 5 "Arquivos ja instalados" "Local: %INSTALL_DIR%"
    timeout /t 1 /nobreak >nul
    goto :instalar_deps
)

call :tela 1 5 "Baixando Gestor Email do GitHub..." "Aguarde o download concluir"

powershell -NoProfile -Command "Invoke-WebRequest '%REPO_ZIP%' -OutFile '%ZIP_FILE%'"
if %errorlevel% neq 0 (
    echo.
    echo  ERRO: Nao foi possivel baixar os arquivos.
    echo  Verifique a conexao com a internet e tente novamente.
    echo.
    pause & exit /b 1
)

call :tela 1 5 "Extraindo arquivos..." ""

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

call :tela 2 5 "Arquivos baixados" "Local: %INSTALL_DIR%"
timeout /t 1 /nobreak >nul

:instalar_deps
:: ======================================================================
:: ETAPA 3 - Dependencias
:: ======================================================================
cd /d "%INSTALL_DIR%\worker"

if not exist "node_modules" (
    call :tela 2 5 "Instalando pacotes do sistema..." "npm install - pode levar 1 a 2 minutos"
    call npm install --prefer-offline --no-audit --no-fund
    if !errorlevel! neq 0 (
        echo.
        echo  ERRO ao instalar dependencias.
        pause & exit /b 1
    )
) else (
    call :tela 2 5 "Pacotes do sistema ja instalados" ""
    timeout /t 1 /nobreak >nul
)

if not exist "web\node_modules" (
    call :tela 2 5 "Instalando pacotes da interface..." "npm install - pode levar 1 minuto"
    cd web
    call npm install --prefer-offline --no-audit --no-fund
    if !errorlevel! neq 0 (
        echo.
        echo  ERRO ao instalar dependencias da interface.
        pause & exit /b 1
    )
    cd ..
) else (
    call :tela 2 5 "Pacotes da interface ja instalados" ""
    timeout /t 1 /nobreak >nul
)

call :tela 3 5 "Dependencias instaladas" ""
timeout /t 1 /nobreak >nul

:: ======================================================================
:: ETAPA 4 - Build
:: ======================================================================
cd /d "%INSTALL_DIR%\worker"

if not exist "dist\index.js" (
    call :tela 3 5 "Compilando o sistema..." "TypeScript + React - aproximadamente 30 segundos"
    call npm run build
    if !errorlevel! neq 0 (
        echo.
        echo  ERRO durante a compilacao.
        pause & exit /b 1
    )
) else (
    call :tela 3 5 "Sistema ja compilado" ""
    timeout /t 1 /nobreak >nul
)

call :tela 4 5 "Sistema compilado" ""
timeout /t 1 /nobreak >nul

:: ======================================================================
:: ETAPA 5 - Atalho
:: ======================================================================
call :tela 4 5 "Criando atalho na area de trabalho..." ""

set "VBS_PATH=%INSTALL_DIR%\iniciar.vbs"
powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT%'); $s.TargetPath = '%VBS_PATH%'; $s.WorkingDirectory = '%INSTALL_DIR%'; $s.IconLocation = '%SystemRoot%\System32\SHELL32.dll,12'; $s.Description = 'Gestor Email CERPRO'; $s.Save()"

call :tela 5 5 "Instalacao concluida!" ""
echo.
echo  ================================================
echo    Pronto! Instalacao concluida com sucesso.
echo  ================================================
echo.
echo   Para usar:
echo   1. Clique duas vezes no icone na area de trabalho:
echo      "Gestor Email CERPRO"
echo.
echo   2. Na primeira abertura, informe seu e-mail
echo      e a chave da API fornecida pelo TI.
echo.
echo  ================================================
echo.

set /p ABRIR="  Abrir o sistema agora? [S/N]: "
if /i "!ABRIR!"=="S" (
    echo.
    echo  Iniciando...
    start "" wscript.exe "%INSTALL_DIR%\iniciar.vbs"
    timeout /t 3 /nobreak >nul
    start "" http://localhost:3030
)

echo.
pause
