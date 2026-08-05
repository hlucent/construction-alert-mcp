<#
.SYNOPSIS
    construction-alert-mcp 를 fly.dev에 배포한다.

.DESCRIPTION
    지금까지 세션마다 손으로 반복해온 순서를 그대로 스크립트화한 것:
    1. node --check로 문법 확인
    2. 커밋되지 않은 변경사항이 있으면 -CommitMessage로 커밋 (미지정 시 중단)
    3. 원격에 새 커밋이 있으면 git pull --rebase로 먼저 반영
    4. git push
    5. flyctl deploy
    6. 배포된 엔드포인트에 실제 MCP 요청을 보내 정상 동작 확인 (smoke test)

.PARAMETER CommitMessage
    커밋할 변경사항이 있을 때 사용할 커밋 메시지. 생략하면, 변경사항이 있는 경우
    스크립트가 중단되고 무엇이 바뀌었는지 보여준다 (의도치 않은 커밋 방지).

.PARAMETER SkipSyntaxCheck
    node --check 단계를 건너뛴다.

.PARAMETER SkipSmokeTest
    배포 후 라이브 엔드포인트 호출 검증 단계를 건너뛴다.

.EXAMPLE
    .\deploy.ps1 -CommitMessage "feat: add xyz tool"

.EXAMPLE
    # 이미 커밋까지 끝난 상태에서 push+deploy만
    .\deploy.ps1
#>

param(
    [string]$CommitMessage,
    [switch]$SkipSyntaxCheck,
    [switch]$SkipSmokeTest
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Fail {
    param([string]$Message)
    Write-Host "오류: $Message" -ForegroundColor Red
    exit 1
}

# 스크립트 자신의 위치를 프로젝트 루트로 고정 (어디서 실행하든 동일하게 동작)
Set-Location $PSScriptRoot

# 1. 문법 확인
if (-not $SkipSyntaxCheck) {
    Write-Step "node --check src/index.js"
    node --check src/index.js
    if ($LASTEXITCODE -ne 0) { Fail "src/index.js 문법 오류. 배포를 중단합니다." }
    Write-Host "문법 확인 통과" -ForegroundColor Green
}

# 2. 커밋되지 않은 변경사항 처리
Write-Step "git 상태 확인"
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Host "커밋되지 않은 변경사항:" -ForegroundColor Yellow
    git status --short

    if (-not $CommitMessage) {
        Fail "커밋되지 않은 변경사항이 있습니다. -CommitMessage '커밋 메시지'를 지정하거나, 먼저 직접 커밋한 뒤 다시 실행하세요."
    }

    Write-Step "변경사항 커밋"
    git add -A
    git commit -m $CommitMessage
    if ($LASTEXITCODE -ne 0) { Fail "git commit 실패" }
} else {
    Write-Host "커밋할 변경사항 없음" -ForegroundColor Green
}

# 3. 원격 최신화 (fast-forward 충돌 방지)
Write-Step "원격 변경사항 확인 (git fetch)"
git fetch origin
if ($LASTEXITCODE -ne 0) { Fail "git fetch 실패" }

$behindCount = (git rev-list --count HEAD..origin/main).Trim()
if ($behindCount -ne "0") {
    Write-Host "원격에 로컬에 없는 커밋 $behindCount 개 발견 -> git pull --rebase" -ForegroundColor Yellow
    git pull --rebase origin main
    if ($LASTEXITCODE -ne 0) {
        Fail "git pull --rebase 실패 (충돌 가능성). 직접 확인 후 해결하세요: git status"
    }
} else {
    Write-Host "원격과 이미 동기화됨" -ForegroundColor Green
}

# 4. push
Write-Step "git push"
git push
if ($LASTEXITCODE -ne 0) { Fail "git push 실패" }

# 5. fly.dev 배포
Write-Step "flyctl deploy"
flyctl deploy
if ($LASTEXITCODE -ne 0) { Fail "flyctl deploy 실패" }

# 6. 배포 후 실제 호출로 검증 (smoke test)
if (-not $SkipSmokeTest) {
    Write-Step "배포 검증 (라이브 엔드포인트 초기화 요청)"

    if (-not (Test-Path ".env")) {
        Write-Host ".env 파일이 없어 smoke test를 건너뜁니다 (-SkipSmokeTest로 이 경고를 없앨 수 있음)" -ForegroundColor Yellow
    } else {
        $envContent = Get-Content ".env" -Raw
        if ($envContent -match "SEOUL_OPENAPI_KEY=(.+)") {
            $apiKey = $matches[1].Trim()
            $appName = (Select-String -Path "fly.toml" -Pattern '^app\s*=\s*"(.+)"').Matches[0].Groups[1].Value
            $url = "https://$appName.fly.dev/mcp?key=$apiKey"

            $body = @{
                jsonrpc = "2.0"
                id      = 1
                method  = "initialize"
                params  = @{
                    protocolVersion = "2024-11-05"
                    capabilities    = @{}
                    clientInfo      = @{ name = "deploy-smoke-test"; version = "1.0" }
                }
            } | ConvertTo-Json -Depth 5

            try {
                $response = Invoke-WebRequest -Uri $url -Method Post -Body $body `
                    -Headers @{ "Content-Type" = "application/json"; "Accept" = "application/json, text/event-stream" } `
                    -TimeoutSec 20 -UseBasicParsing

                if ($response.Content -match '"serverInfo"') {
                    Write-Host "배포 검증 성공 - 서버가 정상 응답함" -ForegroundColor Green
                } else {
                    Write-Host "경고: 응답은 받았지만 예상한 형식이 아닙니다. 직접 확인하세요: $url" -ForegroundColor Yellow
                }
            } catch {
                Write-Host "경고: 배포 검증 요청 실패 ($($_.Exception.Message)). 배포 자체는 완료됐으니 수동으로 확인하세요." -ForegroundColor Yellow
            }
        } else {
            Write-Host ".env에 SEOUL_OPENAPI_KEY가 없어 smoke test를 건너뜁니다" -ForegroundColor Yellow
        }
    }
}

Write-Host ""
Write-Host "배포 완료" -ForegroundColor Green
