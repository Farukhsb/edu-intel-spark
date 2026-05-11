import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import ForcePasswordChange from "@/pages/ForcePasswordChange";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  toast: vi.fn(),
  authState: {
    mustChangePassword: true,
    completePasswordChange: vi.fn(),
    signOut: vi.fn(),
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

describe("ForcePasswordChange", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.authState.mustChangePassword = true;
  });

  it("submits the new password and returns the user to the dashboard", async () => {
    mocks.authState.completePasswordChange.mockResolvedValue(undefined);

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ForcePasswordChange />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "Sup3rSecure!" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "Sup3rSecure!" } });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() => {
      expect(mocks.authState.completePasswordChange).toHaveBeenCalledWith("Sup3rSecure!");
    });
    expect(mocks.navigate).toHaveBeenCalledWith("/dashboard", { replace: true });
  });

  it("blocks mismatched passwords before calling the auth layer", async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ForcePasswordChange />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "Sup3rSecure!" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "Mismatch123!" } });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() => {
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Passwords do not match",
          variant: "destructive",
        }),
      );
    });
    expect(mocks.authState.completePasswordChange).not.toHaveBeenCalled();
  });
});
