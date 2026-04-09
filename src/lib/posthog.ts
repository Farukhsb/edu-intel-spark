import posthog from "posthog-js";

export const initPostHog = () => {
  const key = import.meta.env.VITE_POSTHOG_KEY || "phc_96ZN0coZq6pvN18QFEd759uOHx3ZuZviXK1FxvydNRk";
  posthog.init(key, {
    api_host: import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: true,
    capture_pageleave: true,
  });
};

export { posthog };
