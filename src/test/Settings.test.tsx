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

const renderSettings = () =>
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Settings />
    </MemoryRouter>,
  );

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
    renderSettings();

    expect(screen.getByText("Account Setup")).toBeInTheDocument();
    expect(screen.getByText("Teaching workflow position")).toBeInTheDocument();
    expect(
      screen.getByText("Role and department settings now control lecturer-only workflow access"),
    ).toBeInTheDocument();
    expect(screen.getByText("Your institution-managed account details")).toBeInTheDocument();
    expect(screen.getByText("Dr Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    expect(screen.getAllByText("Computer Science").length).toBeGreaterThan(0);
    expect(screen.getByText("Academic Profile")).toBeInTheDocument();
  });

  it("displays the admin correction and role-governance messaging", () => {
    renderSettings();

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

  it("includes legal links for privacy and terms guidance", () => {
    renderSettings();

    expect(screen.getByRole("link", { name: "Privacy Notice" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "Terms of Service" })).toHaveAttribute("href", "/terms");
  });

  it("does not render self-service profile editing controls", () => {
    renderSettings();

    expect(screen.queryByRole("button", { name: "Save Profile" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Full name")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Department" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Level / Cohort" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Please specify your department")).not.toBeInTheDocument();
  });

  it("shows level / cohort for student profiles", () => {
    mocks.authState.profile = {
      id: "student-1",
      full_name: "Sam Student",
      email: "sam@example.com",
      role: "student",
      cohort_id: "200",
      department_name: "Computer Science",
      department_id: "Computer Science",
    };
    renderSettings();

    expect(screen.getByText("Role")).toBeInTheDocument();
    expect(screen.getByText("Department")).toBeInTheDocument();
    expect(screen.getByText("Level / Cohort")).toBeInTheDocument();
    expect(screen.getByText("student")).toBeInTheDocument();
    expect(screen.getAllByText("Computer Science").length).toBeGreaterThan(0);
    expect(screen.getByText("Year 2")).toBeInTheDocument();
  });

  it("does not show level / cohort for lecturer profiles", () => {
    mocks.authState.profile = {
      id: "lecturer-1",
      full_name: "Dr Ada Lovelace",
      email: "ada@example.com",
      role: "lecturer",
      cohort_id: "200",
      department_name: "Computer Science",
      department_id: "Computer Science",
    };
    renderSettings();

    expect(screen.queryByText("Level / Cohort")).not.toBeInTheDocument();
    expect(screen.getByText("Academic Profile")).toBeInTheDocument();
    expect(screen.getAllByText("Role").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Computer Science").length).toBeGreaterThan(0);
    expect(screen.getAllByText("lecturer").length).toBeGreaterThan(0);
  });

  it("calls signOut from the account action", () => {
    renderSettings();

    fireEvent.click(screen.getByRole("button", { name: "Sign Out" }));
    expect(mocks.authState.signOut).toHaveBeenCalledTimes(1);
  });
});
