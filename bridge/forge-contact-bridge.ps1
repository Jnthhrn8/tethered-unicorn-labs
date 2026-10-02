param(
  [string]$BridgeConfigPath = "$env:LOCALAPPDATA\HermesCommandCenter\contact-bridge\contact-bridge.json",
  [string]$NtfyConfigPath = "$env:LOCALAPPDATA\HermesCommandCenter\ntfy\unicornforge.json",
  [string]$StatusPath = "$env:LOCALAPPDATA\HermesCommandCenter\contact-bridge\bridge-status.json"
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security

function Write-BridgeStatus {
  param([string]$State, [string]$Detail, [int]$Fetched = 0, [int]$Delivered = 0)
  $status = [ordered]@{
    checkedAt = [DateTimeOffset]::UtcNow.ToString('o')
    state = $State
    detail = $Detail
    fetched = $Fetched
    delivered = $Delivered
  }
  $folder = Split-Path -Parent $StatusPath
  [IO.Directory]::CreateDirectory($folder) | Out-Null
  $status | ConvertTo-Json | Set-Content -LiteralPath $StatusPath -Encoding utf8
}

if (!(Test-Path -LiteralPath $BridgeConfigPath) -or !(Test-Path -LiteralPath $NtfyConfigPath)) {
  Write-BridgeStatus -State 'not-configured' -Detail 'Bridge or ntfy configuration is missing.'
  exit 0
}
$bridge = Get-Content -LiteralPath $BridgeConfigPath -Raw | ConvertFrom-Json
$ntfy = Get-Content -LiteralPath $NtfyConfigPath -Raw | ConvertFrom-Json
$protected = [Convert]::FromBase64String([string]$bridge.protectedToken)
$tokenBytes = [System.Security.Cryptography.ProtectedData]::Unprotect(
  $protected,
  $null,
  [System.Security.Cryptography.DataProtectionScope]::CurrentUser
)
$token = [Text.Encoding]::UTF8.GetString($tokenBytes)
$forgeHeaders = @{ Authorization = "Bearer $token" }

try {
  $inbox = Invoke-RestMethod -Uri "$($bridge.endpoint)/forge/inbox" -Headers $forgeHeaders -Method Get -TimeoutSec 20
} catch {
  Write-BridgeStatus -State 'worker-unavailable' -Detail $_.Exception.Message
  exit 0
}

$acknowledged = [Collections.Generic.List[string]]::new()
$deliveryError = $null
$fieldDelivered = 0
foreach ($item in @($inbox.accessRequests)) {
  $fieldPayload = @{
    name = [string]$item.name
    email = [string]$item.email
    phone = [string]$item.phone
    username = [string]$item.username
    reason = [string]$item.reason
    deliveryMethod = 'private'
    ageConfirmed = [bool]$item.ageConfirmed
    onboarding = $item.onboarding
    feedback = $item.feedback
  } | ConvertTo-Json -Depth 8
  try {
    Invoke-RestMethod -Uri 'http://127.0.0.1:3211/api/field/access-request' -Method Post -ContentType 'application/json' -Body $fieldPayload -TimeoutSec 20 | Out-Null
    $acknowledged.Add([string]$item.key)
    $fieldDelivered++
  } catch {
    $deliveryError = "Forge field API unavailable: $($_.Exception.Message)"
    break
  }
}
foreach ($item in @($inbox.messages)) {
  $body = @(
    "Reference: $($item.reference)",
    "Topic: $($item.topic)",
    "Name: $($item.name)",
    "Email: $($item.email)",
    "Phone: $(if ($item.phone) { $item.phone } else { 'Not provided' })",
    '',
    [string]$item.message
  ) -join "`n"
  $payload = @{
    topic = [string]$ntfy.topic
    title = 'Tethered Unicorn Labs website inquiry'
    message = $body
    priority = 4
    tags = @('incoming_envelope', 'unicorn')
  } | ConvertTo-Json -Depth 4
  try {
    Invoke-RestMethod -Uri "$($ntfy.localUrl)/" -Method Post -Headers @{ Authorization = "Bearer $($ntfy.token)" } -ContentType 'application/json' -Body $payload -TimeoutSec 15 | Out-Null
    $acknowledged.Add([string]$item.key)
  } catch {
    $deliveryError = $_.Exception.Message
    break
  }
}

if ($acknowledged.Count) {
  $ackBody = @{ keys = @($acknowledged) } | ConvertTo-Json
  try { Invoke-RestMethod -Uri "$($bridge.endpoint)/forge/ack" -Headers $forgeHeaders -Method Post -ContentType 'application/json' -Body $ackBody -TimeoutSec 20 | Out-Null } catch {}
}

$fetchedCount = @($inbox.messages).Count + @($inbox.accessRequests).Count
if ($deliveryError) {
  Write-BridgeStatus -State 'delivery-unavailable' -Detail $deliveryError -Fetched $fetchedCount -Delivered $acknowledged.Count
} else {
  Write-BridgeStatus -State 'healthy' -Detail "Website inbox checked; $fieldDelivered field request(s) and $($acknowledged.Count - $fieldDelivered) message(s) relayed." -Fetched $fetchedCount -Delivered $acknowledged.Count
}
