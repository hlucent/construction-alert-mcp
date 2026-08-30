# 개발일지 — 건설알림이 MCP

> 서울시 대기환경정보 MCP와 동일한 패턴으로 진행. 커밋할 때마다 아래 형식으로 한 줄씩 이어서 기록.

## 형식
```
## YYYY-MM-DD
- 한 일:
- 막힌 점:
- 다음 할 일:
```

---

## 2026-08-03
- 한 일: 프로젝트 뼈대 생성, DEVLOG.md/README.md 템플릿 작성
- 막힌 점: 서울 열린데이터광장 "서울시 건설알림이 정보(OA-1222)" API가 서비스 종료 상태 확인됨.
  → 대체 데이터 출처 확정이 필요함 (아래 후보 중 택 1)
    1. 서울 열린데이터광장에서 "공사장/건설공사" 키워드로 대체 API 재검색
    2. 국토교통부 건축HUB 건축인허가정보서비스로 대체
    3. cis.seoul.go.kr 페이지 직접 확인 후 스크래핑 검토 (이용약관 확인 필요)
- 다음 할 일: 2단계 — 데이터소스 확정 및 인증키 발급

## 2026-08-03 (4)
- 한 일: 4단계 완료 — 실제 API 호출 테스트 성공 (Claude Code로 진행).
  - search_construction_projects, get_construction_project_photos 도구 구현 완료
  - node --check 문법 검증 통과
  - 실제 SEOUL_OPENAPI_KEY로 pmisPjtList 호출 → 서초구 공사장 3건 정상 반환 확인
- 다음 할 일: 5단계 — fly.dev 배포

## 2026-08-04 (5)
- 한 일: 5단계 완료 — fly.dev 배포 성공 (Claude Code로 진행).
  - StdioServerTransport → StreamableHTTPServerTransport로 전환, Express로 /mcp 경로 노출 (PORT: process.env.PORT || 8080)
  - Dockerfile 추가 (node:20-slim, npm ci --omit=dev), fly.toml에 dockerfile 경로/internal_port(8080) 반영
  - 앱 이름 충돌 방지를 위해 construction-alert-mcp-hlucent로 확정, flyctl apps create로 생성
  - SEOUL_OPENAPI_KEY를 fly secrets로 설정 후 flyctl deploy 성공 (머신 2대 기동, DNS 확인 완료)
  - https://construction-alert-mcp-hlucent.fly.dev/mcp 에 initialize 요청 보내 정상 응답(tools capability 포함) 확인
- 다음 할 일: 미정 (필요 시 추가 도구/데이터소스 확장 검토)

## 2026-08-04 (6)
- 한 일: 다중 사용자 API 키 방식을 seoul-air-quality-mcp와 동일한 ?key= 쿼리 파라미터 방식으로 재구현 (Claude Code로 진행).
  - x-seoul-api-key 헤더 방식 → ?key=본인키 쿼리 파라미터 방식으로 변경
  - ?key=가 없으면 서버 공용 키로 폴백하지 않고 401 + 명확한 안내 메시지 반환하도록 변경 (SEOUL_OPENAPI_KEY 폴백 완전히 제거)
  - AsyncLocalStorage 기반 요청별 키 격리는 그대로 유지
  - 로컬 테스트: 키 없이 요청 → 401 확인 / ?key=실제키로 요청 → 정상 데이터 반환 확인 / 반복 요청도 정상 동작 확인(회귀 없음)
  - README.md를 ?key= 방식 안내로 갱신
- 다음 할 일: 미정 (필요 시 추가 도구/데이터소스 확장 검토)

## 2026-08-04 (7)
- 한 일: 두 도구(search_construction_projects, get_construction_project_photos)에 출처 표기 강제 (Claude Code로 진행).
  - 각 도구 결과 JSON 맨 앞에 "출처" 필드 추가 (사업개요: OA-15585, 공사사진: OA-15586)
  - 두 도구의 description 끝에 "출처 표시를 생략하는 것은 금지된다" 문구 추가해 LLM이 출처를 반드시 답변에 명시하도록 유도
  - node --check 문법 검증 통과, 로컬 테스트로 출처 필드가 JSON 맨 앞에 오는 것 확인
- 다음 할 일: 미정 (필요 시 추가 도구/데이터소스 확장 검토)

