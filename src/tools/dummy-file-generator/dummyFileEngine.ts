export type DummyFileFormat =
  | "pdf"
  | "png"
  | "jpg"
  | "docx"
  | "xlsx"
  | "zip"
  | "csv"
  | "txt"
  | "json"
  | "mp4"
  | "bin";

export type DummyFillPattern = "random" | "zeros" | "pattern" | "text";

export type DummySizeUnit = "B" | "KB" | "MB" | "GB";

export interface DummyFileOptions {
  filename: string;
  format: DummyFileFormat;
  sizeBytes: number;
  pattern: DummyFillPattern;
  corruptHeader?: boolean;
}

export interface FormatMetadata {
  format: DummyFileFormat;
  name: string;
  mime: string;
  defaultExt: string;
  magicBytes?: number[];
}

export const SUPPORTED_FORMATS: Record<DummyFileFormat, FormatMetadata> = {
  pdf: {
    format: "pdf",
    name: "PDF Document (.pdf)",
    mime: "application/pdf",
    defaultExt: "pdf",
    magicBytes: [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34], // %PDF-1.4
  },
  png: {
    format: "png",
    name: "PNG Image (.png)",
    mime: "image/png",
    defaultExt: "png",
    magicBytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], // \x89PNG\r\n\x1a\n
  },
  jpg: {
    format: "jpg",
    name: "JPEG Image (.jpg)",
    mime: "image/jpeg",
    defaultExt: "jpg",
    magicBytes: [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46], // JFIF
  },
  docx: {
    format: "docx",
    name: "Word Document (.docx)",
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    defaultExt: "docx",
    magicBytes: [0x50, 0x4b, 0x03, 0x04], // PK.. (Zip header)
  },
  xlsx: {
    format: "xlsx",
    name: "Excel Spreadsheet (.xlsx)",
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    defaultExt: "xlsx",
    magicBytes: [0x50, 0x4b, 0x03, 0x04], // PK.. (Zip header)
  },
  zip: {
    format: "zip",
    name: "ZIP Archive (.zip)",
    mime: "application/zip",
    defaultExt: "zip",
    magicBytes: [0x50, 0x4b, 0x03, 0x04], // PK..
  },
  csv: {
    format: "csv",
    name: "CSV Delimited (.csv)",
    mime: "text/csv",
    defaultExt: "csv",
  },
  txt: {
    format: "txt",
    name: "Plain Text (.txt)",
    mime: "text/plain",
    defaultExt: "txt",
  },
  json: {
    format: "json",
    name: "JSON Data (.json)",
    mime: "application/json",
    defaultExt: "json",
  },
  mp4: {
    format: "mp4",
    name: "MP4 Video Container (.mp4)",
    mime: "video/mp4",
    defaultExt: "mp4",
    magicBytes: [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d], // ftypisom
  },
  bin: {
    format: "bin",
    name: "Binary Stream (.bin)",
    mime: "application/octet-stream",
    defaultExt: "bin",
  },
};

export function convertToBytes(value: number, unit: DummySizeUnit): number {
  if (value < 0 || isNaN(value)) return 0;
  switch (unit) {
    case "B":
      return Math.round(value);
    case "KB":
      return Math.round(value * 1024);
    case "MB":
      return Math.round(value * 1024 * 1024);
    case "GB":
      return Math.round(value * 1024 * 1024 * 1024);
    default:
      return Math.round(value);
  }
}

export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

// CRC32 Lookup Table for PNG & ZIP
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c >>> 0;
}

