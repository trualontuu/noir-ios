# Выкладывает ретранслятор пульта (Noir Connect) на Cloudflare Workers.
# Нужен вход wrangler (npx wrangler login, один раз): токен из .env умеет только Pages.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
. (Join-Path $PSScriptRoot '..\scripts\local.ps1')   # $AccountId
$env:CLOUDFLARE_ACCOUNT_ID = $AccountId
Remove-Item Env:CLOUDFLARE_API_TOKEN -ErrorAction SilentlyContinue
try { npx --yes wrangler@4 deploy }
finally { Remove-Item (Join-Path $PSScriptRoot '.wrangler') -Recurse -Force -ErrorAction SilentlyContinue }
