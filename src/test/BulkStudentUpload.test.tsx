import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BulkStudentUpload } from "@/components/BulkStudentUpload";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  from: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: mocks.invoke,
    },
    from: mocks.from,
  },
}));

vi.mock("@/lib/env", () => ({
  env: {
    VITE_SUPABASE_PROJECT_ID: "test-project",
  },
}));

vi.mock("@/lib/logger", () => ({
  log: {
    error: mocks.logError,
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
  },
}));

class MockFileReader {
  onload: ((event: { target: { result: string } }) => void) | null = null;

  readAsText(_file: Blob) {
    this.onload?.({
      target: {
        result: "name,email,cohort,department\nGodwin,geeekpo111@gmail.com,200,Computer Science",
      },
    });
  }
}

describe("BulkStudentUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("FileReader", MockFileReader);
    mocks.invoke.mockResolvedValue({
      data: {
        results: [
          {
            name: "Godwin",
            email: "geeekpo111@gmail.com",
            success: true,
            invite_sent: true,
            verified_profile: {
              email: "geeekpo111@gmail.com",
              full_name: "Godwin",
              cohort_id: "200",
              department_id: "Computer Science",
              must_change_password: true,
            },
          },
        ],
      },
      error: null,
      response: undefined,
    });
  });

  it("renders password-change verification from the function response without re-querying profiles", async () => {
    render(<BulkStudentUpload />);

    fireEvent.click(screen.getByRole("button", { name: "Bulk Upload Students" }));

    const input = document.querySelector('input[type="file"]');
    expect(input).not.toBeNull();

    fireEvent.change(input as HTMLInputElement, {
      target: {
        files: [new File(["csv"], "students.csv", { type: "text/csv" })],
      },
    });

    expect(await screen.findByText("Godwin")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Create 1 Student Account" }));

    await waitFor(() => {
      expect(mocks.invoke).toHaveBeenCalledWith("bulk-create-students", {
        body: {
          students: [
            {
              name: "Godwin",
              email: "geeekpo111@gmail.com",
              cohort_id: "200",
              department_id: "Computer Science",
            },
          ],
        },
      });
    });

    expect(await screen.findByText("Verified student profiles")).toBeInTheDocument();
    expect(screen.getByText("Password setup required")).toBeInTheDocument();
    expect(screen.getByText("Invite requested")).toBeInTheDocument();
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
