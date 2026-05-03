import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import NotFound from "@/pages/NotFound";

const mocks = vi.hoisted(() => ({
  warn: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  log: {
    warn: mocks.warn,
  },
}));

describe("NotFound", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders the route-recovery framing and logs the missing path", () => {
    render(
      <MemoryRouter initialEntries={["/missing-route"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <NotFound />
      </MemoryRouter>,
    );

    expect(screen.getByText("Route Readiness")).toBeInTheDocument();
    expect(screen.getByText("Route recovery position")).toBeInTheDocument();
    expect(
      screen.getByText("The page you tried to open is outside the current workflow or no longer exists at this route"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Return to the main workspace entry and continue from the correct dashboard or public landing page"),
    ).toBeInTheDocument();
    expect(screen.getByText("404")).toBeInTheDocument();
    expect(mocks.warn).toHaveBeenCalledWith("404 route accessed", { pathname: "/missing-route" });
  });
});
