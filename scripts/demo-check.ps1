Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot

Write-Host "Starting MySQL..."
Push-Location $root
$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$composeOutput = docker compose -p ai-voice-drawing up -d mysql 2>&1
$composeExitCode = $LASTEXITCODE
$ErrorActionPreference = $previousErrorActionPreference
if ($composeExitCode -ne 0) {
  $running = docker inspect --format='{{.State.Running}}' ai-voice-drawing-mysql 2>$null
  if ($running -ne "true") {
    throw ($composeOutput -join "`n")
  }
  Write-Host "Using existing ai-voice-drawing-mysql container."
}
Pop-Location

Write-Host "Running migrations..."
Push-Location (Join-Path $root "backend")
go run ./cmd/migrate

Write-Host "Starting backend on 18080..."
$backendPath = Get-Location
$job = Start-Job -ScriptBlock {
  Set-Location $using:backendPath
  $env:HTTP_PORT = "18080"
  go run ./cmd/server
}

try {
  Start-Sleep -Seconds 5
  Invoke-RestMethod -Uri "http://127.0.0.1:18080/healthz" | Out-Null

  $projectJson = @{ name = "Demo check" } | ConvertTo-Json -Compress
  $project = Invoke-RestMethod -Uri "http://127.0.0.1:18080/api/v1/projects" -Method Post -ContentType "application/json; charset=utf-8" -Body ([Text.Encoding]::UTF8.GetBytes($projectJson))
  $projectId = $project.project.id

  $commandText = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("55S75LiA5Liq6JOd6Imy5ZyG5b2i"))
  $commandJson = @{ text = $commandText } | ConvertTo-Json -Compress
  $commandBody = [Text.Encoding]::UTF8.GetBytes($commandJson)
  $plan = Invoke-RestMethod -Uri "http://127.0.0.1:18080/api/v1/projects/$projectId/text-commands" -Method Post -ContentType "application/json; charset=utf-8" -Body $commandBody
  if ($plan.command_plan.commands[0].type -ne "create_shape") {
    throw "Expected create_shape command plan"
  }
}
finally {
  Stop-Job $job -ErrorAction SilentlyContinue
  Remove-Job $job -Force -ErrorAction SilentlyContinue
  Pop-Location
}

Write-Host "Building frontend..."
Push-Location (Join-Path $root "frontend")
npm install
npm run lint
npm run build
Pop-Location

Write-Host "Demo check passed."
