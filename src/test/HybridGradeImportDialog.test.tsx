import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HybridGradeImportDialog } from "@/components/dashboard/HybridGradeImportDialog";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: mocks.invoke,
    },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
  },
}));

vi.mock("@/lib/hybridImport", () => ({
  isHybridGradeImportEnabled: () => true,
  getHybridGradeImportTemplateHref: () => "/grade-import-template.csv",
}));

describe("HybridGradeImportDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("previews and confirms CSV imports", async () => {
    mocks.invoke
      .mockResolvedValueOnce({
        data: {
          success: true,
          committed: false,
          assignmentId: "assignment-1",
          importMethod: "csv",
          summary: {
            rowsProcessed: 1,
            rowsAccepted: 1,
            rowsRejected: 0,
            matchedExistingSubmissions: 1,
            createdSyntheticSubmissions: 0,
            rowsWithWarnings: 0,
          },
          rows: [
            {
              rowNumber: 2,
              studentName: "Jane Doe",
              studentEmail: "jane@example.edu",
              score: 18,
              maxScore: 20,
              submissionDate: "2026-05-15",
              notes: "Great work",
              normalizedScore: 90,
              matchedSubmissionId: "submission-1",
              submissionAction: "match",
              accepted: true,
              issues: [],
            },
          ],
          rejectedRows: [],
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          success: true,
          committed: true,
          importId: "import-1",
          assignmentId: "assignment-1",
          importMethod: "csv",
          summary: {
            rowsProcessed: 1,
            rowsAccepted: 1,
            rowsRejected: 0,
            matchedExistingSubmissions: 1,
            createdSyntheticSubmissions: 0,
            rowsWithWarnings: 0,
          },
          rows: [],
          rejectedRows: [],
        },
        error: null,
      });

    render(
      <HybridGradeImportDialog
        assignments={[
          {
            id: "assignment-1",
            title: "Essay 1",
            module_code: "ENG101",
            max_score: 20,
            due_date: "2026-05-15",
            status: "published",
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Import Grades" }));
    await waitFor(() => {
      expect(document.getElementById("hybrid-grade-import-csv-text")).not.toBeNull();
    });
    const csvInput = document.getElementById("hybrid-grade-import-csv-text") as HTMLTextAreaElement;
    fireEvent.change(csvInput, {
      target: {
        value: "student_name,student_email,score,max_score,submission_date,notes\nJane Doe,jane@example.edu,18,20,2026-05-15,Great work",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: /Preview import/i }));

    await waitFor(() => {
      expect(mocks.invoke).toHaveBeenNthCalledWith(
        1,
        "import-grades",
        expect.objectContaining({
          body: expect.objectContaining({
            assignmentId: "assignment-1",
            confirm: false,
            importMethod: "csv",
            csvText: expect.stringContaining("Jane Doe"),
          }),
        }),
      );
    });

    expect(await screen.findByText("Jane Doe")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Import 1 grade/i }));

    await waitFor(() => {
      expect(mocks.invoke).toHaveBeenNthCalledWith(
        2,
        "import-grades",
        expect.objectContaining({
          body: expect.objectContaining({
            assignmentId: "assignment-1",
            confirm: true,
            importMethod: "csv",
            csvText: expect.stringContaining("Jane Doe"),
          }),
        }),
      );
    });

    expect(await screen.findByText("Import completed")).toBeInTheDocument();
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Grade import completed.");
  });

  it("sends image files through the photo path", async () => {
    mocks.invoke.mockResolvedValueOnce({
      data: {
        success: true,
        committed: false,
        assignmentId: "assignment-1",
        importMethod: "image",
        summary: {
          rowsProcessed: 1,
          rowsAccepted: 1,
          rowsRejected: 0,
          matchedExistingSubmissions: 1,
          createdSyntheticSubmissions: 0,
          rowsWithWarnings: 1,
        },
        rows: [
          {
            rowNumber: 1,
            studentName: "Jane Doe",
            studentEmail: "jane@example.edu",
            score: 18,
            maxScore: 20,
            submissionDate: null,
            notes: null,
            normalizedScore: 90,
            matchedSubmissionId: "submission-1",
            submissionAction: "match",
            accepted: true,
            issues: [],
          },
        ],
        rejectedRows: [],
      },
      error: null,
    });

    render(
      <HybridGradeImportDialog
        defaultMode="image"
        assignments={[
          {
            id: "assignment-1",
            title: "Essay 1",
            module_code: "ENG101",
            max_score: 20,
            due_date: "2026-05-15",
            status: "published",
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Import Grades" }));

    await waitFor(() => {
      expect(document.getElementById("hybrid-grade-import-image-file")).not.toBeNull();
    });
    const input = document.getElementById("hybrid-grade-import-image-file") as HTMLInputElement;

    fireEvent.change(input, {
      target: {
        files: [new File(["image"], "grades.png", { type: "image/png" })],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: /Preview import/i }));

    await waitFor(() => {
      expect(mocks.invoke).toHaveBeenCalledWith(
        "import-grades",
        expect.objectContaining({
          body: expect.any(FormData),
        }),
      );
    });

    const [, invocation] = mocks.invoke.mock.calls[0];
    const body = invocation.body as FormData;
    expect(body.get("assignmentId")).toBe("assignment-1");
    expect(body.get("confirm")).toBe("false");
    expect(body.getAll("file")).toHaveLength(1);
  });
});
