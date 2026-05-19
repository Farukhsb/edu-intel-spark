import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Settings from "@/pages/dashboard/Settings";

const mocks = vi.hoisted(() => ({
  authState: {
    profile: {
      id: "lecturer-1",
      full_name: "Dr Ada Lovelace",
      email: "ada@example.com",
      role: "lecturer",
      cohort_id: "200",
      department_name: "Computer Science",
      department_id: "Computer Science",
    },
    signOut: vi.fn(),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mocks.authState,
}));

vi.mock("lucide-react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("lucide-react")>();
  const Icon = () => <svg data-testid="icon" />;

  return {
    ...actual,
    Shield: Icon,
    User: Icon,
  };
});

describe("Settings", () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders institution-managed account details and readiness information", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Settings />
      </MemoryRouter>,
    );

    expect(screen.getByText("Account Setup")).toBeInTheDocument();
    expect(screen.getByText("Teaching workflow position")).toBeInTheDocument();
    expect(
      screen.getByText("Role and department settings now control lecturer-only workflow access"),
    ).toBeInTheDocument();
    expect(screen.getByText("Your institution-managed account details")).toBeInTheDocument();
    expect(screen.getByText("Dr Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    expect(screen.getAllByText("Computer Science").length).toBeGreaterThan(0);
    expect(screen.getByText("Year 2")).toBeInTheDocument();
  });

  it("displays the admin correction and role-governance messaging", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Settings />
      </MemoryRouter>,
    );

    expect(
      screen.getByText(
        /These details are managed by your institution or platform administrator\. If your name, department, role, or level is incorrect, contact an administrator to request a correction\./i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Your role controls which academic records and workflows you can access\. For governance and security reasons, role changes are handled by an administrator\./i,
      ),
    ).toBeInTheDocument();
  });

  it("does not render self-service profile editing controls", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Settings />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("button", { name: "Save Profile" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Full name")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Department" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Level / Cohort" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Please specify your department")).not.toBeInTheDocument();
  });

  it("shows role, department, and cohort as read-only display values", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Settings />
      </MemoryRouter>,
    );

    expect(screen.getByText("Role")).toBeInTheDocument();
    expect(screen.getByText("Department")).toBeInTheDocument();
    expect(screen.getByText("Level / Cohort")).toBeInTheDocument();
    expect(screen.getByText("lecturer")).toBeInTheDocument();
    expect(screen.getAllByText("Computer Science").length).toBeGreaterThan(0);
    expect(screen.getByText("Year 2")).toBeInTheDocument();
  });

  it("calls signOut from the account action", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Settings />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign Out" }));
    expect(mocks.authState.signOut).toHaveBeenCalledTimes(1);
  });
});
