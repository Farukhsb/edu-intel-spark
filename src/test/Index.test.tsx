import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import Index from "@/pages/Index";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  authState: {
    enterDemo: vi.fn(),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mocks.authState,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

describe("Index", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders the public readiness framing and demo entry points", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Index />
      </MemoryRouter>,
    );

    expect(screen.getByText("Platform Readiness")).toBeInTheDocument();
    expect(screen.getByText("Production-style academic workflow")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Assessment teams need one platform that covers marking, integrity, moderation, and reporting without fragmented tools",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Open the demo or sign in to see the full workflow from released results to institutional oversight",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Lecturer Demo")).toBeInTheDocument();
    expect(screen.getByText("Student Demo")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /privacy notice/i })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: /terms of service/i })).toHaveAttribute("href", "/terms");
  });

  it("enters lecturer demo mode from the landing page", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Index />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Try Demo" }));

    expect(mocks.authState.enterDemo).toHaveBeenCalledWith("lecturer");
    expect(mocks.navigate).toHaveBeenCalledWith("/dashboard");
  });
});