## 2026-08-04 (8)
- 한 일: 서울시 건설 알림이 정보(OA-1222, ListConstructionWorkService) 신규 데이터셋 연동 (Claude Code로 진행).
  - `search_construction_work_by_district` 도구 추가 — 자치구명 지정 시 URL 경로에 넣어 서버 필터링 활용, biz_name만 있을 땐 기존 도구처럼 페이지를 훑으며 클라이언트 필터링
  - 결과 JSON에 `출처` 필드(OA-1222) 추가, description 끝에 출처 표시 필수 문구 추가
  - **버그 발견 및 수정**: 기존 `parseSimpleXml`이 CDATA로 감싼 필드(`<BIZ_NM><![CDATA[...]]></BIZ_NM>`)를 파싱하지 못해 프로젝트명이 항상 빈 값으로 나오는 문제 확인 → CDATA/일반 텍스트 모두 처리하도록 정규식 수정 (공용 파서라 기존 두 도구에도 영향 없이 하위호환 유지)
  - node --check 통과, 실제 SEOUL_OPENAPI_KEY로 로컬 서버 기동 후 종로구 조회 → 프로젝트명 포함 5건 정상 반환 확인
- 다음 할 일: 미정 (필요 시 추가 도구/데이터소스 확장 검토)

## 2026-08-04 (9)
- 한 일: 서울시 건설공사 추진 현황(OA-2540, ListOnePMISBizInfo) 신규 데이터셋 연동 (Claude Code로 진행).
  - `get_construction_progress` 도구 추가 — 사업명/발주처기관명은 API 경로 필터로, 자치구명은 API 자체 필터가 없어 결과를 받은 뒤 클라이언트에서 GU_NM으로 필터링
  - 계획/실적 공정률, 대비율, D-Day, 도급액/사업비, 시공사/감리사/발주처 담당자, 공사위치 등 반환
  - 결과 JSON에 `출처` 필드(OA-2540) 추가, description 끝에 출처 표시 필수 문구 추가
  - 원본 XML 확인 결과 이 데이터셋은 CDATA 없이 순수 텍스트 필드만 사용함을 확인 (OA-1222와 달리 파서 수정 불필요)
  - node --check 통과, 실제 SEOUL_OPENAPI_KEY로 로컬 서버 기동 후 발주처기관명("서울아리수본부")·자치구명("강서구") 조회 모두 공정률 데이터 포함 정상 반환 확인
- 다음 할 일: 미정 (필요 시 추가 도구/데이터소스 확장 검토)

## 2026-08-04 (10)
- 한 일: 기존 도구 2개 개선 (Claude Code로 진행).
  - `get_construction_progress`: 계획/실적 공정율·대비율이 "0"이면 "미입력"으로 표시하도록 변경 (0이 아닌 값은 숫자로 반환). `min_amount`(억원) 파라미터 추가 — API 자체엔 금액 필터가 없어 max_scan만큼 조회 후 도급액(AMT_CTRT) 기준으로 클라이언트에서 필터링
  - `search_construction_projects`: 발주처_연락처(TEL_1), 건설사업관리단_연락처(TEL_2), 시공사_연락처(TEL_3) 필드 추가
  - 두 도구 description에 새 파라미터/필드 설명 반영
  - node --check 통과, 실제 SEOUL_OPENAPI_KEY로 로컬 테스트 — min_amount=100 지정 시 100억 미만 결과 없음 확인, 공정율 0인 건 "미입력"으로 표시됨 확인, search_construction_projects 연락처 3종 정상 반환 확인
- 다음 할 일: 미정 (필요 시 추가 도구/데이터소스 확장 검토)

## 2026-08-06
- 한 일: 배포 자동화 스크립트 `deploy.ps1` 추가 (Claude Code로 진행).
  - 그동안 세션마다 손으로 반복하던 순서(node --check → 변경사항 커밋 → git fetch/pull --rebase로 원격 동기화 → git push → flyctl deploy → 라이브 엔드포인트 초기화 요청으로 검증)를 PowerShell 스크립트 하나로 통합
  - `-CommitMessage`(커밋할 변경사항 있을 때만 필수, 의도치 않은 커밋 방지), `-SkipSyntaxCheck`, `-SkipSmokeTest` 파라미터 지원
  - **버그 발견 및 수정 (1차)**: 스크립트 파일을 BOM 없는 UTF-8로 저장하면 Windows PowerShell 5.1이 한글이 섞인 스크립트를 잘못 파싱해 문법 오류를 냄 → UTF-8 BOM으로 저장해 해결
  - **버그 발견 및 수정 (2차)**: smoke test에서 `Invoke-WebRequest`가 서버의 `text/event-stream` 응답을 만나면 콘솔 프롬프트를 시도하다가 "NonInteractive mode" 오류로 실패 → `-UseBasicParsing` 플래그 추가로 해결
  - 실제로 두 차례 스크립트를 실행해 커밋 → push → flyctl deploy → smoke test까지 전 과정이 정상 동작함을 검증 완료
