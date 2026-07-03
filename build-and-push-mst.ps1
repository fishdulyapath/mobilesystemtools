param(
    [switch]$Mock,
    [string]$Registry = "minorsoft",
    [string]$Tag = "latest",
    [string]$EnabledScreens = "all"
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$mockValue = if ($Mock) { 'true' } else { 'false' }

$backendPath = "./MarketPlaceWebServiceExpress"
$frontendPath = "./mobilesystemtool"
$serviceImage = "$Registry/mobiletoolsservice:$Tag"
$frontendImage = "$Registry/mobiletools:$Tag"

if (-not (Test-Path $backendPath)) {
  Write-Error "Backend folder not found: $backendPath"
  exit 1
}

if (-not (Test-Path $frontendPath)) {
  Write-Error "Frontend folder not found: $frontendPath"
  exit 1
}

Write-Host "==> Building backend ($serviceImage)" -ForegroundColor Cyan
docker build -t $serviceImage $backendPath
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "==> Building frontend ($frontendImage)  [MOCK=$mockValue]" -ForegroundColor Cyan
docker build `
  --build-arg "VITE_API_BASE_URL=/mobiletoolsservice/service/v1" `
  --build-arg "VITE_BASE_PATH=/mobiletools/" `
  --build-arg "VITE_TIGER_MOCK=$mockValue" `
  --build-arg "VITE_ENABLED_SCREENS=$EnabledScreens" `
  -t $frontendImage `
  $frontendPath
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "==> Pushing images to Docker Hub" -ForegroundColor Cyan
docker push $serviceImage
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
docker push $frontendImage
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "==> Done. Backend=$serviceImage Frontend=$frontendImage MOCK=$mockValue EnabledScreens=$EnabledScreens" -ForegroundColor Green
