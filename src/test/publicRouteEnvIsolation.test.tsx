import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  getEnv: () => {
    throw new Error("Invalid environment configuration: VITE_SUPABASE_URL");
  },
}));

const authState = vi.hoisted(() => ({
  enterDemo: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");

  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

import Demo from "@/pages/Demo";
import Index from "@/pages/Index";
import Privacy from "@/pages/Privacy";
import Terms from "@/pages/Terms";

describe("public route env isolation", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders the public, demo, and legal pages without the full Supabase env proxy", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Index />
        <Privacy />
        <Terms />
        <Demo />
      </MemoryRouter>,
    );

    expect(screen.getByText("Platform Readiness")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Privacy notice" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Terms of service" })).toBeInTheDocument();
    expect(screen.getByText("Choose a demo workspace")).toBeInTheDocument();
  });
});
