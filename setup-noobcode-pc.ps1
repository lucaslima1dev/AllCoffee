# Clona/atualiza NoobCode em C:\Users\Pedro\NoobCode e abre o workspace

$Target = "C:\Users\Pedro\NoobCode"
$Repo = "https://github.com/lucaslima1dev/AllCoffee.git"
$Branch = "cursor/noobcode-agent-9df8"

if (-not (Test-Path $Target)) {
  git clone $Repo $Target
}

Set-Location $Target
git fetch origin
git checkout $Branch
git pull origin $Branch

$App = Join-Path $Target "noobcode"
Set-Location $App
if (-not (Test-Path "node_modules")) {
  npm install
}

$Workspace = Join-Path $Target "NoobCode.code-workspace"
if (Get-Command cursor -ErrorAction SilentlyContinue) {
  cursor $Workspace
} elseif (Get-Command code -ErrorAction SilentlyContinue) {
  code $Workspace
} else {
  Write-Host "Abra no IDE: $Workspace"
}
