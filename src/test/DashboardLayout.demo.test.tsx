import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
  navigate: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mocks.authState,
}));

vi.mock("@/lib/communications", () => ({
  clearCommunicationMessage: mocks.communications.clearCommunicationMessage,
  loadVisibleCommunicationMessages: mocks.communications.loadVisibleCommunicationMessages,
  markCommunicationMessageRead: mocks.communications.markCommunicationMessageRead,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

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
    expect(screen.getAllByText("Core").length).toBeGreaterThan(0);
    expect(screen.getByText("Overview sits in daily teaching workflow.")).toBeInTheDocument();
    expect(mocks.communications.loadVisibleCommunicationMessages).not.toHaveBeenCalled();
    expect(mocks.communications.markCommunicationMessageRead).not.toHaveBeenCalled();
    expect(mocks.communications.clearCommunicationMessage).not.toHaveBeenCalled();
  });

  it("shows lecturer workflow hints in demo lecturer mode", async () => {
    mocks.authState.profile = {
      id: "demo-lecturer",
      full_name: "Dr. Demo Lecturer",
      email: "demo@gradeai.com",
      role: "lecturer",
    };
    mocks.authState.user = {
      id: "demo-lecturer",
      email: "demo@gradeai.com",
    };

    const { DashboardLayout } = await import("@/components/DashboardLayout");

    render(
      <MemoryRouter initialEntries={["/dashboard"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <DashboardLayout>
          <div>Lecturer child</div>
        </DashboardLayout>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open notifications" }));

    expect(await screen.findByText("Submission")).toBeInTheDocument();
    expect(
      screen.getAllByText("A newer workflow update exists. Opens the latest release-follow-up state.").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("Integrity")).toBeInTheDocument();
    expect(screen.getByText("Released result")).toBeInTheDocument();
    expect(mocks.communications.loadVisibleCommunicationMessages).not.toHaveBeenCalled();
  });

  it("routes an older lecturer workflow notice into the latest assignment stage for that assignment", async () => {
    mocks.authState.profile = {
      id: "demo-lecturer",
      full_name: "Dr. Demo Lecturer",
      email: "demo@gradeai.com",
      role: "lecturer",
    };
    mocks.authState.user = {
      id: "demo-lecturer",
      email: "demo@gradeai.com",
    };

    const { DashboardLayout } = await import("@/components/DashboardLayout");

    render(
      <MemoryRouter initialEntries={["/dashboard"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <DashboardLayout>
          <div>Lecturer child</div>
        </DashboardLayout>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open notifications" }));
    fireEvent.click(await screen.findByRole("button", { name: /Synthetic AI grading ready/i }));

    expect(mocks.navigate).toHaveBeenCalledWith(
      "/dashboard/assignments/demo-assignment-policy-brief?source=notification&focus=release-follow-up",
      expect.objectContaining({
        state: expect.objectContaining({
          redirectedFromNotification: expect.objectContaining({
            subject: "Synthetic AI grading ready",
          }),
        }),
      }),
    );
  });

  it("shows student-focused notification preview hints in demo student mode", async () => {
    mocks.authState.profile = {
      id: "demo-student",
      full_name: "Demo Student",
      email: "student@gradeai.com",
      role: "student",
    };
    mocks.authState.user = {
      id: "demo-student",
      email: "student@gradeai.com",
    };

    const { DashboardLayout } = await import("@/components/DashboardLayout");

    render(
      <MemoryRouter initialEntries={["/dashboard/explain-grade"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <DashboardLayout>
          <div>Student child</div>
        </DashboardLayout>
      </MemoryRouter>,
    );

    expect(screen.getAllByText("Student workspace").length).toBeGreaterThan(0);
    expect(
      screen.getByText("Use this area to review results, assignments, and your next support actions."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open notifications" }));

    expect(await screen.findByText("Released result")).toBeInTheDocument();
    expect(screen.getByText("Opens your released result and grade explanation.")).toBeInTheDocument();
    expect(screen.getByText("Support")).toBeInTheDocument();
    expect(screen.getByText("Opens your improvement plan.")).toBeInTheDocument();
    expect(mocks.communications.loadVisibleCommunicationMessages).not.toHaveBeenCalled();
  });

  it("routes an older support notice into the newer released-result workflow in demo student mode", async () => {
    mocks.authState.profile = {
      id: "demo-student",
      full_name: "Demo Student",
      email: "student@gradeai.com",
      role: "student",
    };
    mocks.authState.user = {
      id: "demo-student",
      email: "student@gradeai.com",
    };

    const { DashboardLayout } = await import("@/components/DashboardLayout");

    render(
      <MemoryRouter initialEntries={["/dashboard"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <DashboardLayout>
          <div>Student child</div>
        </DashboardLayout>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open notifications" }));
    fireEvent.click(await screen.findByRole("button", { name: /Study plan reminder/i }));

    expect(mocks.navigate).toHaveBeenCalledWith(
      "/dashboard/explain-grade?assignment=demo-assignment-1&source=support-notification",
      expect.objectContaining({
        state: expect.objectContaining({
          redirectedFromSupportNotification: expect.objectContaining({
            subject: "Study plan reminder",
          }),
        }),
      }),
    );
  });
});
