import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppErrorBoundary } from "@/components/AppErrorBoundary";

const ThrowOnRender = ({ message = "boom" }: { message?: string }) => {
  throw new Error(message);
};

describe("AppErrorBoundary", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("catches a child render error and shows safe fallback UI", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <AppErrorBoundary>
        <ThrowOnRender />
      </AppErrorBoundary>
    );

    expect(screen.getByText("This page failed to load")).toBeInTheDocument();
    expect(screen.getByText("A runtime error interrupted this page. Reload and try again.")).toBeInTheDocument();
    expect(screen.getByText("Runtime details are hidden to protect sensitive data.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try Again" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload Page" })).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalled();
  });

  it("does not expose stack traces or sensitive runtime details in the fallback", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <AppErrorBoundary>
        <ThrowOnRender message={"secret-token-123\n    at InternalStack"} />
      </AppErrorBoundary>
    );

    expect(screen.queryByText(/secret-token-123/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/InternalStack/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Unknown runtime error/i)).not.toBeInTheDocument();
    expect(consoleError).toHaveBeenCalled();
  });

  it("renders safely again when the reset key changes after an error", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { rerender } = render(
      <AppErrorBoundary resetKey="error">
        <ThrowOnRender />
      </AppErrorBoundary>
    );

    expect(screen.getByText("This page failed to load")).toBeInTheDocument();

    rerender(
      <AppErrorBoundary resetKey="recovered">
        <div>Recovered content</div>
      </AppErrorBoundary>
    );

    expect(screen.getByText("Recovered content")).toBeInTheDocument();
    expect(screen.queryByText("This page failed to load")).not.toBeInTheDocument();
    expect(consoleError).toHaveBeenCalled();
  });

  it("renders retry and reload actions safely after a failure", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <AppErrorBoundary>
        <ThrowOnRender />
      </AppErrorBoundary>
    );

    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));

    expect(screen.getByText("This page failed to load")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload Page" })).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalled();
  });
});
