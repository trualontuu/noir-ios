# Выкладывает свежую Noir.ipa в источник SideStore на Cloudflare Pages.
# Берёт артефакт последней успешной сборки «iOS build» (или -RunId), пишет source.json и деплоит source/public.
# Токен Cloudflare читается из .env (CLOUDFLARE_API_TOKEN), в консоль не выводится.
param([string]$RunId = '', [string]$Notes = '')
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$pub = Join-Path $root 'source\public'
$Project = 'noir-ios'
# ID аккаунта Cloudflare и путь к .env с CLOUDFLARE_API_TOKEN лежат в scripts/local.ps1 (не в git):
#   $AccountId = '...'; $EnvFile = 'C:\path\to\.env'
. (Join-Path $PSScriptRoot 'local.ps1')

Set-Location $root
if (-not $RunId) {
  $RunId = (gh run list --workflow ios.yml --status success --limit 1 --json databaseId | ConvertFrom-Json)[0].databaseId
}
Write-Host "Сборка $RunId"
$tmp = Join-Path $env:TEMP "noir-ipa-$RunId"
if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force -Confirm:$false }
gh run download $RunId -n Noir-ipa -D $tmp
Copy-Item (Join-Path $tmp 'Noir.ipa') (Join-Path $pub 'Noir.ipa') -Force
Copy-Item (Join-Path $root 'assets\icon.png') (Join-Path $pub 'icon.png') -Force

$info = python -I -c @"
import zipfile,plistlib,json,sys
z=zipfile.ZipFile(sys.argv[1]); n=z.namelist()
i=plistlib.loads(z.read([x for x in n if x.endswith('.app/Info.plist')][0]))
print(json.dumps({'v':i['CFBundleShortVersionString'],'b':i.get('CFBundleVersion','1'),'min':i.get('MinimumOSVersion','16.4'),
 'privacy':{k:v for k,v in i.items() if k.startswith('NS') and k.endswith('UsageDescription')}}))
"@ (Join-Path $pub 'Noir.ipa') | ConvertFrom-Json

$base = "https://$Project.pages.dev"
$size = (Get-Item (Join-Path $pub 'Noir.ipa')).Length
$source = [ordered]@{
  name = 'Noir'
  identifier = 'com.trualontuu.noir.source'
  subtitle = 'Чёрно-белый плеер Яндекс Музыки'
  iconURL = "$base/icon.png"
  tintColor = '#F2F2F2'
  apps = @([ordered]@{
    name = 'Noir'
    bundleIdentifier = 'com.trualontuu.noir'
    developerName = 'trualontuu'
    subtitle = 'Яндекс Музыка в чёрно-белом'
    localizedDescription = 'Моя волна, лайки, плейлисты, поиск, скачивание треков, фон и локскрин. Неофициальный клиент.'
    iconURL = "$base/icon.png"
    tintColor = '#F2F2F2'
    category = 'entertainment'
    screenshots = @()
    versions = @([ordered]@{
      version = $info.v
      buildVersion = "$($info.b)"
      date = (Get-Date -Format 'yyyy-MM-dd')
      localizedDescription = $(if ($Notes) { $Notes } else { "Noir $($info.v)" })
      downloadURL = "$base/Noir.ipa?v=$($info.v)"
      size = $size
      minOSVersion = $info.min
    })
    appPermissions = [ordered]@{ entitlements = @(); privacy = $info.privacy }
  })
  news = @()
}
[IO.File]::WriteAllText((Join-Path $pub 'source.json'), ($source | ConvertTo-Json -Depth 10))
Write-Host "source.json: Noir $($info.v), $([math]::Round($size/1MB,1)) МБ"

# токен — только в переменную окружения процесса
$line = Get-Content $EnvFile | Where-Object { $_ -match '^CLOUDFLARE_API_TOKEN=' } | Select-Object -First 1
$env:CLOUDFLARE_API_TOKEN = $line.Substring('CLOUDFLARE_API_TOKEN='.Length).Trim()
$env:CLOUDFLARE_ACCOUNT_ID = $AccountId
Push-Location (Join-Path $root 'source')
try { npx --yes wrangler pages deploy public --project-name $Project --branch main --commit-dirty=true }
finally { Pop-Location; Remove-Item Env:CLOUDFLARE_API_TOKEN -ErrorAction SilentlyContinue; Remove-Item (Join-Path $root 'source\.wrangler') -Recurse -Force -ErrorAction SilentlyContinue }
Write-Host "Источник: $base/source.json"
