// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from "vitest";
import { MAX_SUBMISSION_FILE_BYTES } from "@/lib/submissionValidation";
import { uploadSubmissionFile } from "@/pages/dashboard/assignment-detail/workflows/submissionActions";

const mocks = vi.hoisted(() => ({
  supabase: {
    storage: {
      from: vi.fn(),
    },
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mocks.supabase,
}));

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

describe("submission upload validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.supabase.storage.from.mockReturnValue({
      upload: vi.fn().mockResolvedValue({
        data: { path: "student-1/assignment-1/file.txt" },
        error: null,
      }),
    });
  });

  it("uploads a valid text file with the normalized MIME type", async () => {
    const uploadSpy = vi.fn().mockResolvedValue({
      data: { path: "student-1/assignment-1/file.txt" },
      error: null,
    });
    mocks.supabase.storage.from.mockReturnValue({
      upload: uploadSpy,
    });

    const file = new File(
      [new TextEncoder().encode("This is a readable report discussing evidence, method, and conclusion.".repeat(8))],
      "report.txt",
      { type: "text/plain; charset=utf-8" },
    );

    const result = await uploadSubmissionFile(file, "student-1", "assignment-1");

    expect(result.fileType).toBe("text/plain");
    expect(uploadSpy).toHaveBeenCalledTimes(1);
    expect(uploadSpy.mock.calls[0]?.[2]).toMatchObject({
      contentType: "text/plain",
    });
  });

  it("rejects an oversized file before touching storage", async () => {
    const file = new File(
      [new Uint8Array(MAX_SUBMISSION_FILE_BYTES + 1)],
      "too-large.pdf",
      { type: "application/pdf" },
    );

    await expect(uploadSubmissionFile(file, "student-1", "assignment-1")).rejects.toThrow(/too large/i);
    expect(mocks.supabase.storage.from).not.toHaveBeenCalled();
  });

  it("rejects a file with the wrong MIME type", async () => {
    const file = new File([buildPdfBytes("Readable submission")], "wrong-mime.pdf", {
      type: "text/plain",
    });

    await expect(uploadSubmissionFile(file, "student-1", "assignment-1")).rejects.toThrow(/MIME type/i);
    expect(mocks.supabase.storage.from).not.toHaveBeenCalled();
  });

  it("rejects an empty file before upload", async () => {
    const file = new File([], "empty.txt", { type: "text/plain" });

    await expect(uploadSubmissionFile(file, "student-1", "assignment-1")).rejects.toThrow(/empty/i);
    expect(mocks.supabase.storage.from).not.toHaveBeenCalled();
  });
});

