type PostHogLike = {
  identify: (distinctId: string, properties?: Record<string, unknown>) => void;
  reset: () => void;
};

let posthogClient: PostHogLike | null = null;

const getClient = () => posthogClient;

export const initPostHog = async () => {
  const key = import.meta.env.VITE_POSTHOG_KEY || "phc_96ZN0coZq6pvN18QFEd759uOHx3ZuZviXK1FxvydNRk";
  const { default: posthog } = await import("posthog-js");
  posthog.init(key, {
    api_host: import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com",
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
