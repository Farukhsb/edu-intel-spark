import type { LmsProviderAdapter } from "../../lms/providers.ts";

export async function ingestProviderEvents(provider: LmsProviderAdapter, courseId: string) {
  const [timingEvents, engagementEvents] = await Promise.all([
    provider.pullTimingEvents(courseId),
    provider.pullEngagementEvents(courseId),
  ]);

  return { timingEvents, engagementEvents };
}

