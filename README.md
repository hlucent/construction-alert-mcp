# 건설알림이 MCP

서울시 건설공사(공사장) 알림 정보를 조회하는 MCP 서버.

## 상태
✅ fly.dev 배포 완료 — https://construction-alert-mcp-hlucent.fly.dev/mcp

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

## 실행 방법

### 로컬 실행
```
npm install
npm start
```
서버는 `http://localhost:8080/mcp` (Streamable HTTP transport)에서 요청을 받는다.
접속 시 반드시 `?key=본인의_서울열린데이터광장_인증키`를 URL에 붙여야 한다 (아래 참고).

### 다른 사용자가 자기 API 키로 쓰는 방법
이 서버는 서버 공용 키를 공유하지 않는다. 각 사용자가 반드시 자신의 서울 열린데이터광장 인증키를 URL 쿼리 파라미터로 넣어야 동작하며, 요청별 키는 Node.js `AsyncLocalStorage`로 격리되어 여러 사용자가 동시에 접속해도 서로 섞이지 않는다.

1. [data.seoul.go.kr](https://data.seoul.go.kr)에서 회원가입 후 "인증키 관리" 메뉴에서 본인 인증키를 발급받는다.
2. MCP 클라이언트 설정에서 이 서버에 연결할 때 URL에 `?key=본인키`를 붙인다.
   ```
   https://construction-alert-mcp-hlucent.fly.dev/mcp?key=본인이_발급받은_인증키
   ```
3. `?key=`가 없으면 서버는 요청을 처리하지 않고 401과 함께 아래 안내를 반환한다.
   ```
   API 키가 필요합니다. ?key=본인의_서울열린데이터광장_인증키를 URL에 추가해주세요.
   ```

### fly.dev 배포

`deploy.ps1` 스크립트가 아래 순서를 한 번에 처리한다: `node --check`로 문법 확인 → (변경사항이 있으면) 커밋 → 원격에 새 커밋이 있으면 `git pull --rebase`로 동기화 → `git push` → `flyctl deploy` → 배포된 엔드포인트에 실제 `initialize` 요청을 보내 정상 동작 확인.

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
