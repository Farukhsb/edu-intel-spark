/// <reference types="vite/client" />

declare const Deno: {
  env?: {
    get(name: string): string | undefined;
  };
} | undefined;

declare module "npm:*";
declare module "https://*";
declare module "../../supabase/functions/*";
declare module "../../tools/grading-benchmark/*";
