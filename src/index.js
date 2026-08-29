import { timingSafeEqual } from "node:crypto";
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const BASE_URL = "http://openapi.seoul.go.kr:8088";

const CITATION_REQUIRED_NOTICE =
  "이 도구의 결과를 사용해 답변할 때는 반드시 출처(서울 열린데이터광장, 데이터셋명)를 답변에 명시해야 한다. 출처 표시를 생략하는 것은 금지된다.";

const PROJECT_LIST_SOURCE = "서울 열린데이터광장 - 서울시 건설알림이 사업개요 (data.seoul.go.kr, OA-15585)";
const PROJECT_PHOTO_SOURCE = "서울 열린데이터광장 - 서울시 건설알림이 공사사진 (data.seoul.go.kr, OA-15586)";
const CONSTRUCTION_WORK_SOURCE = "서울 열린데이터광장 - 서울시 건설 알림이 정보 (data.seoul.go.kr, OA-1222)";
const CONSTRUCTION_PROGRESS_SOURCE = "서울 열린데이터광장 - 서울시 건설공사 추진 현황 (data.seoul.go.kr, OA-2540)";

function getApiKey() {
  return process.env.SEOUL_OPENAPI_KEY;
}

function parseSimpleXml(xml, rowTag) {
  const rows = [];
  const rowRegex = new RegExp(`<${rowTag}>([\\s\\S]*?)<\\/${rowTag}>`, "g");
  let match;
  while ((match = rowRegex.exec(xml)) !== null) {
    const rowXml = match[1];
    const obj = {};
    const fieldRegex = /<([A-Z0-9_]+)>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([^<]*))<\/\1>/g;
    let fieldMatch;
    while ((fieldMatch = fieldRegex.exec(rowXml)) !== null) {
      obj[fieldMatch[1]] = fieldMatch[2] !== undefined ? fieldMatch[2] : fieldMatch[3];
    }
    rows.push(obj);
  }
  return rows;
}

function parseTotalCount(xml) {
  const match = xml.match(/<list_total_count>(\d+)<\/list_total_count>/);
  return match ? Number(match[1]) : null;
}

// API 한 번 호출당 최대 1000건(ERROR-336) 규칙에 따라 START_INDEX~END_INDEX 구간을
// 1000건씩 나눠 자동으로 여러 번 호출하며, API가 첫 응답에서 보고하는
// list_total_count에 도달할 때까지 전량을 스캔한다("일부만 훑는" max_scan 개념 제거).
// fetchPage(start, end)는 { rows, totalCount } 형태를 반환해야 한다.
// onRows(rows)는 매칭되는 행을 자신의 결과 배열에 채워 넣고, limit에 도달하면
// true를 반환해 스캔을 조기 종료시킨다.
async function scanAllPages(fetchPage, onRows) {
  const pageSize = 1000;
  let start = 1;
  let totalCount = null;

  while (totalCount === null || start <= totalCount) {
    const end = start + pageSize - 1;
    const { rows, totalCount: reportedTotal } = await fetchPage(start, end);
    if (totalCount === null) totalCount = reportedTotal ?? rows.length;
    if (rows.length === 0) break;

    if (onRows(rows)) break;

    start += pageSize;
  }
}

async function fetchProjectList(startIndex, endIndex) {
  const url = `${BASE_URL}/${getApiKey()}/xml/pmisPjtList/${startIndex}/${endIndex}`;
  const res = await fetch(url);
  const text = await res.text();
  return { rows: parseSimpleXml(text, "row"), totalCount: parseTotalCount(text) };
}

async function fetchProjectPhotos(pjtCd, startIndex, endIndex) {
  const url = `${BASE_URL}/${getApiKey()}/xml/pmisPjtPhoto/${startIndex}/${endIndex}/${pjtCd}`;
  const res = await fetch(url);
  const text = await res.text();
  return parseSimpleXml(text, "row");
}

const PRJC_END_YN_LABELS = { "0": "진행", "1": "종료", "2": "예정", "3": "중지" };

async function fetchConstructionWorkList(startIndex, endIndex, guName) {
  let url = `${BASE_URL}/${getApiKey()}/xml/ListConstructionWorkService/${startIndex}/${endIndex}/`;
  if (guName) {
    url += `${encodeURIComponent(guName)}/`;
  }
  const res = await fetch(url);
  const text = await res.text();
  return { rows: parseSimpleXml(text, "row"), totalCount: parseTotalCount(text) };
}

function formatRate(value) {
  if (value === "0") return "미입력";
  const num = Number(value);
  return Number.isNaN(num) ? value : num;
}

