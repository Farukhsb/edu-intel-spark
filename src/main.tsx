import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initSentry } from "@/lib/sentry";
import { initPostHog } from "./lib/posthog";

initSentry();

const scheduleAnalyticsInit = () => {
  const idleCallback = window.requestIdleCallback;
  if (typeof idleCallback === "function") {
    idleCallback(() => {
      void initPostHog();
    });
    return;
  }

  window.setTimeout(() => {
    void initPostHog();
  }, 0);
};

createRoot(document.getElementById("root")!).render(<App />);
scheduleAnalyticsInit();
