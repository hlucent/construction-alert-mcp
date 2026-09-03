# 건설알림이 MCP

서울시 건설공사(공사장) 알림 정보를 조회하는 MCP 서버.

## 상태
✅ 로컬↔웹 겸용 구조로 전환 완료 — 환경변수(`MCP_ACCESS_KEY`, `DEPLOY_MODE`)로 로컬/웹 모드가 자동 전환된다. 코드는 한 벌.
- 로컬 실행: 인증/rate limit 없이 바로 사용 (아래 "설치 방법 → 1. 로컬 설치" 참고)
- 웹 배포(fly.dev, 현재 미사용): `?key=` 인증 필수 (아래 "설치 방법 → 2. 웹 배포" 참고)

## 진행 순서
1. [x] 저장소 & 개발일지 세팅
2. [x] 데이터소스 확정 & 인증키 발급
3. [x] 로컬 스캐폴딩
4. [x] 도구(tool) 설계 및 실제 API 호출 테스트
5. [x] 테스트 & 배포 (fly.dev)
6. [ ] PlayMCP 등록 & Claude 연동 테스트
7. [ ] 개발일지 마무리

## 사용하는 데이터
- 서울시 건설알림이 사업개요 (data.seoul.go.kr, OA-15585)
- 서울시 건설알림이 공사사진 (data.seoul.go.kr, OA-15586)
- 서울시 건설 알림이 정보 (ListConstructionWorkService) (data.seoul.go.kr, OA-1222)
- 서울시 건설공사 추진 현황 (ListOnePMISBizInfo) (data.seoul.go.kr, OA-2540)

## 도구(tool) 목록
- `search_construction_projects` — 서울시 건설알림이(One-PMIS) 공사장 목록을 자치구명/키워드로 검색 (사업명, 위치, 발주처/시공사, 착공일, 준공예정일, 도급액, 위경도, 발주처/건설사업관리단/시공사 연락처 등 반환)
- `get_construction_project_photos` — 사업코드(PJT_CD)로 공사현장 사진 목록 조회
- `search_construction_work_by_district` — 서울시 건설 알림이 정보(ListConstructionWorkService)를 자치구명/프로젝트명 키워드로 검색 (자치구명이 있으면 서버가 직접 해당 구만 필터링해 반환. 프로젝트코드, 프로젝트명, 착수일, 사업기간, 진행상태, 사무실/현장주소, 위경도, 사업금액 등 반환)
- `get_construction_progress` — 서울시 건설공사 추진 현황(ListOnePMISBizInfo)을 사업명/발주처기관명 키워드로 검색 (계획/실적 공정률, 대비율, D-Day, 도급액/사업비, 시공사/감리사/발주처 담당자, 공사위치 등 반환. 자치구명·최소 도급액(min_amount)은 클라이언트에서 필터링. 공정률/대비율이 0이면 "미입력"으로 표시)

> **출처 표기 필수**: 모든 도구가 결과 JSON에 `출처` 필드(서울 열린데이터광장 데이터셋명)를 포함하며, 이 MCP를 사용해 답변할 때는 반드시 그 출처를 답변에 명시해야 한다. 출처 생략은 금지된다.

## 설치 방법

이 서버는 코드 한 벌로 로컬 실행과 웹 배포를 모두 지원한다. 환경변수(`MCP_ACCESS_KEY`,
`DEPLOY_MODE`)만으로 두 모드가 전환되며, 코드를 수정할 필요가 없다.

### 1. 로컬 설치 (직원/개발 배경자용)

```
git clone <이 저장소 URL>
cd seoul-construction-mcp
npm install
```

`.env.example`을 복사해 `.env`를 만들고 값을 채운다.
```
cp .env.example .env
```

`.env` 내용:
```
SEOUL_OPENAPI_KEY=<YOUR_SEOUL_OPENAPI_KEY>
MCP_ACCESS_KEY=
DEPLOY_MODE=local
PORT=8001
```
- `SEOUL_OPENAPI_KEY`: 서울 열린데이터광장에서 발급받은 본인 인증키를 넣는다.
- `MCP_ACCESS_KEY`를 비워두면 로컬 실행 시 인증이 자동으로 생략된다(본인만 쓰는
  환경이므로 무인증 허용). 값을 채우면 즉시 `?key=` 인증이 활성화된다.