export function computeCrc32(buf: Uint8Array, offset: number = 0, length?: number): number {
  const len = length ?? buf.length - offset;
  let c = 0xffffffff;
  for (let i = 0; i < len; i++) {
    c = CRC_TABLE[(c ^ buf[offset + i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function fillPatternBytes(buffer: Uint8Array, pattern: DummyFillPattern, start: number = 0, end?: number) {
  const finish = end ?? buffer.length;
  const len = finish - start;
  if (len <= 0) return;

  if (pattern === "zeros") {
    buffer.fill(0, start, finish);
  } else if (pattern === "pattern") {
    const patternStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-";
    const pLen = patternStr.length;
    for (let i = start; i < finish; i++) {
      buffer[i] = patternStr.charCodeAt((i - start) % pLen);
    }
  } else if (pattern === "text") {
    const sampleLine = "ToysOfDev mock test file content line for size and upload validation.\n";
    const lineLen = sampleLine.length;
    for (let i = start; i < finish; i++) {
      buffer[i] = sampleLine.charCodeAt((i - start) % lineLen);
    }
  } else {
    // Fast pseudo-random fill
    let seed = 0x811c9dc5 ^ (start + 1);
    for (let i = start; i < finish; i++) {
      seed ^= seed << 13;
      seed ^= seed >> 17;
      seed ^= seed << 5;
      buffer[i] = seed & 0xff;
    }
  }
}

// 1. Valid Openable PNG Builder
function buildValidPng(sizeBytes: number, pattern: DummyFillPattern): Uint8Array {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  // IHDR: 1x1 RGBA (8-bit)
  const ihdrData = [
    0x00, 0x00, 0x00, 0x01, // width: 1
    0x00, 0x00, 0x00, 0x01, // height: 1
    0x08, // bit depth
    0x06, // color type: RGBA
    0x00, // compression
    0x00, // filter
    0x00, // interlace
  ];
  const ihdrChunk = createPngChunk("IHDR", new Uint8Array(ihdrData));

  // Minimal valid IDAT for 1x1 transparent pixel
  const idatRaw = [0x78, 0x9c, 0x62, 0x60, 0x60, 0x60, 0x00, 0x00, 0x00, 0x04, 0x00, 0x01];
  const idatChunk = createPngChunk("IDAT", new Uint8Array(idatRaw));

  // IEND chunk
  const iendChunk = createPngChunk("IEND", new Uint8Array(0));

  const baseLen = signature.length + ihdrChunk.length + idatChunk.length + iendChunk.length; // 85 bytes

  if (sizeBytes <= baseLen) {
    const minBuf = new Uint8Array(Math.max(sizeBytes, baseLen));
    let pos = 0;
    minBuf.set(signature, pos); pos += signature.length;
    minBuf.set(ihdrChunk, pos); pos += ihdrChunk.length;
    minBuf.set(idatChunk, pos); pos += idatChunk.length;
    minBuf.set(iendChunk, pos);
    return minBuf.slice(0, sizeBytes);
  }

  // Add ancillary padding chunk 'paDd' (PNG specification allows ancillary chunks with lowercase initial)
  const padDataLen = sizeBytes - baseLen - 12; // 12 bytes = 4 length + 4 type + 4 crc
  const padData = new Uint8Array(Math.max(0, padDataLen));
  fillPatternBytes(padData, pattern);

  const padChunk = createPngChunk("paDd", padData);

  const finalBuf = new Uint8Array(sizeBytes);
  let offset = 0;
  finalBuf.set(signature, offset); offset += signature.length;
  finalBuf.set(ihdrChunk, offset); offset += ihdrChunk.length;
  finalBuf.set(padChunk, offset); offset += padChunk.length;
  finalBuf.set(idatChunk, offset); offset += idatChunk.length;
  finalBuf.set(iendChunk, offset);

  return finalBuf;
}

function createPngChunk(typeStr: string, data: Uint8Array): Uint8Array {
  const len = data.length;
  const chunk = new Uint8Array(12 + len);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, len, false); // Length (Big Endian)

  for (let i = 0; i < 4; i++) {
    chunk[4 + i] = typeStr.charCodeAt(i);
  }
  chunk.set(data, 8);

  const crc = computeCrc32(chunk, 4, 4 + len);
  view.setUint32(8 + len, crc, false); // CRC32 (Big Endian)

  return chunk;
}

// 2. Valid Openable JPEG Builder
function buildValidJpeg(sizeBytes: number, pattern: DummyFillPattern): Uint8Array {
  // Minimal valid 1x1 JPEG image structure
  const header = [
    0xff, 0xd8, // SOI
    0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, // APP0 JFIF
  ];

  const tail = [
    // DQT (Quantization Table)
    0xff, 0xdb, 0x00, 0x43, 0x00,
    0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14,
    0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12, 0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a,
    0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c,
    0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32,
    // SOF0 (Start of Frame: 1x1)
    0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00,
    // DHT (Huffman Tables)
    0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b,
    0xff, 0xc4, 0x00, 0xb5, 0x10, 0x00, 0x02, 0x01, 0x03, 0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04,
    0x04, 0x00, 0x00, 0x01, 0x7d, 0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41,
    0x06, 0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xa1, 0x08, 0x23, 0x42, 0xb1,
    0xc1, 0x15, 0x52, 0xd1, 0xf0, 0x24, 0x33, 0x62, 0x72, 0x82, 0x09, 0x0a, 0x16, 0x17, 0x18, 0x19,
    0x1a, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2a, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44,
    0x45, 0x46, 0x47, 0x48, 0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5a, 0x63, 0x64,
    0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84,
    0x85, 0x86, 0x87, 0x88, 0x89, 0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2,
    0xa3, 0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9,
    0xba, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7,
    0xd8, 0xd9, 0xda, 0xe1, 0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2, 0xf3,
    0xf4, 0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa,
    // SOS (Start of Scan)
    0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x7f, 0x00,
    // EOI (End of Image)
    0xff, 0xd9,
  ];

  const baseLen = header.length + tail.length; // ~400 bytes

  if (sizeBytes <= baseLen) {
    const minBuf = new Uint8Array(Math.max(sizeBytes, baseLen));
    minBuf.set(header, 0);
    minBuf.set(tail, header.length);
    return minBuf.slice(0, sizeBytes);
  }

  // In JPEG, we can place a COM (Comment) or APP1 padding segment right after APP0
  const buffer = new Uint8Array(sizeBytes);
  buffer.set(header, 0);
  let pos = header.length;

  let remainingPad = sizeBytes - baseLen;
  while (remainingPad > 0) {
    const chunkPayload = Math.min(65530, remainingPad >= 4 ? remainingPad - 4 : 0);
    if (remainingPad < 4) {
      // fill directly into tail space
      break;
    }
    const chunkTotal = chunkPayload + 4;
    buffer[pos] = 0xff;
    buffer[pos + 1] = 0xfe; // COM marker
    const segLen = chunkPayload + 2;
    buffer[pos + 2] = (segLen >> 8) & 0xff;
    buffer[pos + 3] = segLen & 0xff;
    fillPatternBytes(buffer, pattern, pos + 4, pos + 4 + chunkPayload);

    pos += chunkTotal;
    remainingPad -= chunkTotal;
  }

  buffer.set(tail, buffer.length - tail.length);
  return buffer;
}

// 3. Valid Openable PDF Builder
function buildValidPdf(sizeBytes: number, pattern: DummyFillPattern): Uint8Array {
  const encoder = new TextEncoder();
  const header = "%PDF-1.4\n";
  const obj1 = "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
  const obj2 = "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n";
  const obj5 = "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n";

  const streamContent = `BT /F1 18 Tf 50 720 Td (ToysOfDev - Mock Test File) Tj ET\nBT /F1 12 Tf 50 690 Td (Target Size: ${formatBytes(sizeBytes)}) Tj ET\nBT /F1 10 Tf 50 660 Td (This valid PDF was generated for size and upload testing.) Tj ET\n`;
  const streamBytes = encoder.encode(streamContent);

  const obj3 = "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n";
  const obj4Header = `4 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n${streamContent}endstream\nendobj\n`;

  const skeleton = header + obj1 + obj2 + obj3 + obj4Header + obj5;
  const baseTrailer = `xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000240 00000 n \n0000000450 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n0000000550\n%%EOF\n`;

  const minPdfLen = skeleton.length + baseTrailer.length;

  if (sizeBytes <= minPdfLen) {
    const raw = encoder.encode(skeleton + baseTrailer);
    return raw.slice(0, sizeBytes);
  }

  // To reach exact target size, insert a padded comment block before xref
  const padLen = sizeBytes - minPdfLen;
  let commentPad = `% PADDING_COMMENT_START\n% `;
  const commentEnd = `\n% PADDING_COMMENT_END\n`;
  const neededChars = Math.max(0, padLen - commentPad.length - commentEnd.length);

  const padArr = new Uint8Array(neededChars);
  fillPatternBytes(padArr, pattern);
  let padStr = "";
  for (let i = 0; i < padArr.length; i++) {
    const ch = padArr[i];
    // Keep printable chars for PDF comment safety
    padStr += (ch >= 32 && ch <= 126) ? String.fromCharCode(ch) : "A";
  }

  commentPad += padStr + commentEnd;

  const totalContentBeforeXref = skeleton + commentPad;
  const offObj1 = header.length;
  const offObj2 = offObj1 + obj1.length;
  const offObj3 = offObj2 + obj2.length;
  const offObj4 = offObj3 + obj3.length;
  const offObj5 = offObj4 + obj4Header.length;
  const startXref = totalContentBeforeXref.length;

  const padNum = (num: number) => String(num).padStart(10, "0");

  const xrefTable = `xref\n0 6\n0000000000 65535 f \n${padNum(offObj1)} 00000 n \n${padNum(offObj2)} 00000 n \n${padNum(offObj3)} 00000 n \n${padNum(offObj4)} 00000 n \n${padNum(offObj5)} 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;

  const finalPdf = totalContentBeforeXref + xrefTable;
  const finalBytes = encoder.encode(finalPdf);

  if (finalBytes.length === sizeBytes) {
    return finalBytes;
  }

  // Exact fit adjustment
  const res = new Uint8Array(sizeBytes);
  res.set(finalBytes.slice(0, sizeBytes));
  return res;
}

// 4. Valid Openable ZIP / DOCX / XLSX Builder
function buildValidZipContainer(
  sizeBytes: number,
  format: "zip" | "docx" | "xlsx",
  pattern: DummyFillPattern
): Uint8Array {
  const encoder = new TextEncoder();
  let innerFileName = "dummy_data.txt";
  let sampleText = `ToysOfDev mock test file container.\nTarget size: ${formatBytes(sizeBytes)}\n`;

  if (format === "docx") {
    innerFileName = "word/document.xml";
    sampleText = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>ToysOfDev Mock Word Document (${formatBytes(sizeBytes)})</w:t></w:r></w:p></w:body></w:document>`;
  } else if (format === "xlsx") {
    innerFileName = "xl/workbook.xml";
    sampleText = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  }

  const nameBytes = encoder.encode(innerFileName);
  const sampleDataBytes = encoder.encode(sampleText);

  // Local File Header: 30 bytes + nameBytes.length
  // Central Directory: 46 bytes + nameBytes.length
  // End of Central Directory (EOCD): 22 bytes
  const minStructureLen = 30 + nameBytes.length + sampleDataBytes.length + 46 + nameBytes.length + 22;

  if (sizeBytes < minStructureLen) {
    const minBuf = new Uint8Array(sizeBytes);
    fillPatternBytes(minBuf, pattern);
    // Put magic PK..
    minBuf[0] = 0x50; minBuf[1] = 0x4b; minBuf[2] = 0x03; minBuf[3] = 0x04;
    return minBuf;
  }

  const innerPayloadLen = sizeBytes - (30 + nameBytes.length + 46 + nameBytes.length + 22);
  const payloadBuffer = new Uint8Array(innerPayloadLen);
  payloadBuffer.set(sampleDataBytes.slice(0, innerPayloadLen), 0);
  fillPatternBytes(payloadBuffer, pattern, sampleDataBytes.length, innerPayloadLen);

  const crc = computeCrc32(payloadBuffer);

  const zipBuf = new Uint8Array(sizeBytes);
  const view = new DataView(zipBuf.buffer);
  let pos = 0;

  // 1. Local File Header
  view.setUint32(pos, 0x04034b50, true); pos += 4; // PK\x03\x04
  view.setUint16(pos, 20, true); pos += 2; // version needed
  view.setUint16(pos, 0, true); pos += 2; // flags
  view.setUint16(pos, 0, true); pos += 2; // compression = 0 (stored)
  view.setUint16(pos, 0x546b, true); pos += 2; // mod time
  view.setUint16(pos, 0x5928, true); pos += 2; // mod date
  view.setUint32(pos, crc, true); pos += 4; // crc32
  view.setUint32(pos, innerPayloadLen, true); pos += 4; // compressed size
  view.setUint32(pos, innerPayloadLen, true); pos += 4; // uncompressed size
  view.setUint16(pos, nameBytes.length, true); pos += 2; // filename len
  view.setUint16(pos, 0, true); pos += 2; // extra field len
  zipBuf.set(nameBytes, pos); pos += nameBytes.length;

  // File Payload
  zipBuf.set(payloadBuffer, pos); pos += payloadBuffer.length;

  const centralDirStart = pos;

  // 2. Central Directory Header
  view.setUint32(pos, 0x02014b50, true); pos += 4; // PK\x01\x02
  view.setUint16(pos, 20, true); pos += 2; // version made by
  view.setUint16(pos, 20, true); pos += 2; // version needed
  view.setUint16(pos, 0, true); pos += 2; // flags
  view.setUint16(pos, 0, true); pos += 2; // compression
  view.setUint16(pos, 0x546b, true); pos += 2; // mod time
  view.setUint16(pos, 0x5928, true); pos += 2; // mod date
  view.setUint32(pos, crc, true); pos += 4; // crc32
  view.setUint32(pos, innerPayloadLen, true); pos += 4; // compressed size
  view.setUint32(pos, innerPayloadLen, true); pos += 4; // uncompressed size
  view.setUint16(pos, nameBytes.length, true); pos += 2; // filename len
  view.setUint16(pos, 0, true); pos += 2; // extra field len
  view.setUint16(pos, 0, true); pos += 2; // comment len
  view.setUint16(pos, 0, true); pos += 2; // disk num start
  view.setUint16(pos, 0, true); pos += 2; // internal file attr
  view.setUint32(pos, 0, true); pos += 4; // external file attr
  view.setUint32(pos, 0, true); pos += 4; // relative offset of local header
  zipBuf.set(nameBytes, pos); pos += nameBytes.length;

  const centralDirSize = pos - centralDirStart;

  // 3. End of Central Directory (EOCD)
  view.setUint32(pos, 0x06054b50, true); pos += 4; // PK\x05\x06
  view.setUint16(pos, 0, true); pos += 2; // disk number
  view.setUint16(pos, 0, true); pos += 2; // disk with central dir
  view.setUint16(pos, 1, true); pos += 2; // total entries disk
  view.setUint16(pos, 1, true); pos += 2; // total entries total
  view.setUint32(pos, centralDirSize, true); pos += 4; // central dir size
  view.setUint32(pos, centralDirStart, true); pos += 4; // central dir offset
  view.setUint16(pos, 0, true); // comment len

  return zipBuf;
}

// 5. Valid CSV Builder
function buildValidCsv(sizeBytes: number, _pattern: DummyFillPattern): Uint8Array {
  const encoder = new TextEncoder();
  const header = "id,first_name,last_name,email,role,status,department,created_at\n";
  const headerBytes = encoder.encode(header);

  if (sizeBytes <= headerBytes.length) {
    return headerBytes.slice(0, sizeBytes);
  }

  const buf = new Uint8Array(sizeBytes);
  buf.set(headerBytes, 0);
  let pos = headerBytes.length;
  let rowId = 1;

  while (pos < sizeBytes) {
    const row = `${rowId},User${rowId},Developer,user${rowId}@example.com,QA_Tester,Active,Engineering,2026-09-24\n`;
    const rowBytes = encoder.encode(row);
    if (pos + rowBytes.length <= sizeBytes) {
      buf.set(rowBytes, pos);
      pos += rowBytes.length;
      rowId++;
    } else {
      // Fill remaining with padded spaces/newlines
      for (let i = pos; i < sizeBytes - 1; i++) {
        buf[i] = 0x20; // space
      }
      buf[sizeBytes - 1] = 0x0a; // \n
      break;
    }
  }

  return buf;
}

// 6. Valid JSON Builder
function buildValidJson(sizeBytes: number, pattern: DummyFillPattern): Uint8Array {
  const encoder = new TextEncoder();
  const prefix = `{\n  "status": "success",\n  "generator": "ToysOfDev",\n  "targetSizeBytes": ${sizeBytes},\n  "data": "`;
  const suffix = `"\n}\n`;

  const prefixBytes = encoder.encode(prefix);
  const suffixBytes = encoder.encode(suffix);
  const minJsonLen = prefixBytes.length + suffixBytes.length;

  if (sizeBytes <= minJsonLen) {
    const fallback = `{"size":${sizeBytes}}`;
    const fBytes = encoder.encode(fallback);
    return fBytes.slice(0, sizeBytes);
  }

  const buf = new Uint8Array(sizeBytes);
  buf.set(prefixBytes, 0);

  const fillLen = sizeBytes - minJsonLen;
  const fillStart = prefixBytes.length;
  const fillEnd = fillStart + fillLen;

  // JSON string safety: use alphanumeric/ASCII chars
  if (pattern === "zeros") {
    buf.fill(0x30, fillStart, fillEnd); // '0'
  } else {
    const patternStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const pLen = patternStr.length;
    for (let i = fillStart; i < fillEnd; i++) {
      buf[i] = patternStr.charCodeAt((i - fillStart) % pLen);
    }
  }

  buf.set(suffixBytes, fillEnd);
  return buf;
}

// 7. Valid TXT Builder
function buildValidTxt(sizeBytes: number, _pattern: DummyFillPattern): Uint8Array {
  const encoder = new TextEncoder();
  const header = `=== ToysOfDev Dummy Test File ===\nTarget Size: ${formatBytes(sizeBytes)}\n\n`;
  const headerBytes = encoder.encode(header);

  if (sizeBytes <= headerBytes.length) {
    return headerBytes.slice(0, sizeBytes);
  }

  const buf = new Uint8Array(sizeBytes);
  buf.set(headerBytes, 0);
  let pos = headerBytes.length;
  let lineNum = 1;

  while (pos < sizeBytes) {
    const line = `[Line ${lineNum.toString().padStart(6, "0")}] Sample log statement for upload, parsing and size stress validation.\n`;
    const lineBytes = encoder.encode(line);
    if (pos + lineBytes.length <= sizeBytes) {
      buf.set(lineBytes, pos);
      pos += lineBytes.length;
      lineNum++;
    } else {
      for (let i = pos; i < sizeBytes - 1; i++) {
        buf[i] = 0x20;
      }
      buf[sizeBytes - 1] = 0x0a;
      break;
    }
  }

  return buf;
}

// 8. Valid Playable MP4 Video Builder (H.264/AVC1, 64x64, 25fps)
const VALID_BASE_MP4_B64 =
  "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";

function decodeBase64ToUint8Array(b64: string): Uint8Array {
  const binaryString = atob(b64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function buildValidMp4(sizeBytes: number, pattern: DummyFillPattern): Uint8Array {
  const baseVideo = decodeBase64ToUint8Array(VALID_BASE_MP4_B64);
  const baseLen = baseVideo.length;

  if (sizeBytes <= baseLen) {
    return baseVideo.slice(0, Math.max(1, sizeBytes));
  }

  const padSize = sizeBytes - baseLen;
  const buf = new Uint8Array(sizeBytes);
  buf.set(baseVideo, 0);

  if (padSize >= 8) {
    const view = new DataView(buf.buffer, baseLen);
    view.setUint32(0, padSize, false);
    buf[baseLen + 4] = 0x66; // 'f'
    buf[baseLen + 5] = 0x72; // 'r'
    buf[baseLen + 6] = 0x65; // 'e'
    buf[baseLen + 7] = 0x65; // 'e'
    fillPatternBytes(buf, pattern, baseLen + 8, sizeBytes);
  } else {
    fillPatternBytes(buf, pattern, baseLen, sizeBytes);
  }

  return buf;
}

// Main generation dispatcher
export function generateDummyBuffer(options: DummyFileOptions): Uint8Array {
  const { sizeBytes, format, pattern, corruptHeader } = options;

  if (sizeBytes <= 0) {
    return new Uint8Array(0);
  }

  let buffer: Uint8Array;

  switch (format) {
    case "png":
      buffer = buildValidPng(sizeBytes, pattern);
      break;
    case "jpg":
      buffer = buildValidJpeg(sizeBytes, pattern);
      break;
    case "pdf":
      buffer = buildValidPdf(sizeBytes, pattern);
      break;
    case "docx":
    case "xlsx":
    case "zip":
      buffer = buildValidZipContainer(sizeBytes, format, pattern);
      break;
    case "csv":
      buffer = buildValidCsv(sizeBytes, pattern);
      break;
    case "json":
      buffer = buildValidJson(sizeBytes, pattern);
      break;
    case "txt":
      buffer = buildValidTxt(sizeBytes, pattern);
      break;
    case "mp4":
      buffer = buildValidMp4(sizeBytes, pattern);
      break;
    case "bin":
    default:
      buffer = new Uint8Array(sizeBytes);
      fillPatternBytes(buffer, pattern);
      break;
  }

  // Corrupt header if deliberately requested for negative testing
  if (corruptHeader && buffer.length > 0) {
    const corruptLen = Math.min(8, buffer.length);
    for (let i = 0; i < corruptLen; i++) {
      buffer[i] = 0x00;
    }
  }

  return buffer;
}

export function createDummyBlob(options: DummyFileOptions): { blob: Blob; url: string } {
  const buffer = generateDummyBuffer(options);
  const metadata = SUPPORTED_FORMATS[options.format] || SUPPORTED_FORMATS.bin;
  const blob = new Blob([buffer], { type: metadata.mime });
  const url = URL.createObjectURL(blob);
  return { blob, url };
}

export interface FilePreset {
  id: string;
  name: string;
  description: string;
  format: DummyFileFormat;
  sizeValue: number;
  sizeUnit: DummySizeUnit;
  pattern: DummyFillPattern;
  corruptHeader?: boolean;
}

export const DUMMY_FILE_PRESETS: FilePreset[] = [
  {
    id: "zero-byte",
    name: "0 Byte File (Empty)",
    description: "Test upload validation for empty files (0 B)",
    format: "txt",
    sizeValue: 0,
    sizeUnit: "B",
    pattern: "zeros",
  },
  {
    id: "avatar-png-2mb",
    name: "2 MB Valid PNG Image",
    description: "Standard profile photo upload limit test",
    format: "png",
    sizeValue: 2,
    sizeUnit: "MB",
    pattern: "random",
  },
  {
    id: "pdf-boundary-499mb",
    name: "4.99 MB PDF (Under 5MB Boundary)",
    description: "Just below typical 5 MB attachment limit",
    format: "pdf",
    sizeValue: 4.99,
    sizeUnit: "MB",
    pattern: "text",
  },
  {
    id: "pdf-boundary-501mb",
    name: "5.01 MB PDF (Exceeds 5MB Boundary)",
    description: "Just above typical 5 MB attachment limit",
    format: "pdf",
    sizeValue: 5.01,
    sizeUnit: "MB",
    pattern: "text",
  },
  {
    id: "corrupted-pdf-1mb",
    name: "1 MB Corrupt PDF (Magic Byte Fuzz)",
    description: "Valid size with corrupted header to test server MIME validation",
    format: "pdf",
    sizeValue: 1,
    sizeUnit: "MB",
    pattern: "random",
    corruptHeader: true,
  },
  {
    id: "docx-10mb",
    name: "10 MB Valid Word DOCX",
    description: "Large enterprise document processing test",
    format: "docx",
    sizeValue: 10,
    sizeUnit: "MB",
    pattern: "pattern",
  },
  {
    id: "zip-archive-25mb",
    name: "25 MB Valid ZIP Archive",
    description: "Batch import package and decompression test",
    format: "zip",
    sizeValue: 25,
    sizeUnit: "MB",
    pattern: "random",
  },
];
