param(
  [Parameter(Mandatory = $true)][string]$NodeExecutable,
  [Parameter(Mandatory = $true)][string]$WranglerScript,
  [Parameter(Mandatory = $true)][string]$WorkerDirectory,
  [Parameter(Mandatory = $true)][string]$BridgeConfigPath
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security
$bytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
$token = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')

$start = [System.Diagnostics.ProcessStartInfo]::new()
$start.FileName = $NodeExecutable
$start.ArgumentList.Add($WranglerScript)
$start.ArgumentList.Add('secret')
$start.ArgumentList.Add('put')
$start.ArgumentList.Add('FORGE_INBOX_TOKEN')
$start.WorkingDirectory = $WorkerDirectory
$start.UseShellExecute = $false
$start.RedirectStandardInput = $true
$start.RedirectStandardOutput = $true
$start.RedirectStandardError = $true
$start.CreateNoWindow = $true
$process = [System.Diagnostics.Process]::Start($start)
$process.StandardInput.WriteLine($token)
$process.StandardInput.Close()
$stdout = $process.StandardOutput.ReadToEnd()
$stderr = $process.StandardError.ReadToEnd()
$process.WaitForExit()
if ($process.ExitCode -ne 0) { throw "Cloudflare secret setup failed: $stderr $stdout" }

$protected = [System.Security.Cryptography.ProtectedData]::Protect(
  [Text.Encoding]::UTF8.GetBytes($token),
  $null,
  [System.Security.Cryptography.DataProtectionScope]::CurrentUser
)
$config = [ordered]@{
  endpoint = 'https://messages.tetheredunicorn.com'
  protectedToken = [Convert]::ToBase64String($protected)
  createdAt = [DateTimeOffset]::UtcNow.ToString('o')
}
$folder = Split-Path -Parent $BridgeConfigPath
[IO.Directory]::CreateDirectory($folder) | Out-Null
$config | ConvertTo-Json | Set-Content -LiteralPath $BridgeConfigPath -Encoding utf8
Write-Output 'Cloudflare inbox secret installed and the local copy was protected with Windows DPAPI.'
