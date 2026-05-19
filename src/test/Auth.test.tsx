import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Auth from "@/pages/Auth";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  toast: vi.fn(),
  authState: {
    signIn: vi.fn(),
    signUp: vi.fn(),
    resetPassword: vi.fn(),
    resendVerification: vi.fn(),
    pendingVerificationEmail: null as string | null,
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
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.authState.pendingVerificationEmail = null;
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

  it("includes a link to the privacy notice", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Auth />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: /read the privacy notice/i })).toHaveAttribute("href", "/privacy");
  });

  it("switches to recovery readiness when forgot password is opened", async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Auth />
      </MemoryRouter>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    });

    expect(await screen.findByText("Account recovery position")).toBeInTheDocument();
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

  it("shows pending verification messaging and resends the verification email", async () => {
    mocks.authState.pendingVerificationEmail = "lecturer@example.edu";

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Auth />
      </MemoryRouter>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("tab", { name: "Sign Up" }));
    });

    expect(await screen.findByText("Email confirmation pending")).toBeInTheDocument();
    expect(screen.getByText(/lecturer@example\.edu/)).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Resend verification email" }));
    });

    await waitFor(() => {
      expect(mocks.authState.resendVerification).toHaveBeenCalledTimes(1);
    });
  });

  it("shows a custom department input for Other and submits the specified value", async () => {
    mocks.authState.pendingVerificationEmail = "student@example.com";

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Auth />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Create account")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Full Name *"), {
      target: { value: "Student Ada" },
    });
    fireEvent.change(screen.getByLabelText("Email *"), {
      target: { value: "student@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password * (min 8 characters)"), {
      target: { value: "StrongPass123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "student" }));
    fireEvent.click(screen.getAllByRole("combobox")[0]);
    fireEvent.click(await screen.findByRole("option", { name: "Other" }));
    fireEvent.change(await screen.findByLabelText("Please specify your department"), {
      target: { value: "Architecture" },
    });
    fireEvent.click(screen.getAllByRole("combobox")[1]);
    fireEvent.click(await screen.findByRole("option", { name: "Year 1 (Level 4)" }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Create Account" }));
    });

    await waitFor(() => {
      expect(mocks.authState.signUp).toHaveBeenCalledWith(
        "student@example.com",
        "StrongPass123!",
        "Student Ada",
        "student",
        "year1",
        "Architecture",
      );
    });
  });
});
