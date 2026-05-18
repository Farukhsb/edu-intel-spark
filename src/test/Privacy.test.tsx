import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import Privacy from "@/pages/Privacy";

describe("Privacy", () => {
  it("shows the pilot data retention note", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Privacy />
      </MemoryRouter>,
    );

    expect(screen.getByText("Pilot data retention note")).toBeInTheDocument();
    expect(
      screen.getByText(/Academic records, submissions, grades, workflow history, and audit data should not be kept indefinitely by default/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Retention and deletion periods should be agreed with the institution responsible for the pilot before live use/i),
    ).toBeInTheDocument();
  });
});
