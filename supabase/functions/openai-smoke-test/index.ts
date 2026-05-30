import { handleOpenAISmokeTestRequest } from "./smoke.ts";

if (import.meta.main) {
  Deno.serve((req) => handleOpenAISmokeTestRequest(req));
}

export { handleOpenAISmokeTestRequest, runOpenAISmokeTest } from "./smoke.ts";
