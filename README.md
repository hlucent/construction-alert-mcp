# 건설알림이 MCP

서울시 건설공사(공사장) 알림 정보를 조회하는 MCP 서버. 서울시 대기환경정보 MCP와 동일한 구조/배포 방식(fly.dev)을 따른다.

## 상태
🚧 개발 초기 단계 — 데이터 출처 확정 전 (DEVLOG.md 참고)

## 진행 순서
1. [x] 저장소 & 개발일지 세팅
2. [ ] 데이터소스 확정 & 인증키 발급
3. [ ] 로컬 스캐폴딩
4. [ ] 도구(tool) 설계
5. [ ] 테스트 & 배포 (fly.dev)
6. [ ] PlayMCP 등록 & Claude 연동 테스트
7. [ ] 개발일지 마무리

## 예정 도구(tool) 목록 (임시)
- `get_construction_sites_by_gu` — 자치구별 공사장 목록
- `get_construction_site_detail` — 공사명/주소로 상세 조회
- `get_construction_notice` — 민원/알림 정보
- `get_construction_period` — 공사기간 조회

> 위 목록은 2단계에서 실제 API 응답 필드를 확인한 뒤 확정 예정.

## 실행 방법
(2~3단계 진행 후 작성 예정)
