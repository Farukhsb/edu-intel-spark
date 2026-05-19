import { useEffect, useState } from "react";
import { log } from "@/lib/logger";
import { fetchStudentGradeProjection } from "@/lib/studentGradeProjection";
import {
  buildSubmissionOptionsFromProjection,
  DEMO_SUBMISSIONS,
  type SubmissionOption,
} from "@/pages/dashboard/explain-grade/helpers";

export const useExplainGradeData = ({
  isDemo,
  userId,
}: {
  isDemo: boolean;
  userId?: string;
}) => {
  const [submissions, setSubmissions] = useState<SubmissionOption[]>(isDemo ? DEMO_SUBMISSIONS : []);
  const [selectedId, setSelectedId] = useState<string>(isDemo ? (DEMO_SUBMISSIONS[0]?.gradeId ?? "") : "");
  const [loading, setLoading] = useState(!isDemo);
  const [error, setError] = useState<string | null>(null);

  const fetchGrades = async () => {
    if (isDemo) {
      setError(null);
      setSubmissions(DEMO_SUBMISSIONS);
      setSelectedId(DEMO_SUBMISSIONS[0]?.gradeId ?? "");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const projectionRes = await fetchStudentGradeProjection(userId);
      if (projectionRes.error) {
        throw projectionRes.error;
      }

      if (!projectionRes.data.length) {
        setSubmissions([]);
        setSelectedId("");
        setLoading(false);
        return;
      }

      const options = buildSubmissionOptionsFromProjection(
        projectionRes.data.filter((row) => row.submission_status === "released"),
      );

      setSubmissions(options);
      setSelectedId(options[0]?.gradeId ?? "");
    } catch (error) {
      log.error("Failed to fetch grades", error);
      setSubmissions([]);
      setSelectedId("");
      setError("Released grades could not be loaded right now.");
    }

    setLoading(false);
  };

  useEffect(() => {
    void fetchGrades();
  }, [isDemo, userId]);

  return {
    submissions,
    selectedId,
    setSelectedId,
    loading,
    error,
    refreshGrades: fetchGrades,
  };
};
