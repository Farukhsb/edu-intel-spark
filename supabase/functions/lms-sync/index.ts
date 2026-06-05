import { registerLmsSyncEntrypoint } from "./bootstrap.ts";

registerLmsSyncEntrypoint({
  serve: Deno.serve,
});

