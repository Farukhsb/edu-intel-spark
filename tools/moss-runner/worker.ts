import { Container, getContainer } from "@cloudflare/containers";
import { env } from "cloudflare:workers";

type WorkerEnv = {
  MOSS_RUNNER: DurableObjectNamespace<MossRunnerContainer>;
  MOSS_USER_ID: string;
  GRADEAI_API_SECRET: string;
  MOSS_RUNNER_TIMEOUT_MS?: string;
  MOSS_MAX_MATCHES?: string;
};

export class MossRunnerContainer extends Container {
  defaultPort = 8788;
  sleepAfter = "10m";

  envVars = {
    MOSS_USER_ID: env.MOSS_USER_ID,
    GRADEAI_API_SECRET: env.GRADEAI_API_SECRET,
    MOSS_RUNNER_TIMEOUT_MS: env.MOSS_RUNNER_TIMEOUT_MS ?? "30000",
    MOSS_MAX_MATCHES: env.MOSS_MAX_MATCHES ?? "10",
    PORT: "8788",
  };
}

export default {
  async fetch(request: Request, runtimeEnv: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({
        ok: true,
        service: "gradeai-moss-runner",
      });
    }

    const container = getContainer(runtimeEnv.MOSS_RUNNER, "singleton");
    return container.fetch(request);
  },
};
