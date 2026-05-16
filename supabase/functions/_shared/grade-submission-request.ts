import { z } from "npm:zod";

export interface GradeSubmissionRequestPayload {
  submissionIds?: string[];
  submissionId?: string;
  assignmentId?: string;
  force_regenerate?: boolean;
}

const GradeSubmissionRequestSchema = z
  .object({
    submissionIds: z.array(z.string().uuid()).max(50).optional(),
    submissionId: z.string().uuid().optional(),
    assignmentId: z.string().uuid().optional(),
    force_regenerate: z.boolean().optional(),
  })
  .refine((value) => Boolean(value.submissionId) || Boolean(value.submissionIds?.length), {
    message: "At least one of submissionId or submissionIds is required",
    path: ["submissionIds"],
  });

const extractSubmissionIds = (body: unknown) => {
  if (!body || typeof body !== "object") {
    return undefined;
  }

  const candidate = body as { submissionIds?: unknown; submissions?: unknown };

  if (Array.isArray(candidate.submissionIds)) {
    return candidate.submissionIds.filter((item): item is string => typeof item === "string");
  }

  if (Array.isArray(candidate.submissions)) {
    return candidate.submissions
      .map((submission) =>
        typeof submission === "string"
          ? submission
          : submission &&
              typeof submission === "object" &&
              "id" in submission &&
              typeof (submission as { id?: unknown }).id === "string"
            ? (submission as { id: string }).id
            : null,
      )
      .filter((item): item is string => Boolean(item));
  }

  return undefined;
};

export const parseGradeSubmissionRequestPayload = (body: unknown) =>
  GradeSubmissionRequestSchema.safeParse({
    submissionIds: extractSubmissionIds(body),
    submissionId:
      body &&
      typeof body === "object" &&
      "submissionId" in body &&
      typeof (body as { submissionId?: unknown }).submissionId === "string"
        ? (body as { submissionId: string }).submissionId
        : undefined,
    assignmentId:
      body &&
      typeof body === "object" &&
      "assignmentId" in body &&
      typeof (body as { assignmentId?: unknown }).assignmentId === "string"
        ? (body as { assignmentId: string }).assignmentId
        : body &&
            typeof body === "object" &&
            "assignment" in body &&
            (body as { assignment?: unknown }).assignment &&
            typeof (body as { assignment?: unknown }).assignment === "object" &&
            "id" in ((body as { assignment: { id?: unknown } }).assignment) &&
            typeof (body as { assignment: { id?: unknown } }).assignment.id === "string"
          ? (body as { assignment: { id: string } }).assignment.id
          : undefined,
    force_regenerate:
      body &&
      typeof body === "object" &&
      "force_regenerate" in body &&
      typeof (body as { force_regenerate?: unknown }).force_regenerate === "boolean"
        ? (body as { force_regenerate: boolean }).force_regenerate
        : undefined,
  });
