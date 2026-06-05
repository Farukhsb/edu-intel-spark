import type { LmsProviderAdapter } from "../../lms/providers.ts";

export async function pullSubmissions(provider: LmsProviderAdapter, assignmentId: string) {
  return provider.pullSubmissions(assignmentId);
}

