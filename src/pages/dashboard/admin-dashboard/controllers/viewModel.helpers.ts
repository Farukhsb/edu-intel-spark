import type { AdminView } from "../types";

export const isBulkUploadView = (activeView: AdminView) => activeView === "overview" || activeView === "users";
