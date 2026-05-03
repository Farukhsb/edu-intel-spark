import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  toast: vi.fn(),
  auth: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: mocks.toast,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      ...mocks.auth,
      exchangeCodeForSession: vi.fn(),
      verifyOtp: vi.fn(),
      setSession: vi.fn(),
      updateUser: vi.fn(),
    },
  },
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

describe("ResetPassword", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    window.history.replaceState({}, document.title, "/reset-password");
  });

  it("renders verification readiness before the recovery link is resolved", async () => {
    mocks.auth.onAuthStateChange.mockReturnValue({
      data: {
        subscription: {
          unsubscribe: vi.fn(),
        },
      },
    });
    mocks.auth.getSession.mockReturnValue(new Promise(() => {}));

    const { default: ResetPassword } = await import("@/pages/ResetPassword");

    render(
      <MemoryRouter initialEntries={["/reset-password"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ResetPassword />
      </MemoryRouter>,
    );

    expect(screen.getByText("Recovery Readiness")).toBeInTheDocument();
    expect(screen.getByText("Recovery verification position")).toBeInTheDocument();
    expect(
      screen.getByText(
        "The reset link must still hold a valid recovery session before a new password can be accepted",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Wait for the recovery link check to complete before entering a new password"),
    ).toBeInTheDocument();
    expect(screen.getByText("Verifying your reset link...")).toBeInTheDocument();
  });

  it("renders invalid-link recovery guidance when the reset session cannot be restored", async () => {
    mocks.auth.onAuthStateChange.mockReturnValue({
      data: {
        subscription: {
          unsubscribe: vi.fn(),
        },
      },
    });
    mocks.auth.getSession.mockResolvedValue({ data: { session: null } });
    window.history.replaceState({}, document.title, "/reset-password?type=recovery&error_code=otp_expired");

    const { default: ResetPassword } = await import("@/pages/ResetPassword");

    render(
      <MemoryRouter
        initialEntries={["/reset-password?type=recovery&error_code=otp_expired"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <ResetPassword />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Recovery link failure position")).toBeInTheDocument();
    expect(
      screen.getByText("Expired or pre-consumed reset links stop the final password update step"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Request a fresh reset email and open only the latest recovery link in your browser"),
    ).toBeInTheDocument();
    expect(screen.getByText("Invalid or expired link")).toBeInTheDocument();
  });
});
