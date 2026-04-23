import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initPostHog } from "./lib/posthog";

const scheduleAnalyticsInit = () => {
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(() => {
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