async function fetchConstructionProgress(startIndex, endIndex, bizName, instName) {
  const segments = [startIndex, endIndex];
  if (bizName || instName) {
    segments.push(bizName ? encodeURIComponent(bizName) : "");
  }
  if (instName) {
    segments.push(encodeURIComponent(instName));
  }
  const url = `${BASE_URL}/${getApiKey()}/xml/ListOnePMISBizInfo/${segments.join("/")}/`;
  const res = await fetch(url);
  const text = await res.text();
  return { rows: parseSimpleXml(text, "row"), totalCount: parseTotalCount(text) };
}

function createServer() {
  const server = new McpServer({
    name: "construction-alert-mcp",
    version: "0.1.0",
  });

  server.tool(
    "search_construction_projects",
    "서울시 건설알림이(One-PMIS) 공사장 목록을 자치구명 또는 키워드로 검색한다. 사업명, 위치, 발주처/시공사, 착공일, 준공예정일, 도급액, 위경도, 발주처/건설사업관리단/시공사 연락처 등을 반환한다. " +
      CITATION_REQUIRED_NOTICE,
    {
      gu_name: z.string().optional().describe("자치구명 (예: 서초구, 강남구). 생략하면 전체에서 검색."),
      keyword: z.string().optional().describe("사업명에 포함될 키워드 (예: 도로, 터널, 지하차도)"),
      limit: z.number().int().min(1).max(1000).default(10).describe("반환할 최대 결과 수 (기본 10). 검색은 항상 전체 데이터를 대상으로 하며, limit은 반환 개수만 제한한다."),
    },
    async ({ gu_name, keyword, limit }) => {
      const results = [];
      await scanAllPages(
        (start, end) => fetchProjectList(start, end),
        (rows) => {
          for (const row of rows) {
            const matchesGu = !gu_name || row.GU_NAME === gu_name;
            const matchesKeyword = !keyword || (row.PJT_NAME || "").includes(keyword);
            if (matchesGu && matchesKeyword) {
              results.push({
                사업코드: row.PJT_CD,
                사업명: row.PJT_NAME,
                자치구: row.GU_NAME,
                공사위치: row.OFFICE_ADDR,
                착공일: row.PJT_BGN1_DATE,
                준공예정일: row.PJT_COMPL_PREARR_DATE,
                도급액_억원: row.TOT_CNTRT_AMT,
                진행상태: row.PJT_FIN_YN_NM,
                발주처: row.ORG_1,
                시공사: row.ORG_3,
                위도: row.LAT,
                경도: row.LNG,
                발주처_연락처: row.TEL_1,
                건설사업관리단_연락처: row.TEL_2,
                시공사_연락처: row.TEL_3,
              });
              if (results.length >= limit) return true;
            }
          }
          return false;
        }
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ 출처: PROJECT_LIST_SOURCE, 결과: results }, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "get_construction_project_photos",
    "사업코드(PJT_CD)로 서울시 건설알림이 공사현장 사진 목록을 조회한다. " + CITATION_REQUIRED_NOTICE,
    {
      pjt_cd: z.string().describe("사업코드 (search_construction_projects 결과의 사업코드 값)"),
      limit: z.number().int().min(1).max(1000).default(10).describe("반환할 최대 사진 수 (기본 10)"),
    },
    async ({ pjt_cd, limit }) => {
      const rows = await fetchProjectPhotos(pjt_cd, 1, limit);
      const photos = rows.map((row) => ({
        사업명: row.PJT_NAME,
        사진명: row.CONST_NAME,
        촬영일자: row.PHTGRP_DATE,
        사진URL: row.PIC_URL,
      }));
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ 출처: PROJECT_PHOTO_SOURCE, 결과: photos }, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "search_construction_work_by_district",
    "서울시 건설 알림이 정보(ListConstructionWorkService)를 자치구명 또는 프로젝트명 키워드로 검색한다. 자치구명이 주어지면 API 서버가 직접 해당 구만 필터링해 반환한다. 프로젝트코드, 프로젝트명, 자치구, 착수일, 사업기간, 진행상태, 사무실/현장주소, 위경도, 사업금액 등을 반환한다. " +
      CITATION_REQUIRED_NOTICE,
    {
      gu_name: z.string().optional().describe("자치구명 (예: 종로구, 강남구). 지정하면 서버에서 해당 구만 필터링해 반환."),
      biz_name: z.string().optional().describe("프로젝트명(BIZ_NM)에 포함될 키워드"),
      limit: z.number().int().min(1).max(1000).default(10).describe("반환할 최대 결과 수 (기본 10). 검색은 항상 전체 데이터를 대상으로 하며, limit은 반환 개수만 제한한다."),
    },
    async ({ gu_name, biz_name, limit }) => {
      const results = [];

      await scanAllPages(
        (start, end) => fetchConstructionWorkList(start, end, gu_name),
        (rows) => {
          for (const row of rows) {
            const matchesBizName = !biz_name || (row.BIZ_NM || "").includes(biz_name);
            if (matchesBizName) {
              results.push({
                프로젝트코드: row.BIZ_CD,
                프로젝트명: row.BIZ_NM,
                자치구: row.SGG_NM,
                착수일: row.BIZ_BGNG_YMD,
                사업기간: row.BIZ_PRD,
                진행상태: PRJC_END_YN_LABELS[row.PRJC_END_YN] || row.PRJC_END_YN,
                사무실주소: row.OFC_ADDR,
                현장주소: row.SITE_ADDR,
                위도: row.LAT,
                경도: row.LNG,
                사업금액_억원: row.TOT_PJT_AMT,
              });
              if (results.length >= limit) return true;
            }
          }
          return false;
        }
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ 출처: CONSTRUCTION_WORK_SOURCE, 결과: results }, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "get_construction_progress",
    "서울시 건설공사 추진 현황(ListOnePMISBizInfo)을 사업명/발주처기관명 키워드로 검색한다. 계획/실적 공정률, 대비율, D-Day, 도급액/사업비, 시공사/감리사/발주처 담당자, 공사위치 등 공사 진행 현황을 반환한다. 자치구명과 최소 도급액은 결과를 받은 뒤 클라이언트에서 필터링한다. 공정률/대비율 값이 0이면 미입력으로 표시한다. " +
      CITATION_REQUIRED_NOTICE,
    {
      biz_name: z.string().optional().describe("사업명(BIZ_NM)에 포함될 키워드"),
      inst_name: z.string().optional().describe("발주처기관명(INST_NM) 키워드"),
      gu_name: z.string().optional().describe("자치구명 (예: 종로구). API 자체 필터는 없어 결과를 받은 뒤 클라이언트에서 필터링한다."),
      min_amount: z.number().optional().describe("최소 도급액(억원). 지정하면 도급액(AMT_CTRT)이 이 값 이상인 건만 반환. API 자체 필터는 없어 전체 데이터를 조회한 뒤 클라이언트에서 필터링한다."),
      limit: z.number().int().min(1).max(1000).default(10).describe("반환할 최대 결과 수 (기본 10). 검색은 항상 전체 데이터를 대상으로 하며, limit은 반환 개수만 제한한다."),
    },
    async ({ biz_name, inst_name, gu_name, min_amount, limit }) => {
      const results = [];

      await scanAllPages(
        (start, end) => fetchConstructionProgress(start, end, biz_name, inst_name),
        (rows) => {
          for (const row of rows) {
            const matchesGu = !gu_name || row.GU_NM === gu_name;
            const matchesAmount = min_amount === undefined || parseFloat(row.AMT_CTRT) >= min_amount;
            if (matchesGu && matchesAmount) {
              results.push({
                사업코드: row.BIZ_CD,
                사업명: row.BIZ_NM,
                자치구: row.GU_NM,
                준공여부: row.CMCN_YN2 ? row.CMCN_YN2.trim() : row.CMCN_YN2,
                계획공정율: formatRate(row.PROCS_PLAN),
                실적공정율: formatRate(row.PROCS_PRFMNC),
                대비율: formatRate(row.PER_RT),
                기준일자: row.CRTR_YMD,
                총공기: row.DAY_TOT,
                경과일: row.DAY_ELPS,
                D_Day: row.DAY_JOB,
                도급액_억원: row.AMT_CTRT,
                사업비_억원: row.AMT_BIZ,
                공사기간: row.CSTRN_PRD,
                공사위치: row.CSTRN_PSTN,
                위도: row.LAT,
                경도: row.LOT,
                발주처: row.INST_NM,
                발주처담당자: row.PIC_PE_NM,
                책임감리원: row.SPVS_PE_NM,
                현장대리인: row.AGT_PE_NM,
                감리사업체: row.SPVS_NM,
                시공사업체: row.CNST_ENT,
                사업규모: row.BIZ_SCL,
              });
              if (results.length >= limit) return true;
            }
          }
          return false;
        }
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ 출처: CONSTRUCTION_PROGRESS_SOURCE, 결과: results }, null, 2),
          },
        ],
      };
    }
  );

  return server;
}

