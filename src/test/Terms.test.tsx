import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import Terms from "@/pages/Terms";

describe("Terms", () => {
  it("shows the pilot-stage decision-support and warranty wording", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Terms />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Terms of service" })).toBeInTheDocument();
    expect(screen.getByText("Controlled pilot use")).toBeInTheDocument();
    expect(
      screen.getByText(/AI grading, integrity signals, feedback drafting, and student-support insights are decision-support tools/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Pilot-stage warranty position")).toBeInTheDocument();
  });
});
