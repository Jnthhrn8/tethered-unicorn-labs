Option Explicit

Dim shell, fileSystem, folder, executable, config, command
Set shell = CreateObject("WScript.Shell")
Set fileSystem = CreateObject("Scripting.FileSystemObject")

folder = fileSystem.GetParentFolderName(WScript.ScriptFullName)
executable = fileSystem.BuildPath(folder, "ntfy.exe")
config = fileSystem.BuildPath(folder, "server.yml")
command = """" & executable & """ serve --config """ & config & """"

' Launch the long-running private server without creating a console window.
shell.Run command, 0, False
