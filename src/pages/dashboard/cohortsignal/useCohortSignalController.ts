import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { fetchCohortAnalyticsDataset } from "@/lib/data/cohort";
import {
  buildManualInterventionPayload,
  insertManualIntervention,
  type ManualInterventionType,
  type ManualInterventionStatus,
} from "@/lib/interventions";
import { log } from "@/lib/logger";
import { supabase } from "@/integrations/supabase/client";
import type { CohortSignalStudent } from "@/pages/cohortsignal-demo/demoData";

import { buildLiveCohortSignalDataset, type BandReport, type FailureReport } from "./liveData";

type ControllerState = {
  loading: boolean;
  error: string | null;
  students: CohortSignalStudent[];
  bandReport: BandReport;
  failureReport: FailureReport;
};

const EMPTY_BAND_REPORT: BandReport = {
  holdoutAccuracy: 0,
  crossValidation: { folds: 0, accuracy: 0, foldAccuracies: [] },
};

const EMPTY_FAILURE_REPORT: FailureReport = {
  holdoutAccuracy: 0,
  crossValidation: { folds: 0, accuracy: 0, foldAccuracies: [] },
  precision: 0,
  recall: 0,
  confusionMatrix: {
    truePositives: 0,
    falsePositives: 0,
    trueNegatives: 0,
    falseNegatives: 0,
  },
};

export const useCohortSignalController = () => {
  const { user } = useAuth();
  const [state, setState] = useState<ControllerState>({
    loading: true,
    error: null,
    students: [],
    bandReport: EMPTY_BAND_REPORT,
    failureReport: EMPTY_FAILURE_REPORT,
  });

  const loadData = useCallback(async () => {
    if (!user) return;

    setState((current) => ({ ...current, loading: true, error: null }));

    try {
      const [{ assignments, submissions, grades }, interventionsResponse] = await Promise.all([
        fetchCohortAnalyticsDataset(user.id),
        supabase
          .from("student_interventions")
          .select(
            "id, lecturer_id, student_id, student_name, student_email, intervention_type, status, priority, title, notes, follow_up_date, assignment_id, created_at, updated_at",
          )
          .eq("lecturer_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      if (interventionsResponse.error) throw interventionsResponse.error;

      const dataset = buildLiveCohortSignalDataset({
        assignments,
        submissions,
        grades,
        interventions: (interventionsResponse.data || []) as Parameters<typeof buildLiveCohortSignalDataset>[0]["interventions"],
      });

      setState({
        loading: false,
        error: null,
        students: dataset.students,
        bandReport: dataset.bandReport,
        failureReport: dataset.failureReport,
      });
    } catch (error) {
      log.error("CohortSignal live dataset fetch failed", error, {
        userId: user.id,
      });
      setState((current) => ({
        ...current,
        loading: false,
        error: "The CohortSignal live view could not be loaded right now.",
      }));
    }
  }, [user]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const logIntervention = async (student: CohortSignalStudent) => {
    if (!user) return null;

    const interventionType: ManualInterventionType = "email";
    const interventionStatus: ManualInterventionStatus = "planned";
    const payload = buildManualInterventionPayload({
      lecturerId: user.id,
      studentId: student.id,
      studentName: student.name,
      studentEmail: null,
      interventionType,
      interventionStatus,
      note: `CohortSignal flagged ${student.name} as ${student.riskBand} risk with a predicted failure probability of ${student.failProbability}%.`,
      followUpDate: new Date(Date.now() + 7 * 86400000).toISOString(),
      riskLevel: student.riskBand === "high" ? "high" : student.riskBand === "medium" ? "medium" : "low",
    });

    const { data, error } = await insertManualIntervention(supabase, payload);
    if (error) {
      log.warn("CohortSignal intervention log failed", {
        userId: user.id,
        studentId: student.id,
        error,
      });
      throw error;
    }

    return data?.createdAt ?? new Date().toISOString();
  };

  const reload = () => void loadData();

  return {
    state,
    actions: {
      reload,
      logIntervention,
    },
  };
};
