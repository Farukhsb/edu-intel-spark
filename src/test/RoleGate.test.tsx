import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  role: "lecturer" as "lecturer" | "admin" | "student",
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    role: mocks.role,
  }),
}));

import { RoleGate } from "@/App";

describe("RoleGate", () => {
  afterEach(() => {
    cleanup();
    mocks.role = "lecturer";
  });

  it.each([
    ["/dashboard/institutional", "Institutional Insights"],
    ["/dashboard/accreditation", "Accreditation"],
    ["/dashboard/external-examiner", "External Examiner"],
  ])("redirects lecturers away from %s", async (path, label) => {
    render(
      <MemoryRouter
        initialEntries={[path]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route
            path="/dashboard/institutional"
            element={
              <RoleGate allowedRole="admin">
                <div>Institutional Insights</div>
              </RoleGate>
            }
          />
          <Route
            path="/dashboard/accreditation"
            element={
              <RoleGate allowedRole="admin">
                <div>Accreditation</div>
              </RoleGate>
            }
          />
          <Route
            path="/dashboard/external-examiner"
            element={
              <RoleGate allowedRole="admin">
                <div>External Examiner</div>
              </RoleGate>
            }
          />
          <Route path="/dashboard" element={<div>Dashboard Home</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Dashboard Home")).toBeInTheDocument();
    expect(screen.queryByText(label)).not.toBeInTheDocument();
  });

  it("allows admins into all admin-only reporting routes", async () => {
    mocks.role = "admin";

    render(
      <MemoryRouter
        initialEntries={["/dashboard/external-examiner"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route
            path="/dashboard/institutional"
            element={
              <RoleGate allowedRole="admin">
                <div>Institutional Insights</div>
              </RoleGate>
            }
          />
          <Route
            path="/dashboard/accreditation"
            element={
              <RoleGate allowedRole="admin">
                <div>Accreditation</div>
              </RoleGate>
            }
          />
          <Route
            path="/dashboard/external-examiner"
            element={
              <RoleGate allowedRole="admin">
                <div>External Examiner</div>
              </RoleGate>
            }
          />
          <Route path="/dashboard" element={<div>Dashboard Home</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("External Examiner")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard Home")).not.toBeInTheDocument();
  });
});
