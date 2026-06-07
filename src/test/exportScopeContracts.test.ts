import { describe, expect, it, vi, beforeEach } from "vitest";

type QueryResult = {
  data: unknown[] | null;
  error: unknown | null;
};

const makeQuery = (result: QueryResult) => {
  const chain: any = {
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    then: (onFulfilled: (value: QueryResult) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
  };

  return chain;
};

const queries = vi.hoisted(() => {
  const byTable = new Map<string, ReturnType<typeof makeQuery>>();

  return {
    byTable,
    from: vi.fn((table: string) => {
      const query = makeQuery({ data: [], error: null });
      byTable.set(table, query);
      return {
        select: vi.fn(() => query),
      };
    }),
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: queries.from,
  },
}));

import {
  fetchAccreditationDataset,
  fetchExternalExaminerDataset,
  fetchProgrammeReportDataset,
} from "@/lib/data/academic";
import { fetchAdminInterventionEvidenceDataset } from "@/lib/data/admin/interventionEvidence";
import { fetchRiskIntelligenceDataset } from "@/lib/data/admin/riskIntelligence";

describe("export scope contracts", () => {
  beforeEach(() => {
    queries.byTable.clear();
    queries.from.mockClear();
  });

  it("scopes accreditation exports to the current institution", async () => {
    await fetchAccreditationDataset("institution-1");
    expect(queries.byTable.get("grades")?.eq).toHaveBeenCalledWith("institution_id", "institution-1");
    expect(queries.byTable.get("submissions")?.eq).toHaveBeenCalledWith("institution_id", "institution-1");
    expect(queries.byTable.get("assignments")?.eq).toHaveBeenCalledWith("institution_id", "institution-1");
    expect(queries.byTable.get("profiles")?.eq).toHaveBeenCalledWith("institution_id", "institution-1");
  });

  it("scopes programme exports to the current institution", async () => {
    await fetchProgrammeReportDataset("institution-1");
    expect(queries.byTable.get("assignments")?.eq).toHaveBeenCalledWith("institution_id", "institution-1");
    expect(queries.byTable.get("submissions")?.eq).toHaveBeenCalledWith("institution_id", "institution-1");
    expect(queries.byTable.get("grades")?.eq).toHaveBeenCalledWith("institution_id", "institution-1");
    expect(queries.byTable.get("profiles")?.eq).toHaveBeenCalledWith("institution_id", "institution-1");
  });

  it("scopes external examiner exports to the current institution", async () => {
    await fetchExternalExaminerDataset("institution-1");
    expect(queries.byTable.get("assignments")?.eq).toHaveBeenCalledWith("institution_id", "institution-1");
    expect(queries.byTable.get("submissions")?.eq).toHaveBeenCalledWith("institution_id", "institution-1");
    expect(queries.byTable.get("grades")?.eq).toHaveBeenCalledWith("institution_id", "institution-1");
    expect(queries.byTable.get("profiles")?.eq).toHaveBeenCalledWith("institution_id", "institution-1");
  });

  it("scopes intervention evidence exports to the current institution", async () => {
    await fetchAdminInterventionEvidenceDataset("institution-1");
    expect(queries.byTable.get("profiles")?.eq).toHaveBeenCalledWith("institution_id", "institution-1");
    expect(queries.byTable.get("student_interventions")?.eq).toHaveBeenCalledWith("institution_id", "institution-1");
    expect(queries.byTable.get("student_intervention_events")?.eq).toHaveBeenCalledWith("institution_id", "institution-1");
  });

  it("scopes risk intelligence exports to the current institution", async () => {
    await fetchRiskIntelligenceDataset("institution-1");
    expect(queries.byTable.get("student_risk_snapshots")?.eq).toHaveBeenCalledWith("institution_id", "institution-1");
    expect(queries.byTable.get("student_risk_predictions")?.eq).toHaveBeenCalledWith("institution_id", "institution-1");
    expect(queries.byTable.get("risk_feedback")?.eq).toHaveBeenCalledWith("institution_id", "institution-1");
    expect(queries.byTable.get("student_risk_outcomes")?.eq).toHaveBeenCalledWith("institution_id", "institution-1");
    expect(queries.byTable.get("profiles")?.eq).toHaveBeenCalledWith("institution_id", "institution-1");
  });
});
