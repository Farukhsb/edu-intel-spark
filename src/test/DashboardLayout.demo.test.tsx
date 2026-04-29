import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authState: {
    profile: {
      id: "demo-lecturer",
      full_name: "Dr. Demo Lecturer",
      email: "demo@gradeai.com",
      role: "lecturer",
    },
    user: {
      id: "demo-lecturer",
      email: "demo@gradeai.com",
    },
    signOut: vi.fn(),
    isDemo: true,
  },
  communications: {
    clearCommunicationMessage: vi.fn(),
    loadVisibleCommunicationMessages: vi.fn(),
    markCommunicationMessageRead: vi.fn(),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mocks.authState,
}));

vi.mock("@/lib/communications", () => ({
  clearCommunicationMessage: mocks.communications.clearCommunicationMessage,
  loadVisibleCommunicationMessages: mocks.communications.loadVisibleCommunicationMessages,
  markCommunicationMessageRead: mocks.communications.markCommunicationMessageRead,
}));

describe("DashboardLayout demo mode", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("uses synthetic notifications and does not load live communication records in demo mode", async () => {
    const { DashboardLayout } = await import("@/components/DashboardLayout");

    render(
      <MemoryRouter initialEntries={["/dashboard"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <DashboardLayout>
          <div>Demo child</div>
        </DashboardLayout>
      </MemoryRouter>,
    );

    expect(await screen.findAllByText("Demo")).not.toHaveLength(0);
    expect(screen.getByText("Demo child")).toBeInTheDocument();
    expect(mocks.communications.loadVisibleCommunicationMessages).not.toHaveBeenCalled();
    expect(mocks.communications.markCommunicationMessageRead).not.toHaveBeenCalled();
    expect(mocks.communications.clearCommunicationMessage).not.toHaveBeenCalled();
  });
});