const app = express();
app.set("trust proxy", true);
app.use(express.json());

// 서버 전용 접근 비밀키(MCP_ACCESS_KEY) 검사.
// SEOUL_OPENAPI_KEY(서울시 업스트림 API 호출용)와는 별개의 키다 — 이 키는
// "이 MCP 서버 자체에 접근할 수 있는 사람인가"만 판별한다.
// rate limiter보다 먼저 실행해 인증 실패 요청이 rate limit 카운터를 소모하지
// 않도록 한다(무단 접속 시도로 정상 사용자가 차단당하는 것을 방지).
function timingSafeStringEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

app.use("/mcp", (req, res, next) => {
  const expectedKey = process.env.MCP_ACCESS_KEY;
  if (!expectedKey) {
    res
      .status(500)
      .type("text/plain; charset=utf-8")
      .send("서버 설정 오류: MCP_ACCESS_KEY가 설정되지 않았습니다.");
    return;
  }

  const providedKey = (req.query.key || "").toString();
  if (!providedKey || !timingSafeStringEqual(providedKey, expectedKey)) {
    res.status(401).type("text/plain; charset=utf-8").send("인증 실패: 올바른 ?key=가 필요합니다.");
    return;
  }

  next();
});

// 같은 IP 기준 분당 30회 초과 호출을 429로 차단하는 간단한 슬라이딩 윈도우 rate limiter.
// 인증(?key=)을 통과한 요청에 한해 무제한 호출을 막기 위한 최소한의 안전장치.
// 2026-08-25부터 개인 전용 사용 기준으로 완화(?key= 인증이 이미 걸려 있어 rate limit은
// 실수로 반복 호출해도 안 막히는 수준이면 충분): (1) 1시간 내 429를 20회 이상 받은 IP는
// 24시간 차단, (2) IP당 일일 총 호출 1000회 제한.
// 모두 메모리 저장이라 서버 재시작 시 초기화됨(의도된 동작).
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const requestLogByIp = new Map();

