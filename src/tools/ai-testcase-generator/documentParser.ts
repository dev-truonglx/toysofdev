import * as XLSX from "xlsx";
import * as mammoth from "mammoth";
import { IngestionResult, SemanticChunk } from "./types";

/**
 * Converts an HTML string containing tables into Markdown format,
 * preserving table structures so LLMs can accurately read column associations.
 */
export function htmlTableToMarkdown(html: string): string {
  // If running in browser environment with DOMParser available
  if (typeof DOMParser !== "undefined") {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const tables = doc.querySelectorAll("table");

      tables.forEach((table) => {
        const rows = Array.from(table.querySelectorAll("tr"));
        if (rows.length === 0) return;

        const mdRows: string[] = [];
        let headerLength = 0;

        rows.forEach((row, rowIndex) => {
          const cells = Array.from(row.querySelectorAll("th, td"));
          const cellTexts = cells.map((c) => (c.textContent || "").trim().replace(/\|/g, "\\|"));
          if (cellTexts.length === 0) return;

          if (rowIndex === 0) {
            headerLength = cellTexts.length;
            mdRows.push(`| ${cellTexts.join(" | ")} |`);
            mdRows.push(`| ${cellTexts.map(() => "---").join(" | ")} |`);
          } else {
            while (cellTexts.length < headerLength) cellTexts.push("");
            mdRows.push(`| ${cellTexts.join(" | ")} |`);
          }
        });

        if (mdRows.length > 0) {
          const mdTableText = `\n\n${mdRows.join("\n")}\n\n`;
          const placeholder = doc.createTextNode(mdTableText);
          table.parentNode?.replaceChild(placeholder, table);
        }
      });

      return (doc.body.textContent || "").replace(/\n{3,}/g, "\n\n");
    } catch {
      // Fallback to regex below
    }
  }

  // Universal regex fallback for Node.js / test environments
  const converted = html.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_, tableContent) => {
    const rowMatches = tableContent.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
    if (!rowMatches) return "";

    const mdRows: string[] = [];
    let headerLength = 0;

    rowMatches.forEach((rowHtml: string, rowIndex: number) => {
      const cellMatches = rowHtml.match(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi);
      if (!cellMatches) return;

      const cellTexts = cellMatches.map((c: string) =>
        c.replace(/<[^>]+>/g, "").trim().replace(/\|/g, "\\|")
      );

      if (rowIndex === 0) {
        headerLength = cellTexts.length;
        mdRows.push(`| ${cellTexts.join(" | ")} |`);
        mdRows.push(`| ${cellTexts.map(() => "---").join(" | ")} |`);
      } else {
        while (cellTexts.length < headerLength) cellTexts.push("");
        mdRows.push(`| ${cellTexts.join(" | ")} |`);
      }
    });

    return `\n\n${mdRows.join("\n")}\n\n`;
  });

  return converted.replace(/<[^>]+>/g, "").replace(/\n{3,}/g, "\n\n");
}

/**
 * Converts SheetJS workbook sheets into Markdown tables
 */
export function xlsxToMarkdown(arrayBuffer: ArrayBuffer): { text: string; tableCount: number } {
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const sheetNames = workbook.SheetNames;
  const sections: string[] = [];
  let tableCount = 0;

  for (const sheetName of sheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    // Convert sheet to array of rows
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
    if (!rows || rows.length === 0) continue;

    tableCount++;
    const mdLines: string[] = [`\n### Sheet: ${sheetName}\n`];
    const headerRow = rows[0] || [];
    const colCount = Math.max(...rows.map((r) => (Array.isArray(r) ? r.length : 0)));

    if (colCount === 0) continue;

    const cleanHeaders = Array.from({ length: colCount }, (_, i) => {
      const val = headerRow[i];
      return String(val !== undefined && val !== null ? val : `Col ${i + 1}`).trim().replace(/\|/g, "\\|");
    });

    mdLines.push(`| ${cleanHeaders.join(" | ")} |`);
    mdLines.push(`| ${cleanHeaders.map(() => "---").join(" | ")} |`);

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!Array.isArray(row) || row.every((c) => c === undefined || c === null || String(c).trim() === "")) {
        continue;
      }
      const cells = Array.from({ length: colCount }, (_, cIdx) => {
        const val = row[cIdx];
        return String(val !== undefined && val !== null ? val : "").trim().replace(/\|/g, "\\|");
      });
      mdLines.push(`| ${cells.join(" | ")} |`);
    }

    sections.push(mdLines.join("\n"));
  }

  return { text: sections.join("\n\n"), tableCount };
}

/**
 * Filter out administrative noise:
 * - Revision History / Lịch sử phiên bản / Lịch sử sửa đổi
 * - Document Approvals / Sign-off / Người phê duyệt
 * - General legal terms / Điều khoản chung
 */
