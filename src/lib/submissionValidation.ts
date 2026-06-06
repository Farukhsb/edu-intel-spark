export const MAX_SUBMISSION_FILE_BYTES = 10 * 1024 * 1024;

export type SubmissionFileType = "code" | "docx" | "pdf" | "txt" | "unsupported";

export type SubmissionFileValidationFailureReason =
  | "empty_file"
  | "file_too_large"
  | "corrupted_docx"
  | "corrupted_pdf"
  | "mime_type_mismatch"
  | "password_protected_pdf"
  | "unsupported_submission_file";

type SubmissionFileRule = {
  fileType: Exclude<SubmissionFileType, "unsupported">;
  extensions: readonly string[];
  mimeTypes: readonly string[];
};

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PDF_MIME = "application/pdf";
const TXT_MIME = "text/plain";

const CODE_MIME_TYPES = [
  "application/javascript",
  "application/typescript",
  "application/x-javascript",
  "text/javascript",
  "text/plain",
  "text/typescript",
  "text/x-c",
  "text/x-c++src",
  "text/x-csharp",
  "text/x-haskell",
  "text/x-java-source",
  "text/x-javascript",
  "text/x-perl",
  "text/x-pascal",
  "text/x-python",
  "text/x-verilog",
  "text/x-vhdl",
] as const;

const SUBMISSION_FILE_RULES: SubmissionFileRule[] = [
  {
    fileType: "pdf",
    extensions: [".pdf"],
    mimeTypes: [PDF_MIME],
  },
  {
    fileType: "docx",
    extensions: [".docx"],
    mimeTypes: [DOCX_MIME],
  },
  {
    fileType: "txt",
    extensions: [".txt"],
    mimeTypes: [TXT_MIME],
  },
  {
    fileType: "code",
    extensions: [
      ".c",
      ".cc",
      ".cs",
      ".cpp",
      ".go",
      ".hs",
      ".java",
      ".js",
      ".kt",
      ".kts",
      ".pas",
      ".php",
      ".pl",
      ".py",
      ".rb",
      ".rs",
      ".scala",
      ".sh",
      ".sql",
      ".swift",
      ".ts",
      ".tsx",
      ".v",
      ".vhd",
      ".xml",
      ".yaml",
      ".yml",
      ".css",
      ".html",
      ".json",
    ],
    mimeTypes: CODE_MIME_TYPES,
  },
];

const ALL_ACCEPTED_EXTENSIONS = SUBMISSION_FILE_RULES.flatMap((rule) => rule.extensions);
const ALL_ACCEPTED_MIME_TYPES = Array.from(
  new Set(SUBMISSION_FILE_RULES.flatMap((rule) => rule.mimeTypes)),
);

export const SUBMISSION_FILE_ACCEPT = [
  ...ALL_ACCEPTED_EXTENSIONS,
  ...ALL_ACCEPTED_MIME_TYPES,
].join(",");

export type SubmissionFileValidationResult =
  | {
    ok: true;
    fileType: Exclude<SubmissionFileType, "unsupported">;
    normalizedMimeType: string;
  }
  | {
    ok: false;
    failureReason: SubmissionFileValidationFailureReason;
    fileType: SubmissionFileType;
    normalizedMimeType: string;
    message: string;
  };

function normalizeMimeType(value: string | null | undefined) {
  return (value || "")
    .trim()
    .toLowerCase()
    .split(";")[0]
    .trim();
}

function normalizeFileName(value: string | null | undefined) {
  return (value || "").trim().toLowerCase();
}

function getFileExtension(fileName: string | null | undefined) {
  const normalized = normalizeFileName(fileName);
  const lastDot = normalized.lastIndexOf(".");
  if (lastDot === -1) return "";
  return normalized.slice(lastDot);
}

function getRuleForExtension(fileExtension: string) {
  return SUBMISSION_FILE_RULES.find((rule) => rule.extensions.includes(fileExtension)) ?? null;
}