const BLOCK_THRESHOLD_WINDOW_MS = 60 * 60 * 1000; // 1시간
const BLOCK_THRESHOLD_COUNT = 20; // 1시간 내 429 20회 이상
const BLOCK_DURATION_MS = 24 * 60 * 60 * 1000; // 24시간 차단
const rateLimitHitLogByIp = new Map(); // IP -> 429 발생 timestamp 배열
const blockedUntilByIp = new Map(); // IP -> 차단 해제 시각(ms)

const DAILY_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24시간(달력일 아님, rolling window)
const DAILY_LIMIT_MAX_REQUESTS = 1000;
const dailyRequestLogByIp = new Map(); // IP -> 요청 timestamp 배열(24시간 이내)

function recordRateLimitHit(ip, now) {
  const hits = (rateLimitHitLogByIp.get(ip) || []).filter(
    (ts) => now - ts < BLOCK_THRESHOLD_WINDOW_MS
  );
  hits.push(now);
  rateLimitHitLogByIp.set(ip, hits);

  if (hits.length >= BLOCK_THRESHOLD_COUNT) {
    blockedUntilByIp.set(ip, now + BLOCK_DURATION_MS);
    rateLimitHitLogByIp.delete(ip);
  }
}

app.use("/mcp", (req, res, next) => {
  const ip = req.ip;
  const now = Date.now();

  const blockedUntil = blockedUntilByIp.get(ip);
  if (blockedUntil) {
    if (now < blockedUntil) {
      res
        .status(429)
        .type("text/plain; charset=utf-8")
        .send("반복적인 과다 요청으로 24시간 동안 차단되었습니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    blockedUntilByIp.delete(ip);
  }

  const dailyTimestamps = (dailyRequestLogByIp.get(ip) || []).filter(
    (ts) => now - ts < DAILY_LIMIT_WINDOW_MS
  );
  if (dailyTimestamps.length >= DAILY_LIMIT_MAX_REQUESTS) {
    res
      .status(429)
      .type("text/plain; charset=utf-8")
      .send("일일 호출 한도(1000회)를 초과했습니다. 24시간 후 다시 시도해주세요.");
    recordRateLimitHit(ip, now);
    return;
  }

  const timestamps = (requestLogByIp.get(ip) || []).filter(
    (ts) => now - ts < RATE_LIMIT_WINDOW_MS
  );

  if (timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    res
      .status(429)
      .type("text/plain; charset=utf-8")
      .send("요청이 너무 많습니다. 1분에 최대 30회까지 호출할 수 있습니다. 잠시 후 다시 시도해주세요.");
    recordRateLimitHit(ip, now);
    return;
  }

  timestamps.push(now);
  requestLogByIp.set(ip, timestamps);
  dailyTimestamps.push(now);
  dailyRequestLogByIp.set(ip, dailyTimestamps);
  next();
});

// stateless 모드에서는 요청마다 새 McpServer/transport를 만들어야 한다.
// 하나를 재사용하면 최초 요청 이후 모든 요청이 실패한다 (SDK 공식 stateless 예제 참고).
app.post("/mcp", async (req, res) => {
  try {
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    res.on("close", () => {
      transport.close();
      server.close();
    });
  } catch (error) {
    console.error("MCP 요청 처리 중 오류:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

app.get("/mcp", (req, res) => {
  res.writeHead(405).end(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed." },
      id: null,
    })
  );
});

app.delete("/mcp", (req, res) => {
  res.writeHead(405).end(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed." },
      id: null,
    })
  );
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.error(`construction-alert-mcp 서버가 포트 ${PORT}에서 시작되었습니다. (/mcp)`);
});