export function reduceDocumentNoise(rawText: string): string {
  let cleaned = rawText;

  // Patterns for noise sections
  const noisePatterns = [
    /(?:#+\s*)?(?:revision history|lịch sử sửa đổi|lịch sử phiên bản|document history)[\s\S]*?(?=(?:#+\s*|\n{2,}[A-Z0-9\.\s]{3,}:|\n{2,}[1-9]\.|$))/i,
    /(?:#+\s*)?(?:document approvals|phê duyệt|người ký duyệt|approvals|sign-off)[\s\S]*?(?=(?:#+\s*|\n{2,}[A-Z0-9\.\s]{3,}:|\n{2,}[1-9]\.|$))/i,
    /(?:#+\s*)?(?:legal disclaimers|điều khoản pháp lý chung|disclaimer|confidentiality notice)[\s\S]*?(?=(?:#+\s*|\n{2,}[A-Z0-9\.\s]{3,}:|\n{2,}[1-9]\.|$))/i,
  ];

  for (const pattern of noisePatterns) {
    cleaned = cleaned.replace(pattern, "\n");
  }

  return cleaned.trim();
}

/**
 * Decomposes cleaned text into semantic chunks based on headers / user stories
 */
export function chunkDocumentSemantically(text: string): SemanticChunk[] {
  const lines = text.split("\n");
  const chunks: SemanticChunk[] = [];
  let currentTitle = "General Specification";
  let currentLines: string[] = [];
  let currentType: SemanticChunk["sectionType"] = "general";
  let chunkIdx = 1;

  function pushCurrentChunk() {
    const content = currentLines.join("\n").trim();
    if (content.length > 20) {
      chunks.push({
        id: `chunk_${chunkIdx++}`,
        title: currentTitle,
        content,
        sectionType: currentType,
      });
    }
    currentLines = [];
  }

  for (const line of lines) {
    const trimmed = line.trim();
    const headingMatch = trimmed.match(/^(?:#{1,4}|\d+\.|\b(?:chức năng|module|user story|feature|epics?)\b[:\s])/i);

    if (headingMatch && trimmed.length < 120) {
      pushCurrentChunk();
      currentTitle = trimmed.replace(/^#+\s*/, "");

      const lower = currentTitle.toLowerCase();
      if (lower.includes("matrix") || lower.includes("phân quyền") || lower.includes("rbac") || lower.includes("quyền")) {
        currentType = "matrix";
      } else if (lower.includes("rule") || lower.includes("quy tắc") || lower.includes("ràng buộc") || lower.includes("validate")) {
        currentType = "rules";
      } else if (lower.includes("flow") || lower.includes("luồng") || lower.includes("kịch bản") || lower.includes("bước")) {
        currentType = "flow";
      } else {
        currentType = "general";
      }
    } else {
      currentLines.push(line);
    }
  }

  pushCurrentChunk();

  if (chunks.length === 0 && text.trim().length > 0) {
    chunks.push({
      id: "chunk_1",
      title: "Main Specification",
      content: text.trim(),
      sectionType: "general",
    });
  }

  return chunks;
}

/**
 * Main ingestion entry point supporting multiple file formats
 */
export async function ingestDocument(
  fileOrText: File | string,
  fileName?: string
): Promise<IngestionResult> {
  let rawContent = "";
  let tableCount = 0;
  let fileType = "text";
  let sizeBytes = 0;

  if (typeof fileOrText === "string") {
    rawContent = fileOrText;
    sizeBytes = new Blob([fileOrText]).size;
    fileType = "text/plain";
    // Check for markdown tables
    const tableMatches = rawContent.match(/\|[\s\S]*?\|[\s\S]*?\n\|[-:\s|]+\|/g);
    tableCount = tableMatches ? tableMatches.length : 0;
  } else {
    fileName = fileOrText.name;
    sizeBytes = fileOrText.size;
    fileType = fileOrText.type || fileOrText.name.split(".").pop() || "unknown";
    const lowerName = fileOrText.name.toLowerCase();

    if (lowerName.endsWith(".docx")) {
      const buffer = await fileOrText.arrayBuffer();
      // Try to convert HTML first to preserve table formatting
      try {
        const htmlResult = await mammoth.convertToHtml({ arrayBuffer: buffer });
        rawContent = htmlTableToMarkdown(htmlResult.value);
        const tableMatches = htmlResult.value.match(/<table\b/gi);
        tableCount = tableMatches ? tableMatches.length : 0;
      } catch {
        // Fallback to raw text
        const textResult = await mammoth.extractRawText({ arrayBuffer: buffer });
        rawContent = textResult.value;
      }
    } else if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
      const buffer = await fileOrText.arrayBuffer();
      const xlsxResult = xlsxToMarkdown(buffer);
      rawContent = xlsxResult.text;
      tableCount = xlsxResult.tableCount;
    } else if (lowerName.endsWith(".html") || lowerName.endsWith(".htm")) {
      const htmlText = await fileOrText.text();
      rawContent = htmlTableToMarkdown(htmlText);
      const tableMatches = htmlText.match(/<table\b/gi);
      tableCount = tableMatches ? tableMatches.length : 0;
    } else {
      // Plain text, markdown, csv, or pdf text fallback
      rawContent = await fileOrText.text();
      const tableMatches = rawContent.match(/\|[\s\S]*?\|[\s\S]*?\n\|[-:\s|]+\|/g);
      tableCount = tableMatches ? tableMatches.length : 0;
    }
  }

  const cleanedContent = reduceDocumentNoise(rawContent);
  const chunks = chunkDocumentSemantically(cleanedContent);

  const detectedSections = chunks.map((c) => c.title);

  return {
    rawContent,
    cleanedContent,
    metadata: {
      fileName: fileName || "Pasted_Spec_Text",
      fileType,
      sizeBytes,
      detectedSections,
      tableCount,
    },
    chunks,
  };
}
