// @vitest-environment node

import { Buffer } from "node:buffer";
import mammoth from "mammoth";
import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import {
  DOCUMENT_EXTRACTION_ERROR_MESSAGE,
  extractDocumentText,
  MIN_EXTRACTED_TEXT_CHARS,
} from "../../supabase/functions/_shared/document-extraction-core";

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildDocxBytes(text: string) {
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
 xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
 xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
 xmlns:v="urn:schemas-microsoft-com:vml"
 xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing"
 xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
 xmlns:w10="urn:schemas-microsoft-com:office:word"
 xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
 xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
 xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml"
 xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"
 xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk"
 xmlns:wne="http://schemas.microsoft.com/office/2006/wordml"
 xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"
 mc:Ignorable="w14 w15 wp14">
  <w:body>
    <w:p><w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  const files = {
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId0" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`),
    "docProps/core.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
 xmlns:dc="http://purl.org/dc/elements/1.1/"
 xmlns:dcterms="http://purl.org/dc/terms/"
 xmlns:dcmitype="http://purl.org/dc/dcmitype/"
 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Test document</dc:title>
</cp:coreProperties>`),
    "docProps/app.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"
 xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>GradeAI Test</Application>
</Properties>`),
    "word/_rels/document.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`),
    "word/document.xml": strToU8(documentXml),
  };

  return zipSync(files);
}

function buildPdfBytes(text: string) {
  const escaped = text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length ${escaped.length + 30} >>
stream
BT
/F1 12 Tf
72 720 Td
(${escaped}) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000117 00000 n 
0000000207 00000 n 
trailer
<< /Root 1 0 R /Size 5 >>
startxref
315
%%EOF`;

  return new TextEncoder().encode(pdf);
}

const docxExtractor = async (bytes: Uint8Array) => {
  const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  return {
    value: result.value,
    messages: result.messages.map((message) => message.message),
  };
};

describe("document extraction", () => {
  it("extracts readable text from a DOCX student report", async () => {
    const reportText = "GradeAI student report. ".repeat(20);
    const result = await extractDocumentText({
      fileName: "student-report.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      bytes: buildDocxBytes(reportText),
      docxExtractor,
    });

    expect(result.success).toBe(true);
    expect(result.fileType).toBe("docx");
    expect(result.extractedText).toContain("GradeAI student report.");
    expect(result.extractedTextLength).toBeGreaterThan(MIN_EXTRACTED_TEXT_CHARS);
  });

  it("extracts readable text from a PDF report", async () => {
    const reportText = "This PDF report discusses the student's argument, evidence, method, and conclusion in enough detail to be graded safely. ".repeat(8);
    const result = await extractDocumentText({
      fileName: "report.pdf",
      mimeType: "application/pdf",
      bytes: buildPdfBytes(reportText),
    });

    expect(result.success).toBe(true);
    expect(result.fileType).toBe("pdf");
    expect(result.extractedText).toContain("This PDF report discusses");
    expect(result.extractedTextLength).toBeGreaterThan(MIN_EXTRACTED_TEXT_CHARS);
  });

  it("rejects a blank DOCX document", async () => {
    const result = await extractDocumentText({
      fileName: "blank-report.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      bytes: buildDocxBytes(""),
      docxExtractor,
    });

    expect(result.success).toBe(false);
    expect(result.manualReviewRequired).toBe(true);
    expect(result.extractionError).toBe(DOCUMENT_EXTRACTION_ERROR_MESSAGE);
  });

  it("rejects unsupported file types", async () => {
    const result = await extractDocumentText({
      fileName: "archive.zip",
      mimeType: "application/zip",
      bytes: new TextEncoder().encode("PK zipped content"),
      docxExtractor,
    });

    expect(result.success).toBe(false);
    expect(result.fileType).toBe("unsupported");
    expect(result.extractionError).toBe(DOCUMENT_EXTRACTION_ERROR_MESSAGE);
  });
});
