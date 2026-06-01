import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import DemoStudentProfile from "@/pages/dashboard/DemoStudentProfile";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
  },
}));

describe("StudentProfile demo route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the demo-only student profile on the demo route", async () => {
    render(
      <MemoryRouter initialEntries={["/demo/dashboard/student/demo-student"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/demo/dashboard/student/:studentId" element={<DemoStudentProfile />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Viewing demo student support profile")).toBeInTheDocument();
    expect(screen.getByText("David Lee")).toBeInTheDocument();
    expect(screen.getByText("Support Priorities")).toBeInTheDocument();
    expect(screen.getByText("Recent Grades Trend")).toBeInTheDocument();
  });
});
