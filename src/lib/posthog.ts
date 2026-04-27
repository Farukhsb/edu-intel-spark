import { env } from "@/lib/env";
import { log } from "@/lib/logger";

type PostHogLike = {
  identify: (distinctId: string, properties?: Record<string, unknown>) => void;
  reset: () => void;
};

let posthogClient: PostHogLike | null = null;
let missingKeyWarningShown = false;

const getClient = () => posthogClient;

export const initPostHog = async () => {
  const key = env.VITE_POSTHOG_KEY;
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
    api_host: env.VITE_POSTHOG_HOST || "https://us.i.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: true,
    capture_pageleave: true,
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
