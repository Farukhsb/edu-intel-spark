import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import Settings from "@/pages/dashboard/Settings";

const mocks = vi.hoisted(() => ({
  authState: {
    profile: {
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

vi.mock("lucide-react", () => {
  const Icon = () => <svg data-testid="icon" />;

  return {
    Shield: Icon,
    User: Icon,
  };
});

describe("Settings", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders account readiness and profile information", () => {
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
    expect(
      screen.getByText("Check that your account details still match the teaching context you need to manage"),
    ).toBeInTheDocument();
    expect(screen.getByText("Dr Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    expect(screen.getByText("Computer Science")).toBeInTheDocument();
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
