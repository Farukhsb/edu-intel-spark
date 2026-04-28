declare const Deno:
  | {
      env: {
        get(name: string): string | undefined;
      };
    }
  | undefined;

type EmailPayload = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getEnv(name: string, fallback?: string) {
  return Deno?.env.get(name) ?? fallback;
}

function notificationsEnabled() {
  return getEnv("EMAIL_NOTIFICATIONS_ENABLED", "false") === "true";
}

export function getAppBaseUrl() {
  return getEnv("APP_BASE_URL", "https://edu-intel-spark.pages.dev");
}

export async function sendEmail(payload: EmailPayload) {
  if (!notificationsEnabled()) {
    console.log("[email] notifications disabled, skipping send", {
      subject: payload.subject,
    });
    return { skipped: true };
  }

  const apiKey = getEnv("RESEND_API_KEY");
  const from = getEnv("EMAIL_FROM_ADDRESS", "GradeAI <notifications@gradeai.app>");

  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY missing, skipping send");
    return { skipped: true };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    }),
  });

  await response.text();

  if (!response.ok) {
    throw new Error(`[email] resend error ${response.status}`);
  }

  console.log("[email] sent", { subject: payload.subject });
  return { success: true };
}

export function formatSubmissionNotificationEmail(params: {
  lecturerName?: string | null;
  assignmentTitle: string;
  studentName: string;
  submittedAt: string;
  reviewUrl: string;
}) {
  const greeting = params.lecturerName ? `Hi ${params.lecturerName},` : "Hello,";
  const safeGreeting = escapeHtml(greeting);
  const safeAssignmentTitle = escapeHtml(params.assignmentTitle);
  const safeStudentName = escapeHtml(params.studentName);
  const safeSubmittedAt = escapeHtml(params.submittedAt);
  const safeReviewUrl = escapeHtml(params.reviewUrl);
  return {
    subject: `New submission received for ${params.assignmentTitle}`,
    text: `${greeting}\n\nA new submission has been received for ${params.assignmentTitle}.\nStudent: ${params.studentName}\nSubmitted: ${params.submittedAt}\nReview: ${params.reviewUrl}`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
        <p>${safeGreeting}</p>
        <p>A new submission has been received for <strong>${safeAssignmentTitle}</strong>.</p>
        <ul>
          <li><strong>Student:</strong> ${safeStudentName}</li>
          <li><strong>Submitted:</strong> ${safeSubmittedAt}</li>
        </ul>
        <p><a href="${safeReviewUrl}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;">Review submission</a></p>
      </div>
    `,
  };
}

export function formatAssignmentPublishedEmail(params: {
  studentName?: string | null;
  assignmentTitle: string;
  dueDate?: string | null;
  assignmentUrl: string;
}) {
  const greeting = params.studentName ? `Hi ${params.studentName},` : "Hello,";
  const dueDateText = params.dueDate ? `\nDue date: ${params.dueDate}` : "";
  const safeGreeting = escapeHtml(greeting);
  const safeAssignmentTitle = escapeHtml(params.assignmentTitle);
  const safeDueDate = params.dueDate ? escapeHtml(params.dueDate) : null;
  const safeAssignmentUrl = escapeHtml(params.assignmentUrl);

  return {
    subject: `New assignment published`,
    text: `${greeting}\n\n${params.assignmentTitle} is now available in GradeAI.${dueDateText}\nView assignment: ${params.assignmentUrl}`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
        <p>${safeGreeting}</p>
        <p><strong>${safeAssignmentTitle}</strong> is now available in GradeAI.</p>
        ${safeDueDate ? `<p><strong>Due date:</strong> ${safeDueDate}</p>` : ""}
        <p><a href="${safeAssignmentUrl}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;">Open assignment</a></p>
      </div>
    `,
  };
}

export function formatGradingCompleteEmail(params: {
  lecturerName?: string | null;
  assignmentTitle: string;
  gradedCount: number;
  failedCount: number;
  reviewUrl: string;
}) {
  const greeting = params.lecturerName ? `Hi ${params.lecturerName},` : "Hello,";
  const safeGreeting = escapeHtml(greeting);
  const safeAssignmentTitle = escapeHtml(params.assignmentTitle);
  const safeReviewUrl = escapeHtml(params.reviewUrl);
  return {
    subject: `AI grading complete for ${params.assignmentTitle}`,
    text: `${greeting}\n\nAI grading has finished for ${params.assignmentTitle}.\nGraded successfully: ${params.gradedCount}\nFailed: ${params.failedCount}\nReview: ${params.reviewUrl}`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
        <p>${safeGreeting}</p>
        <p>AI grading has finished for <strong>${safeAssignmentTitle}</strong>.</p>
        <ul>
          <li><strong>Graded successfully:</strong> ${params.gradedCount}</li>
          <li><strong>Failed:</strong> ${params.failedCount}</li>
        </ul>
        <p><a href="${safeReviewUrl}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;">Review results</a></p>
      </div>
    `,
  };
}

export function formatGradeReleasedEmail(params: {
  studentName?: string | null;
  assignmentTitle: string;
  assignmentUrl: string;
}) {
  const greeting = params.studentName ? `Hi ${params.studentName},` : "Hello,";
  const safeGreeting = escapeHtml(greeting);
  const safeAssignmentTitle = escapeHtml(params.assignmentTitle);
  const safeAssignmentUrl = escapeHtml(params.assignmentUrl);

  return {
    subject: "Feedback released",
    text: `${greeting}\n\nYour feedback for ${params.assignmentTitle} is now available in GradeAI.\nView feedback: ${params.assignmentUrl}`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
        <p>${safeGreeting}</p>
        <p>Your feedback for <strong>${safeAssignmentTitle}</strong> is now available in GradeAI.</p>
        <p><a href="${safeAssignmentUrl}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;">View feedback</a></p>
      </div>
    `,
  };
}