- `DEPLOY_MODE=local`(또는 미설정)이면 rate limit이 완전히 스킵된다. `web`으로
  설정하면 기존 rate limit(분당 30회 등)이 그대로 적용된다.
- `PORT`는 운영 중인 웹 서버(8080)와 충돌을 피하기 위해 로컬 테스트 시 8001 등으로
  바꿔 쓴다.

서버 실행:
```
npm start
```
`http://localhost:8001/mcp` (Streamable HTTP transport)에서 요청을 받는다.

**Claude Desktop 등록법**: `docs/claude-desktop-local-example.json`에 있는 JSON
조각을 참고해 Claude Desktop의 MCP 커넥터 설정에 추가한다. 이 예시 파일에는 실제
키 값 대신 플레이스홀더(`<YOUR_SEOUL_OPENAPI_KEY>`)만 들어 있으므로, 본인 값으로
직접 채워 넣어야 한다.

### 2. 웹 배포 (참고용, 현재 미사용)

fly.io로 배포하려면 `MCP_ACCESS_KEY`(서버 전용 접근 비밀키)를 fly secrets로
설정하고 `DEPLOY_MODE=web`으로 지정하면 된다 — **코드 수정 없이 환경변수만
바꾸면 재배포 가능**하다.

이 서버는 `?key=` 쿼리 파라미터로 접근을 제한한다. 올바른 키 없이는 401로 거부된다.
```
https://<앱이름>.fly.dev/mcp?key=본인의_MCP_ACCESS_KEY
```
`MCP_ACCESS_KEY`는 이 서버 자체에 접근하기 위한 전용 비밀키로, 서버가 fly secrets로 보유한 값과 요청의 `?key=` 값이 일치해야 통과한다. 서울 열린데이터광장 호출용 키(`SEOUL_OPENAPI_KEY`)와는 별개다 — 그 키는 서버가 업스트림 API를 호출할 때만 쓰이며 사용자가 URL에 붙일 필요가 없다.

`DEPLOY_MODE=web`일 때만 같은 IP 기준으로 아래 3단계 제한이 추가로 적용된다. 초과 시 429(Too Many Requests) 응답을 반환한다. (2026-08-25부터 개인 전용 사용 기준으로 완화 — `?key=` 인증이 이미 걸려 있어, rate limit은 실수로 반복 호출해도 안 막히는 수준으로 낮췄다.)
- 분당 30회 초과 호출 제한
- IP당 일일 총 호출 1000회 제한
- 1시간 내 429 응답을 20회 이상 받은 IP는 24시간 동안 차단

모든 기록은 메모리(서버 프로세스 내) 저장이며, 서버가 재시작되면 초기화된다.

`deploy.ps1` 스크립트가 배포 과정을 한 번에 처리한다: `node --check`로 문법 확인 → (변경사항이 있으면) 커밋 → 원격에 새 커밋이 있으면 `git pull --rebase`로 동기화 → `git push` → `flyctl deploy` → 배포된 엔드포인트에 실제 `initialize` 요청을 보내 정상 동작 확인.

```
# 커밋할 변경사항이 있는 경우
.\deploy.ps1 -CommitMessage "feat: add xyz tool"

# 이미 커밋까지 끝난 상태라면 메시지 없이 실행
.\deploy.ps1
```

옵션:
- `-SkipSyntaxCheck` — `node --check` 단계 생략
- `-SkipSmokeTest` — 배포 후 라이브 엔드포인트 검증 단계 생략

커밋되지 않은 변경사항이 있는데 `-CommitMessage`를 지정하지 않으면, 의도치 않은 커밋을 막기 위해 스크립트가 변경 내역을 보여주고 중단한다.

수동으로 배포만 하려면:
```
flyctl deploy
```

### 3. Claude Code로 설치 돕기

비개발자이거나 위 단계가 번거롭다면, 이 저장소를 clone한 뒤 Claude Code를 열고
아래처럼 요청하면 설치를 대신 진행해준다:

```
CLAUDE.md 읽고 로컬 설치 도와줘
```

Claude Code가 `.env` 작성, `npm install`, 로컬 서버 기동, Claude Desktop 등록까지
안내한다. 이때도 API 키 값을 대화창에 직접 붙여넣지 말고, Claude Code가 안내하는
방식(예: 터미널에서 직접 `.env` 파일 작성)을 따르는 것을 권장한다.
