import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import type { ModerationCaseView } from "@/lib/moderationWorkflow";

type RenderModerationDashboardOptions = {
  auth: {
    user: { id: string; email: string };
    profile: { id: string; role: string };
  };
  cases: ModerationCaseView[];
  lecturers?: unknown[];
  supabase?: Record<string, unknown>;
};

export const fetchModerationCaseViewsMock = vi.fn();

export const renderModerationDashboard = async ({
  auth,
  cases,
  lecturers = [],
  supabase = {},
}: RenderModerationDashboardOptions) => {
  vi.resetModules();

  fetchModerationCaseViewsMock.mockResolvedValue({
    cases,
    lecturers,
  });

  vi.doMock("@/contexts/AuthContext", () => ({
    useAuth: () => auth,
  }));

  vi.doMock("@/integrations/supabase/client", () => ({
    supabase,
  }));

  vi.doMock("@/lib/moderationWorkflow", async () => {
    const actual = await vi.importActual<typeof import("@/lib/moderationWorkflow")>("@/lib/moderationWorkflow");
    return {
      ...actual,
      fetchModerationCaseViews: fetchModerationCaseViewsMock,
    };
  });

  const { default: ModerationDashboard } = await import("@/pages/dashboard/ModerationDashboard");

  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ModerationDashboard />
    </MemoryRouter>
  );
};

export const cleanupModerationDashboardMocks = () => {
  fetchModerationCaseViewsMock.mockReset();
  vi.clearAllMocks();
  vi.resetModules();
  vi.unmock("@/contexts/AuthContext");
  vi.unmock("@/integrations/supabase/client");
  vi.unmock("@/lib/moderationWorkflow");
};
