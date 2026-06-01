import { LecturerOverviewScreen } from "@/pages/dashboard/lecturer-overview";
import { useDemoLecturerOverviewController } from "@/pages/dashboard/lecturer-overview/useDemoLecturerOverviewController";

const DemoLecturerOverview = () => {
  const {
    profile,
    state: {
      assignments,
      heroSummary,
      loadWarning,
      pipeline,
      primaryWorkflowTarget,
      queueFocus,
      recent,
      readiness,
      stats,
      topAtRiskStudents,
    },
  } = useDemoLecturerOverviewController();

  return (
    <LecturerOverviewScreen
      profile={profile}
      stats={stats}
      recent={recent}
      pipeline={pipeline}
      readiness={readiness}
      topAtRiskStudents={topAtRiskStudents}
      heroSummary={heroSummary}
      loadWarning={loadWarning}
      assignments={assignments}
      primaryWorkflowTarget={primaryWorkflowTarget}
      queueFocus={queueFocus}
    />
  );
};

export default DemoLecturerOverview;
