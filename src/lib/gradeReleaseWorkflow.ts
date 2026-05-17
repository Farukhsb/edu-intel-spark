export interface GradeReleaseExecutionResult {
  submissionId: string;
  released: boolean;
  auditLogged: boolean;
  notificationSaved: boolean;
  emailQueued: boolean;
}

export interface GradeReleaseBatchSummary {
  releasedCount: number;
  updateFailureCount: number;
  auditFailureCount: number;
  notificationFailureCount: number;
  emailFailureCount: number;
}

export const executeGradeRelease = async ({
  submissionId,
  markReleased,
  logAudit,
  queueNotification,
  sendEmail,
}: {
  submissionId: string;
  markReleased: () => Promise<void>;
  logAudit: () => Promise<boolean>;
  queueNotification: () => Promise<boolean>;
  sendEmail: () => Promise<boolean>;
}): Promise<GradeReleaseExecutionResult> => {
  try {
    await markReleased();
  } catch {
    return {
      submissionId,
      released: false,
      auditLogged: false,
      notificationSaved: false,
      emailQueued: false,
    };
  }

  const auditLogged = await logAudit().catch(() => false);
  const notificationSaved = await queueNotification().catch(() => false);
  const emailQueued = await sendEmail().catch(() => false);

  return {
    submissionId,
    released: true,
    auditLogged,
    notificationSaved,
    emailQueued,
  };
};

export const summarizeGradeReleaseBatch = (
  results: GradeReleaseExecutionResult[],
): GradeReleaseBatchSummary => ({
  releasedCount: results.filter((result) => result.released).length,
  updateFailureCount: results.filter((result) => !result.released).length,
  auditFailureCount: results.filter((result) => result.released && !result.auditLogged).length,
  notificationFailureCount: results.filter((result) => result.released && !result.notificationSaved).length,
  emailFailureCount: results.filter((result) => result.released && !result.emailQueued).length,
});
