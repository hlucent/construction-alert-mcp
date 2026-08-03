# 건설알림이 MCP

서울시 건설공사(공사장) 알림 정보를 조회하는 MCP 서버. 서울시 대기환경정보 MCP와 동일한 구조/배포 방식(fly.dev)을 따른다.

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

## 도구(tool) 목록
- `search_construction_projects` — 서울시 건설알림이(One-PMIS) 공사장 목록을 자치구명/키워드로 검색 (사업명, 위치, 발주처/시공사, 착공일, 준공예정일, 도급액, 위경도 등 반환)
- `get_construction_project_photos` — 사업코드(PJT_CD)로 공사현장 사진 목록 조회

## 실행 방법

### 로컬 실행
```
npm install
cp .env.example .env   # SEOUL_OPENAPI_KEY 값 채우기
npm start
```
서버는 `http://localhost:8080/mcp` (Streamable HTTP transport)에서 요청을 받는다.

### 배포된 서버 사용
`https://construction-alert-mcp-hlucent.fly.dev/mcp` 엔드포인트로 MCP 클라이언트를 연결하면 된다.

### fly.dev 배포
```
flyctl deploy
```
`SEOUL_OPENAPI_KEY`는 `flyctl secrets set SEOUL_OPENAPI_KEY=...`로 설정되어 있어야 한다.
