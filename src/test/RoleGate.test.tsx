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

  it("denies students access to lecturer-only moderation routes", async () => {
    mocks.role = "student";

    render(
      <MemoryRouter
        initialEntries={["/dashboard/moderation"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route
            path="/dashboard/moderation"
            element={
              <RoleGate allowedRole="lecturer">
                <div>Moderation</div>
              </RoleGate>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("You don't have access to this area.")).toBeInTheDocument();
    expect(screen.queryByText("Moderation")).not.toBeInTheDocument();
  });

  it("denies lecturers access to admin-only accreditation routes", async () => {
    render(
      <MemoryRouter
        initialEntries={["/dashboard/accreditation"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route
            path="/dashboard/accreditation"
            element={
              <RoleGate allowedRole="admin">
                <div>Accreditation</div>
              </RoleGate>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("You don't have access to this area.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to dashboard" })).toHaveAttribute("href", "/dashboard");
    expect(screen.queryByText("Accreditation")).not.toBeInTheDocument();
  });

  it("allows admins into admin-only institutional routes", async () => {
    mocks.role = "admin";

    render(
      <MemoryRouter
        initialEntries={["/dashboard/institutional"]}
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
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Institutional Insights")).toBeInTheDocument();
    expect(screen.queryByText("You don't have access to this area.")).not.toBeInTheDocument();
  });

  it("allows lecturer-equivalent admin roles into lecturer-only routes", async () => {
    mocks.role = "admin";

    render(
      <MemoryRouter
        initialEntries={["/dashboard/moderation"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route
            path="/dashboard/moderation"
            element={
              <RoleGate allowedRole="lecturer">
                <div>Moderation</div>
              </RoleGate>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Moderation")).toBeInTheDocument();
    expect(screen.queryByText("You don't have access to this area.")).not.toBeInTheDocument();
  });
});