function buildFailure(
  failureReason: SubmissionFileValidationFailureReason,
  fileType: SubmissionFileType,
  normalizedMimeType: string,
  message: string,
): SubmissionFileValidationResult {
  return {
    ok: false,
    failureReason,
    fileType,
    normalizedMimeType,
    message,
  };
}

function bytesToLatin1(bytes: Uint8Array) {
  return new TextDecoder("latin1").decode(bytes);
}

function isPdfHeader(bytes: Uint8Array) {
  return bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d;
}

function isDocxHeader(bytes: Uint8Array) {
  return bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

function isMimeAllowed(rule: SubmissionFileRule, mimeType: string) {
  return rule.mimeTypes.includes(mimeType);
}

export function detectSubmissionFileType(fileName: string | null | undefined) {
  const extension = getFileExtension(fileName);
  const rule = getRuleForExtension(extension);
  return rule?.fileType ?? "unsupported";
}

export function validateSubmissionFile(params: {
  fileName?: string | null;
  mimeType?: string | null;
  size?: number | null;
  bytes?: Uint8Array | null;
}): SubmissionFileValidationResult {
  const normalizedMimeType = normalizeMimeType(params.mimeType);
  const fileType = detectSubmissionFileType(params.fileName);

  if (params.size != null && params.size <= 0) {
    return buildFailure(
      "empty_file",
      fileType,
      normalizedMimeType,
      "The uploaded file is empty. Upload a readable PDF, DOCX, TXT, or supported code file.",
    );
  }

  if (params.size != null && params.size > MAX_SUBMISSION_FILE_BYTES) {
    return buildFailure(
      "file_too_large",
      fileType,
      normalizedMimeType,
      `The uploaded file is too large. Maximum file size is ${Math.round(MAX_SUBMISSION_FILE_BYTES / (1024 * 1024))}MB.`,
    );
  }

  if (fileType === "unsupported") {
    return buildFailure(
      "unsupported_submission_file",
      "unsupported",
      normalizedMimeType,
      "Unsupported file type. Upload a readable PDF, DOCX, TXT, or supported code file.",
    );
  }

  const extension = getFileExtension(params.fileName);
  const rule = getRuleForExtension(extension);
  if (!rule) {
    return buildFailure(
      "unsupported_submission_file",
      "unsupported",
      normalizedMimeType,
      "Unsupported file type. Upload a readable PDF, DOCX, TXT, or supported code file.",
    );
  }

  if (!normalizedMimeType || !isMimeAllowed(rule, normalizedMimeType)) {
    return buildFailure(
      "mime_type_mismatch",
      rule.fileType,
      normalizedMimeType,
      `The file MIME type does not match the ${rule.fileType.toUpperCase()} file extension. Please re-export the file and try again.`,
    );
  }

  if (params.bytes && params.bytes.length > 0) {
    if (rule.fileType === "pdf") {
      const preview = bytesToLatin1(params.bytes);
      if (!isPdfHeader(params.bytes)) {
        return buildFailure(
          "corrupted_pdf",
          "pdf",
          normalizedMimeType,
          "This PDF appears corrupted or incomplete. Please re-export the file and upload it again.",
        );
      }

      if (/\/Encrypt\b/i.test(preview)) {
        return buildFailure(
          "password_protected_pdf",
          "pdf",
          normalizedMimeType,
          "Password-protected PDFs cannot be graded automatically. Remove the password and upload a readable export.",
        );
      }
    }

    if (rule.fileType === "docx" && !isDocxHeader(params.bytes)) {
      return buildFailure(
        "corrupted_docx",
        "docx",
        normalizedMimeType,
        "This DOCX file appears corrupted or incomplete. Please re-export it from Word or LibreOffice and try again.",
      );
    }
  }

  return {
    ok: true,
    fileType: rule.fileType,
    normalizedMimeType,
  };
}