- 다음 할 일: 미정 (필요 시 추가 도구/데이터소스 확장 검토)

## 2026-08-16
- 한 일: `?key=...` 쿼리 파라미터 접속 인증 로직 완전 제거 (Claude Code로 진행, 사용자 명시 요청·위험 확인 후 진행).
  - `/mcp` 라우트 앞단의 401 인증 미들웨어 삭제, 요청별 키를 저장하던 `AsyncLocalStorage` 제거
  - `getApiKey()`가 이제 서울시 오픈API 호출용 서버 키(`SEOUL_OPENAPI_KEY`, fly secrets)를 직접 반환하도록 변경 — 사용자별 키가 아니라 서버 공용 키로 모든 호출 처리
  - README.md 갱신: 연결 URL이 `?key=...` 없이 `https://construction-alert-mcp-hlucent.fly.dev/mcp`로 단순화됐음을 반영, 사용자별 키 발급 안내 섹션 삭제
  - node --check 문법 검증 통과
  - **위험 인지**: 인증 제거로 URL만 알면 누구나 무제한 호출 가능해져 서울시 오픈API 쿼터 소모·fly.io 비용 노출 위험이 생김 (사용자에게 사전 확인 후 진행)
  - 배포는 보류 — 사용자 지시에 따라 코드/문서 변경만 하고 fly.dev에는 반영하지 않음
- 다음 할 일: 배포 여부는 사용자가 별도로 지시할 때 진행 (`deploy.ps1 -CommitMessage "..."`)

## 2026-08-16 (3)
- 한 일: 기존 분당 3회 rate limit에 2가지 안전장치 추가 (Claude Code로 진행).
  - 1시간 내 429 응답을 5회 이상 받은 IP는 24시간 동안 완전 차단 (in-memory `Map`, `blockedUntilByIp`)
  - IP당 일일(rolling 24시간) 총 호출 30회 제한 초과 시 429 (in-memory `Map`, `dailyRequestLogByIp`)
  - 일일 한도 초과나 반복 429 자체도 차단 카운트에 반영되도록 `recordRateLimitHit()` 헬퍼로 통합
  - 모두 메모리 저장 방식 유지 — 서버(fly.io 머신) 재시작 시 차단/카운트 기록 초기화됨 (요구사항대로 허용된 동작)
  - node --check 문법 검증 통과
  - README.md 갱신: 분당 3회 + 일일 30회 + 반복 초과 시 24시간 차단, 3단계 제한을 모두 명시
  - 배포는 보류 — 사용자 지시에 따라 코드/문서 변경만 하고 fly.dev에는 반영하지 않음
- 다음 할 일: 배포 여부는 사용자가 별도로 지시할 때 진행 (`deploy.ps1 -CommitMessage "..."`)

## 2026-08-24 — fly.io 앱 주소 변경 (보안 강화)

기존 fly.io 앱이 GitHub 저장소명과 동일하거나 유사한 이름으로 배포되어 있어, 저장소명만
보면 실제 서비스 URL을 그대로 유추할 수 있는 상태였다. 이를 막기 위해 fly.io 앱을 랜덤
접미사가 붙은 새 이름(construction-u7fce4)으로 재배포하고, 기존 앱(construction-alert-mcp-hlucent)은
fly apps destroy로 완전히 삭제했다. fly.toml의 app 값과 README의 URL도 신주소 기준으로
갱신했다.

- 추가로: URL 은닉만으로는 "타인의 접속 완전 차단"이 근본적으로 해결되지 않는다고 판단해
  `?key=` 인증도 재도입함. 2026-08-16(2)에서 사용 편의성을 위해 제거했던 것과 달리, 이번엔
  "이 서버 자체 접근용 전용 비밀키"(`MCP_ACCESS_KEY`)를 서버가 fly secrets로 보유하고
  요청의 `?key=`와 `timingSafeEqual`로 비교하는 방식. 인증 미들웨어를 rate limit보다 앞에
  둬서, 인증 실패 요청이 rate limit 카운터를 소모해 정상 사용자가 차단되는 상황을 방지.
  로컬에서 키 없음/틀린 키 401, 올바른 키 통과(405는 GET 미지원이라 정상)까지 확인.
  fly.toml은 이 시점부터 .gitignore 처리 — 앱 이름을 GitHub에 올리지 않음.

