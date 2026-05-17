import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Install from "@/pages/Install";

describe("Install", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders manual install readiness when no prompt is available", () => {
    render(<Install />);

    expect(screen.getByText("Install Readiness")).toBeInTheDocument();
    expect(screen.getByText("Manual install position")).toBeInTheDocument();
    expect(screen.getByText("This browser is not exposing the direct install prompt automatically")).toBeInTheDocument();
    expect(
      screen.getByText("Follow the device-specific install steps below to pin GradeAI for quicker return access"),
    ).toBeInTheDocument();
  });

  it("switches to direct-install readiness when the browser exposes the install prompt", () => {
    const prompt = vi.fn().mockResolvedValue(undefined);
    const preventDefault = vi.fn();

    render(<Install />);

    fireEvent(
      window,
      new Event("beforeinstallprompt", {
        bubbles: true,
        cancelable: true,
      }),
      {
        prompt,
        userChoice: Promise.resolve({ outcome: "dismissed" }),
        preventDefault,
      },
    );

    expect(screen.getByText("Ready to install position")).toBeInTheDocument();
    expect(
      screen.getByText("This browser session supports a direct install prompt, but it still depends on your confirmation"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Use the install action now to add GradeAI as a faster entry point for future workflow access"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Install App" })).toBeInTheDocument();
  });
});
