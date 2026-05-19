import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    updateProfile: vi.fn().mockResolvedValue(undefined),
  },
  toast: vi.fn(),
  logger: {
    error: vi.fn(),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mocks.authState,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: mocks.toast,
  }),
}));

vi.mock("@/lib/logger", () => ({
  log: mocks.logger,
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

  it("calls updateProfile from the save action", async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Settings />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Full name"), {
      target: { value: "Professor Ada Lovelace" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Profile" }));

    await waitFor(() => {
      expect(mocks.authState.updateProfile).toHaveBeenCalledWith({
        fullName: "Professor Ada Lovelace",
        departmentName: "Computer Science",
        cohortId: null,
      });
    });
  });

  it("shows a custom department input for Other and saves the specified value", async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Settings />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("combobox", { name: "Department" }));
    fireEvent.click(await screen.findByRole("option", { name: "Other" }));
    fireEvent.change(await screen.findByLabelText("Please specify your department"), {
      target: { value: "Architecture" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Profile" }));

    await waitFor(() => {
      expect(mocks.authState.updateProfile).toHaveBeenCalledWith({
        fullName: "Dr Ada Lovelace",
        departmentName: "Architecture",
        cohortId: null,
      });
    });
  });

  it("disables save and cancel controls while the profile update is in flight", async () => {
    let resolveUpdate: (() => void) | null = null;
    mocks.authState.updateProfile.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveUpdate = resolve;
        }),
    );

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Settings />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save Profile" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    });

    resolveUpdate?.();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Save Profile" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
    });
  });

  it("shows a stable error message and logs context when profile save fails", async () => {
    const error = new Error("new row violates row-level security policy");
    mocks.authState.updateProfile.mockRejectedValueOnce(error);

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Settings />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save Profile" }));

    await waitFor(() => {
      expect(mocks.toast).toHaveBeenCalledWith({
        title: "Profile update failed",
        description: "Your changes could not be saved. Please check your connection and try again.",
        variant: "destructive",
      });
    });

    expect(mocks.logger.error).toHaveBeenCalledWith("Failed to update profile settings", error, {
      userId: "lecturer-1",
    });
  });
});
