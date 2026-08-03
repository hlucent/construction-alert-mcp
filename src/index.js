import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const SEOUL_API_KEY = process.env.SEOUL_OPENAPI_KEY;
const BASE_URL = "http://openapi.seoul.go.kr:8088";

if (!SEOUL_API_KEY) {
  console.error("경고: SEOUL_OPENAPI_KEY 환경변수가 설정되지 않았습니다.");
}

function parseSimpleXml(xml, rowTag) {
  const rows = [];
  const rowRegex = new RegExp(`<${rowTag}>([\\s\\S]*?)<\\/${rowTag}>`, "g");
  let match;
  while ((match = rowRegex.exec(xml)) !== null) {
    const rowXml = match[1];
    const obj = {};
    const fieldRegex = /<([A-Z0-9_]+)>([^<]*)<\/\1>/g;
    let fieldMatch;
    while ((fieldMatch = fieldRegex.exec(rowXml)) !== null) {
      obj[fieldMatch[1]] = fieldMatch[2];
    }
    rows.push(obj);
  }
  return rows;
}

async function fetchProjectList(startIndex, endIndex) {
  const url = `${BASE_URL}/${SEOUL_API_KEY}/xml/pmisPjtList/${startIndex}/${endIndex}`;
  const res = await fetch(url);
  const text = await res.text();
  return parseSimpleXml(text, "row");
}

async function fetchProjectPhotos(pjtCd, startIndex, endIndex) {
  const url = `${BASE_URL}/${SEOUL_API_KEY}/xml/pmisPjtPhoto/${startIndex}/${endIndex}/${pjtCd}`;
  const res = await fetch(url);
  const text = await res.text();
  return parseSimpleXml(text, "row");
}

const server = new McpServer({
  name: "construction-alert-mcp",
  version: "0.1.0",
});

server.tool(
  "search_construction_projects",
  "서울시 건설알림이(One-PMIS) 공사장 목록을 자치구명 또는 키워드로 검색한다. 사업명, 위치, 발주처/시공사, 착공일, 준공예정일, 도급액, 위경도 등을 반환한다.",
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
          });
          if (results.length >= limit) break;
        }
      }
      if (results.length >= limit) break;
    }
    return {
      content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
    };
  }
);

server.tool(
  "get_construction_project_photos",
  "사업코드(PJT_CD)로 서울시 건설알림이 공사현장 사진 목록을 조회한다.",
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
      content: [{ type: "text", text: JSON.stringify(photos, null, 2) }],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("construction-alert-mcp 서버가 시작되었습니다.");
