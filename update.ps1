# 쭈갑 장비 가계부 업데이트: 최신 HTML을 index.html로 복사(+편집 기능 연결) → 커밋 → 푸시
# 사용법: powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\jjugap-pages\update.ps1" [-Source "다른\경로\파일.html"]
# 참고: 편집 기능이 켜져 있으면 사이트는 공유 저장소(구글 시트)의 내용을 보여 줘요.
#       새로 올린 원본 내용을 사이트에 반영하려면 사이트의 [✏️ 편집 > 원본 가계부로 되돌리기]를 누르세요.
param(
    [string]$Source = "C:\Users\이영민\AppData\Local\Claude-Data\claude_pzs8sxrjxfjjc\scratch-workspaces\5da467ad-398b-40a2-bfbd-ca9a33a06916\addeb0ca-ed62-46fd-9e80-3c5813fe2a3a\scratch-2026-10-17-8559f4\쭈갑_장비_가계부_파일.html"
)
$ErrorActionPreference = 'Stop'
$repo = $PSScriptRoot
$git = (Get-Command git -ErrorAction SilentlyContinue).Source
if (-not $git) { $git = "C:\Program Files\Git\cmd\git.exe" }

if (-not (Test-Path -LiteralPath $Source)) { throw "원본 파일이 없어요: $Source" }

# 편집 기능 연결: 화면 다시 그리기 함수를 열어 두고 config.js, edit.js 를 붙여요
$utf8 = New-Object System.Text.UTF8Encoding $false
$html = [IO.File]::ReadAllText($Source, [Text.Encoding]::UTF8)
$anchor = 'render(window.__ORDERS__); renderCart(window.__CART__||[]);'
if ($html.Contains($anchor)) {
    $html = $html.Replace($anchor, 'window.__jjugapRender=function(){ render(window.__ORDERS__||[]); renderCart(window.__CART__||[]); }; window.__jjugapRender();')
} else {
    Write-Warning "편집 기능 연결 지점을 못 찾았어요. 페이지 구조가 바뀐 것 같아요 (보기는 정상, 편집 후 화면 갱신이 안 될 수 있어요)."
}
if (-not $html.Contains('src="edit.js"')) {
    $i = $html.LastIndexOf('</body>')
    $tag = '<script src="config.js"></script><script src="edit.js"></script>'
    if ($i -ge 0) { $html = $html.Insert($i, $tag + "`n") } else { $html += $tag }
}
[IO.File]::WriteAllText((Join-Path $repo 'index.html'), $html, $utf8)

Push-Location $repo
try {
    & $git add -A
    & $git diff --cached --quiet
    if ($LASTEXITCODE -eq 0) { Write-Host "바뀐 내용이 없어요. 올릴 게 없습니다."; return }
    $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm'
    & $git commit -q -m "가계부 업데이트 $stamp"
    & $git push -q origin main
    if ($LASTEXITCODE -ne 0) { throw "푸시 실패" }
    Write-Host "올렸어요! 1~2분 뒤 https://woori-bang.github.io/jjugap/ 에 반영돼요."
} finally { Pop-Location }