## 2026-08-16 (2)
- 한 일: IP 기준 rate limit 추가 (Claude Code로 진행). 이전 항목에서 인증(`?key=`) 체크를 제거해 무제한 호출 위험이 생겼는데, 이를 보완하기 위한 최소한의 안전장치.
  - `/mcp` 라우트 앞단에 in-memory 슬라이딩 윈도우 rate limiter 추가 — 같은 IP 기준 분당 3회 초과 시 429(Too Many Requests) 응답
  - 외부 패키지 없이 `Map`으로 IP별 요청 타임스탬프를 관리 (fly.io 머신 재시작/스케일 시 초기화됨 — 이 규모 프로젝트에는 충분하다고 판단)
  - fly.dev는 리버스 프록시 뒤에 있어 `app.set("trust proxy", true)`를 추가해야 `req.ip`가 실제 클라이언트 IP(X-Forwarded-For 기반)를 반영함
  - node --check 문법 검증 통과
  - 로컬에서 실제 동작 확인: 같은 IP로 연속 4회 initialize 요청 전송 → 1~3번째 200, 4번째 429 확인
  - README.md 갱신: "인증 없음, 단 IP당 분당 3회 제한" 명시
  - 배포는 보류 — 사용자 지시에 따라 코드/문서 변경만 하고 fly.dev에는 반영하지 않음
- 다음 할 일: 배포 여부는 사용자가 별도로 지시할 때 진행 (`deploy.ps1 -CommitMessage "..."`)

## 2026-08-25 — rate limit 완화 (개인 전용 기준)

MCP_ACCESS_KEY 인증이 두 프로젝트 모두 걸려 있으니, rate limit을 "실수로 계속
호출해도 안 막히는 수준"의 개인 전용 기준으로 완화했다.
- 분당 제한: 3회 → 30회
- 1시간 내 429 위반 임계: 5회 → 20회 초과 시 24시간 차단(차단 시간 자체는 유지)
- 일일 제한: 30회 → 1000회
로컬 테스트: 같은 키로 32회 연속 호출 → 31번째 요청에서 처음 429 확인(30회까지 정상 통과).
README.md의 rate limit 안내 문구도 새 값으로 갱신. 배포(`flyctl deploy`)는 사용자가
직접 진행 필요.

## 2026-08-29 — limit=50 상한 조사 및 max_scan 부분 스캔 구조 제거

### 조사 배경
서울 열린데이터광장 API(OA-1222, ListOnePMISBizInfo) 공식 명세의 ERROR-336("한 번에
최대 1000건")을 근거로, 이 서버가 자체적으로 `limit` 최대값을 50으로 제한하고 있는 게
API 스펙과 무관한 임의 값인지 확인 요청이 들어왔다. 또한 노원구/영등포구를
`search_construction_projects`, `search_construction_work_by_district`로 조회했을 때
0건이 나온 사례가 있어, `limit=50` 캡과 이 0건 문제가 얽혀 있는지가 조사 핵심이었다.

### 조사 결과 (코드 근거로 확정)
1. **limit=50은 API 명세와 무관한 서버 자체 임의값**이었음을 확정. 4개 도구 모두
   zod 스키마에 `.max(50)`이 하드코딩돼 있었고, API 명세서 어디에도 50이라는
   숫자의 근거가 없었다.
2. **자치구 필터는 API가 지원하지 않는 파라미터**(`get_construction_progress`,
   `search_construction_projects`)라 응답을 받은 뒤 `row.GU_NM === gu_name` /
   `row.GU_NAME === gu_name` 방식으로 클라이언트단에서 정확 일치 매칭하고 있었다.
   이 매칭 로직 자체(문자열 포맷, 공백 등)는 실측 결과 버그가 없었다 — API가
   반환하는 GU_NM/GU_NAME 필드는 "노원구"처럼 정확한 구명만 담고 있었다.
3. **limit=50과 0건 문제는 직접적인 인과관계가 없었다**: `limit`은 "매칭된 건수가
   몇 건 모이면 스캔을 멈출지"만 결정하고, 스캔 범위 자체는 `max_scan`(기존 기본값
   500, 최대 2000)이 결정하는 구조였기 때문이다. `search_construction_projects`와
   `search_construction_work_by_district`를 `gu_name="노원구"` 단독 조건(다른 필터
   없음)으로 재현 테스트했을 때는 기존 코드로도 0건이 재현되지 않고 정상적으로
   10건씩 반환됐다 — 즉 사용자가 실제로 겪은 0건 사례는 로컬 재현 스크립트로는
   재현 조건을 특정하지 못했고, 원인 불확실로 남겨둔다.
