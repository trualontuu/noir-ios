# Обновление «по воздуху»: публикует текущий JS в канал production (EAS Update).
# Придёт во все установленные Noir той же версии (runtimeVersion = version из app.json).
# Если менялись нативные модули или app.json — нужна новая сборка ipa (и поднять version), а не это.
param([Parameter(Mandatory)][string]$Message)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) { throw 'typecheck не прошёл' }
npx --yes eas-cli@latest update --channel production --platform ios --message $Message --environment production --non-interactive
