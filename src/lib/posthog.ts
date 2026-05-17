import { log } from "@/lib/logger";

type PostHogLike = {
  identify: (distinctId: string, properties?: Record<string, unknown>) => void;
  reset: () => void;
};

let posthogClient: PostHogLike | null = null;
let missingKeyWarningShown = false;

const getClient = () => posthogClient;

export const initPostHog = async () => {
  const analyticsEnabled = import.meta.env.VITE_ANALYTICS_ENABLED === "true";
  // Analytics stays disabled by default because GradeAI handles academic assessment data.
  if (!analyticsEnabled) {
    if (import.meta.env.DEV && !missingKeyWarningShown) {
      log.info("Analytics disabled; PostHog not initialised.");
      missingKeyWarningShown = true;
    }
    posthogClient = null;
    return;
  }

  const key = import.meta.env.VITE_POSTHOG_KEY;
  if (!key) {
    if (import.meta.env.DEV && !missingKeyWarningShown) {
      log.info("PostHog key missing; analytics disabled.");
      missingKeyWarningShown = true;
    }
    posthogClient = null;
    return;
  }

  const { default: posthog } = await import("posthog-js");
  posthog.init(key, {
    api_host: import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com",
    person_profiles: "identified_only",
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    disable_session_recording: true,
  });
  posthogClient = posthog;
};

export const posthog: PostHogLike = {
  identify(distinctId, properties) {
    getClient()?.identify(distinctId, properties);
  },
  reset() {
    getClient()?.reset();
  },
};
