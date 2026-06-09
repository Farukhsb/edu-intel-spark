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
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  const clickNotificationsButton = () => {
    fireEvent.click(screen.getAllByRole("button", { name: "Open notifications" })[0]);
  };

  it("uses synthetic notifications and does not load live communication records in demo mode", async () => {
    const { DemoDashboardLayout } = await import("@/components/DemoDashboardLayout");

    render(
      <MemoryRouter initialEntries={["/dashboard"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <DemoDashboardLayout>
          <div>Demo child</div>
        </DemoDashboardLayout>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Demo Mode")).toBeInTheDocument();
    expect(screen.getByText("Demo child")).toBeInTheDocument();
    expect(screen.getAllByText("Teaching").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Student Support").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /Student Support/i }));
    expect(screen.getByText("CohortSignal Heatmap")).toBeInTheDocument();
    expect(screen.getByText("Overview sits in daily teaching workflow.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bulk Upload Students" })).not.toBeInTheDocument();
    expect(mocks.communications.loadVisibleCommunicationMessages).not.toHaveBeenCalled();
    expect(mocks.communications.markCommunicationMessageRead).not.toHaveBeenCalled();
    expect(mocks.communications.clearCommunicationMessage).not.toHaveBeenCalled();
  }, 30000);

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

    const { DemoDashboardLayout } = await import("@/components/DemoDashboardLayout");

    render(
      <MemoryRouter initialEntries={["/dashboard"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <DemoDashboardLayout>
          <div>Lecturer child</div>
        </DemoDashboardLayout>
      </MemoryRouter>,
    );

    clickNotificationsButton();

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

    const { DemoDashboardLayout } = await import("@/components/DemoDashboardLayout");

    render(
      <MemoryRouter initialEntries={["/dashboard"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <DemoDashboardLayout>
          <div>Lecturer child</div>
        </DemoDashboardLayout>
      </MemoryRouter>,
    );

    clickNotificationsButton();
    fireEvent.click(await screen.findByRole("button", { name: /Synthetic AI grading ready/i }));

    expect(mocks.navigate).toHaveBeenCalledWith(
      "/demo/dashboard/assignments/demo-assignment-policy-brief?source=notification&focus=release-follow-up",
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

    const { DemoDashboardLayout } = await import("@/components/DemoDashboardLayout");

    render(
      <MemoryRouter initialEntries={["/dashboard"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <DemoDashboardLayout>
          <div>Student child</div>
        </DemoDashboardLayout>
      </MemoryRouter>,
    );

    expect(screen.getAllByText("Student workspace").length).toBeGreaterThan(0);
    expect(screen.getAllByText("My Work").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Assignments").length).toBeGreaterThan(0);
    expect(screen.getAllByText("My Grades").length).toBeGreaterThan(0);
    expect(screen.queryByText("Explain My Grade")).not.toBeInTheDocument();
    clickNotificationsButton();

    expect(await screen.findByText("Released result")).toBeInTheDocument();
    expect(screen.getAllByText("Opens your released result and grade explanation.").length).toBeGreaterThan(0);
    expect(screen.getByText("Support")).toBeInTheDocument();
    expect(screen.getAllByText("Opens your released result and grade explanation.").length).toBeGreaterThan(1);
    expect(mocks.communications.loadVisibleCommunicationMessages).not.toHaveBeenCalled();
  });

  it("shows the updated admin sidebar structure without the old academic access label", async () => {
    mocks.authState.profile = {
      id: "demo-admin",
      full_name: "Demo Admin",
      email: "admin@gradeai.com",
      role: "admin",
    };
    mocks.authState.user = {
      id: "demo-admin",
      email: "admin@gradeai.com",
    };

    const { DemoDashboardLayout } = await import("@/components/DemoDashboardLayout");

    render(
      <MemoryRouter initialEntries={["/dashboard"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <DemoDashboardLayout>
          <div>Admin child</div>
        </DemoDashboardLayout>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Admin child")).toBeInTheDocument();
    expect(screen.getAllByText("Risk").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Institutional Insights").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Academic Oversight").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Compliance").length).toBeGreaterThan(0);
    expect(screen.queryByText("Academic Access")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Academic Oversight/i }));
    fireEvent.click(screen.getByRole("button", { name: /Compliance 1 Audit and governance views/i }));
    expect(screen.getAllByText("Audit and governance views").length).toBeGreaterThan(0);
  });

  it("does not show institutional insights in the lecturer sidebar", async () => {
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

    const { DemoDashboardLayout } = await import("@/components/DemoDashboardLayout");

    render(
      <MemoryRouter initialEntries={["/dashboard"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <DemoDashboardLayout>
          <div>Lecturer child</div>
        </DemoDashboardLayout>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Lecturer child")).toBeInTheDocument();
    expect(screen.queryByText("Institutional Insights")).not.toBeInTheDocument();
    expect(screen.queryByText("Accreditation")).not.toBeInTheDocument();
    expect(screen.queryByText("External Examiner")).not.toBeInTheDocument();
    expect(screen.queryByText("Institution")).not.toBeInTheDocument();
  });

  it("shows the CohortSignal heatmap shortcut in demo lecturer mode", async () => {
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

    const { default: DemoLecturerOverview } = await import("@/pages/dashboard/DemoLecturerOverview");

    render(
      <MemoryRouter initialEntries={["/demo/dashboard"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <DemoLecturerOverview />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Welcome back, Dr\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Open CohortSignal/i }));
    expect(mocks.navigate).toHaveBeenCalledWith("/demo/dashboard/cohortsignal-demo");
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

    const { DemoDashboardLayout } = await import("@/components/DemoDashboardLayout");

    render(
      <MemoryRouter initialEntries={["/dashboard"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <DemoDashboardLayout>
          <div>Student child</div>
        </DemoDashboardLayout>
      </MemoryRouter>,
    );

    clickNotificationsButton();
    fireEvent.click(await screen.findByRole("button", { name: /Study plan reminder/i }));

    expect(mocks.navigate).toHaveBeenCalledWith(
      "/demo/dashboard?assignment=demo-assignment-1&source=support-notification",
      expect.objectContaining({
        state: expect.objectContaining({
          redirectedFromSupportNotification: expect.objectContaining({
            subject: "Study plan reminder",
          }),
        }),
      }),
    );
  });

  it("shows the first-run onboarding modal for real lecturer sessions and stores dismissal", async () => {
    mocks.authState.isDemo = false;
    mocks.authState.profile = {
      id: "lecturer-1",
      full_name: "Dr. Ada Lecturer",
      email: "ada@example.com",
      role: "lecturer",
    };
    mocks.authState.user = {
      id: "lecturer-1",
      email: "ada@example.com",
    };
    mocks.communications.loadVisibleCommunicationMessages.mockResolvedValue([]);

    const { DashboardLayout } = await import("@/components/DashboardLayout");

    render(
      <MemoryRouter initialEntries={["/dashboard"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <DashboardLayout>
          <div>Lecturer child</div>
        </DashboardLayout>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Welcome to GradeAI")).toBeInTheDocument();
    expect(screen.getByText("Start here")).toBeInTheDocument();
    expect(screen.getByText("Review your workspace overview")).toBeInTheDocument();
    expect(screen.getByText("Create or open an assignment")).toBeInTheDocument();
    expect(screen.getByText("Check grading, integrity, and moderation before release")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Start using GradeAI" }));

    expect(screen.queryByText("Welcome to GradeAI")).not.toBeInTheDocument();
    expect(window.localStorage.getItem("gradeai:lecturer-onboarding-v1-dismissed")).toBe("true");

    mocks.authState.isDemo = true;
  });

  it("does not show the onboarding modal again after dismissal and remount", async () => {
    mocks.authState.isDemo = false;
    mocks.authState.profile = {
      id: "lecturer-1",
      full_name: "Dr. Ada Lecturer",
      email: "ada@example.com",
      role: "lecturer",
    };
    mocks.authState.user = {
      id: "lecturer-1",
      email: "ada@example.com",
    };
    mocks.communications.loadVisibleCommunicationMessages.mockResolvedValue([]);

    const { DashboardLayout } = await import("@/components/DashboardLayout");

    const firstRender = render(
      <MemoryRouter initialEntries={["/dashboard"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <DashboardLayout>
          <div>Lecturer child</div>
        </DashboardLayout>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Lecturer child")).toBeInTheDocument();
    expect(await screen.findByText("Welcome to GradeAI")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));
    expect(window.localStorage.getItem("gradeai:lecturer-onboarding-v1-dismissed")).toBe("true");

    firstRender.unmount();

    render(
      <MemoryRouter initialEntries={["/dashboard"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <DashboardLayout>
          <div>Lecturer child</div>
        </DashboardLayout>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Lecturer child")).toBeInTheDocument();
    expect(screen.queryByText("Welcome to GradeAI")).not.toBeInTheDocument();

    mocks.authState.isDemo = true;
  });

  it("does not show the onboarding modal for student sessions", async () => {
    mocks.authState.isDemo = false;
    mocks.authState.profile = {
      id: "student-1",
      full_name: "Student Example",
      email: "student@example.com",
      role: "student",
    };
    mocks.authState.user = {
      id: "student-1",
      email: "student@example.com",
    };
    mocks.communications.loadVisibleCommunicationMessages.mockResolvedValue([]);

    const { DashboardLayout } = await import("@/components/DashboardLayout");

    render(
      <MemoryRouter initialEntries={["/dashboard"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <DashboardLayout>
          <div>Student child</div>
        </DashboardLayout>
      </MemoryRouter>,
    );

    expect(screen.queryByText("Welcome to GradeAI")).not.toBeInTheDocument();
    expect(await screen.findByText("Student child")).toBeInTheDocument();

    mocks.authState.isDemo = true;
  });

  it("does not show the onboarding modal for admin sessions", async () => {
    mocks.authState.isDemo = false;
    mocks.authState.profile = {
      id: "admin-1",
      full_name: "Admin Example",
      email: "admin@example.com",
      role: "admin",
    };
    mocks.authState.user = {
      id: "admin-1",
      email: "admin@example.com",
    };
    mocks.communications.loadVisibleCommunicationMessages.mockResolvedValue([]);

    const { DemoDashboardLayout } = await import("@/components/DemoDashboardLayout");

    render(
      <MemoryRouter initialEntries={["/dashboard"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <DemoDashboardLayout>
          <div>Admin child</div>
        </DemoDashboardLayout>
      </MemoryRouter>,
    );

    expect(screen.queryByText("Welcome to GradeAI")).not.toBeInTheDocument();
    expect(await screen.findByText("Admin child")).toBeInTheDocument();

    mocks.authState.isDemo = true;
  });
});
