' iniciar.vbs — Inicia o Gestor Email sem abrir janela de terminal.
' Coloque o atalho deste arquivo na area de trabalho.
Dim shell
Set shell = CreateObject("WScript.Shell")
Dim scriptDir
scriptDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
shell.Run "cmd /c cd /d """ & scriptDir & """ && node worker\dist\index.js > worker\data\worker.log 2>&1", 0, False
