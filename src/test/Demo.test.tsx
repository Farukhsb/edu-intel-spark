import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import Demo from "@/pages/Demo";

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

describe("Demo", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders the dedicated demo entry page", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Demo />
      </MemoryRouter>,
    );

    expect(screen.getByText("Choose a demo workspace")).toBeInTheDocument();
    expect(screen.getByText("Staff Demo")).toBeInTheDocument();
    expect(screen.getByText("Synthetic Test View")).toBeInTheDocument();
  });

  it("enters demo mode from the dedicated demo page", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Demo />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /open staff demo/i }));

    expect(mocks.authState.enterDemo).toHaveBeenCalledWith("lecturer");
    expect(mocks.navigate).toHaveBeenCalledWith("/demo/dashboard");
  });
});
