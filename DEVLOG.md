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
