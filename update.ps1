# 쭈갑 장비 가계부 업데이트: 최신 HTML을 index.html로 복사 → 커밋 → 푸시
# 사용법: powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\jjugap-pages\update.ps1" [-Source "다른\경로\파일.html"]
param(
    [string]$Source = "C:\Users\이영민\AppData\Local\Claude-Data\claude_pzs8sxrjxfjjc\scratch-workspaces\5da467ad-398b-40a2-bfbd-ca9a33a06916\addeb0ca-ed62-46fd-9e80-3c5813fe2a3a\scratch-2026-10-17-8559f4\쭈갑_장비_가계부_파일.html"
)
$ErrorActionPreference = 'Stop'
$repo = $PSScriptRoot
$git = (Get-Command git -ErrorAction SilentlyContinue).Source
if (-not $git) { $git = "C:\Program Files\Git\cmd\git.exe" }

if (-not (Test-Path -LiteralPath $Source)) { throw "원본 파일이 없어요: $Source" }
Copy-Item -LiteralPath $Source -Destination (Join-Path $repo 'index.html') -Force

Push-Location $repo
try {
    & $git add index.html
    & $git diff --cached --quiet
    if ($LASTEXITCODE -eq 0) { Write-Host "바뀐 내용이 없어요. 올릴 게 없습니다."; return }
    $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm'
    & $git commit -q -m "가계부 업데이트 $stamp"
    & $git push -q origin main
    if ($LASTEXITCODE -ne 0) { throw "푸시 실패" }
    Write-Host "올렸어요! 1~2분 뒤 https://woori-bang.github.io/jjugap/ 에 반영돼요."
} finally { Pop-Location }
