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

async function fetchProjectList(startIndex, endIndex) {
  const url = `${BASE_URL}/${getApiKey()}/xml/pmisPjtList/${startIndex}/${endIndex}`;
  const res = await fetch(url);
  const text = await res.text();
  return parseSimpleXml(text, "row");
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
  return parseSimpleXml(text, "row");
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
  return parseSimpleXml(text, "row");
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
      max_scan: z.number().int().min(1).max(2000).default(500).describe("검색을 위해 훑어볼 최대 레코드 수 (기본 500)"),
      limit: z.number().int().min(1).max(50).default(10).describe("반환할 최대 결과 수 (기본 10)"),
    },
    async ({ gu_name, keyword, max_scan, limit }) => {
      const pageSize = 500;
      const results = [];
      for (let start = 1; start <= max_scan; start += pageSize) {
        const end = Math.min(start + pageSize - 1, max_scan);
        const rows = await fetchProjectList(start, end);
        if (rows.length === 0) break;
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
            if (results.length >= limit) break;
          }
        }
        if (results.length >= limit) break;
      }
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
      limit: z.number().int().min(1).max(50).default(10).describe("반환할 최대 사진 수 (기본 10)"),
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
      limit: z.number().int().min(1).max(50).default(10).describe("반환할 최대 결과 수 (기본 10)"),
    },
    async ({ gu_name, biz_name, limit }) => {
      const pageSize = 500;
      const maxScan = 2000;
      const results = [];

      for (let start = 1; start <= maxScan; start += pageSize) {
        const end = Math.min(start + pageSize - 1, maxScan);
        const rows = await fetchConstructionWorkList(start, end, gu_name);
        if (rows.length === 0) break;
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
            if (results.length >= limit) break;
          }
        }
        if (results.length >= limit) break;
      }

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
      min_amount: z.number().optional().describe("최소 도급액(억원). 지정하면 도급액(AMT_CTRT)이 이 값 이상인 건만 반환. API 자체 필터는 없어 max_scan만큼 조회한 뒤 클라이언트에서 필터링한다."),
      max_scan: z.number().int().min(1).max(2000).default(500).describe("검색을 위해 훑어볼 최대 레코드 수 (기본 500)"),
      limit: z.number().int().min(1).max(50).default(10).describe("반환할 최대 결과 수 (기본 10)"),
    },
    async ({ biz_name, inst_name, gu_name, min_amount, max_scan, limit }) => {
      const pageSize = 500;
      const results = [];

      for (let start = 1; start <= max_scan; start += pageSize) {
        const end = Math.min(start + pageSize - 1, max_scan);
        const rows = await fetchConstructionProgress(start, end, biz_name, inst_name);
        if (rows.length === 0) break;
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
            if (results.length >= limit) break;
          }
        }
        if (results.length >= limit) break;
      }

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

// 같은 IP 기준 분당 3회 초과 호출을 429로 차단하는 간단한 슬라이딩 윈도우 rate limiter.
// 인증(?key=) 없이 URL만으로 접속 가능해진 대신, 무제한 호출을 막기 위한 최소한의 안전장치.
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 3;
const requestLogByIp = new Map();

app.use("/mcp", (req, res, next) => {
  const ip = req.ip;
  const now = Date.now();
  const timestamps = (requestLogByIp.get(ip) || []).filter(
    (ts) => now - ts < RATE_LIMIT_WINDOW_MS
  );

  if (timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    res
      .status(429)
      .type("text/plain; charset=utf-8")
      .send("요청이 너무 많습니다. 1분에 최대 3회까지 호출할 수 있습니다. 잠시 후 다시 시도해주세요.");
    return;
  }

  timestamps.push(now);
  requestLogByIp.set(ip, timestamps);
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