4. 다만 별도로, `get_construction_progress`에 `min_amount`(최소 도급액) 필터를
   자치구 필터와 함께 걸 경우엔 실측으로 진짜 문제를 확인했다: 노원구+100억
   이상 조건이 기존 `max_scan` 기본값(500)으로는 0건이었으나, `max_scan=2000`으로
   넓히면 1건이 나왔다. 즉 "일부만 훑고 마는" max_scan 구조가 희소한 필터
   조합에서 실제로 데이터 누락(가짜 0건)을 일으킬 수 있음을 실측으로 확인했다.

### 적용한 변경
`max_scan`이라는 "일부만 훑는" 개념 자체를 제거하고, API 응답의
`list_total_count`를 첫 페이지에서 읽어 그 값에 도달할 때까지 자동으로 여러 번
호출하며 전량을 스캔하는 `scanAllPages` 헬퍼를 추가했다. 페이지 크기는 API
공식 상한인 1000건(ERROR-336)으로 맞췄다. `search_construction_projects`,
`search_construction_work_by_district`, `get_construction_progress` 3개 도구가
모두 이 헬퍼를 쓰도록 재작성했고, `limit`은 스캔 범위와 완전히 분리해 "반환
개수 제한" 용도로만 남기고 최대값을 50 → 1000으로 완화했다(API 명세상 안전한
값). `max_scan` 파라미터 자체는 도구 스키마에서 제거했다.

### 로컬 테스트 결과 (실측)
- 필터 없음(get_construction_progress, limit=10 기본값): 10건 정상 반환, 기존
  동작과 동일 (totalCount=5710, 1페이지만 조회)
- get_construction_progress, gu_name=노원구 + min_amount=100: **8건** (기존
  max_scan=500 구조에서는 0건이었던 케이스 — 전량 스캔으로 정상 해결, 6페이지
  스캔)
- get_construction_progress, gu_name=영등포구 + min_amount=100: **6건** (기존
  4건에서 8건→6건으로 증가, 6페이지 스캔 시 더 정확한 값 확인)
- search_construction_projects, gu_name=노원구: 10건 정상 (totalCount=5318,
  1페이지만으로 충분해 기존과 동일하게 즉시 반환)
- search_construction_work_by_district, gu_name=노원구: 10건 정상
  (totalCount=22 — API가 이미 구 단위로 필터링해 반환하므로 애초에 소량)
- limit=1000 전체 조회 성능 확인: 1000건을 194ms에 반환 (1페이지로 충분, 응답
  지연 문제 없음)

### 다음 할 일
- git add/commit까지만 진행, fly.io 배포(`flyctl deploy`)는 사용자가 PowerShell에서
  직접 진행.

## 2026-08-30 — max_scan 제거 배포 완료 + SEOUL_OPENAPI_KEY 시크릿 등록

- 전날(2026-08-29) 커밋한 df388d2(max_scan 부분 스캔 제거, limit 1000 완화)를
  실제로 fly.io에 배포 완료. `fly deploy -a seoul-construction-mcp` 정상 완료.
- 배포 후 claude.ai 실제 도구 호출로 검증한 결과, 모든 도구가 필터 유무와 무관하게
  빈 배열만 반환하는 별도 문제 발견. 원인 조사 결과 배포 환경에 SEOUL_OPENAPI_KEY
  시크릿이 애초에 한 번도 등록된 적이 없었던 것으로 확인(fly ssh console로 컨테이너
  접속 후 실측: 환경변수 비어있음, 업스트림 API가 "인증키가 유효하지 않습니다" 반환).
- `fly secrets set SEOUL_OPENAPI_KEY=... -a seoul-construction-mcp`로 시크릿 신규
  등록, 자동 재배포됨.
- 재검증 결과: 노원구 필터 없음 10건, 노원구+100억 이상 8건으로 이전 로컬 테스트
  예측치와 정확히 일치 확인. 이것으로 max_scan 버그 수정 작업이 완전히 종료됨.
- 별도로, 이 세션 중 로컬 프로젝트 폴더가 원인 불명으로 완전히 비어있던 것을 발견 →
  GitHub 원격(df388d2 기준)에서 재클론으로 복구. .gitignore 처리된 fly.toml도 함께
  유실되어 `fly config save -a seoul-construction-mcp`로 재생성 완료.
