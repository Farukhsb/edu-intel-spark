import posthog from "posthog-js";

export const initPostHog = () => {
  posthog.init("phc_96ZN0coZq6pvN18QFEd759uOHx3ZuZviXK1FxvydNRk", {
    api_host: "https://us.i.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: true,
    capture_pageleave: true,
  });
};

export { posthog };
