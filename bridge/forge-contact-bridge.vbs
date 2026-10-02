Option Explicit

Dim shell, fileSystem, bridgeScript, command
Set shell = CreateObject("WScript.Shell")
Set fileSystem = CreateObject("Scripting.FileSystemObject")

bridgeScript = fileSystem.BuildPath(fileSystem.GetParentFolderName(WScript.ScriptFullName), "forge-contact-bridge.ps1")
command = "powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File """ & bridgeScript & """"

' Window style 0 keeps the scheduled poll completely hidden.
shell.Run command, 0, True
