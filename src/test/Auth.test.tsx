import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import Auth from "@/pages/Auth";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  toast: vi.fn(),
  authState: {
    signIn: vi.fn(),
    signUp: vi.fn(),
    resetPassword: vi.fn(),
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

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

describe("Auth", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders the sign-in access readiness framing", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Auth />
      </MemoryRouter>,
    );

    expect(screen.getByText("Access Readiness")).toBeInTheDocument();
    expect(screen.getByText("Workspace access position")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Your sign-in details control whether you enter the correct lecturer, student, or admin workflow",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Use your institutional account or create one so the platform can route you into the right workspace",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Sign In" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Sign Up" })).toBeInTheDocument();
  });

  it("switches to recovery readiness when forgot password is opened", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Auth />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));

    expect(screen.getByText("Account recovery position")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Password recovery needs the same institutional email identity used for your academic workflow",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Submit your account email and return through the reset link to regain dashboard access",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /back to login/i })).toBeInTheDocument();
  });
});
