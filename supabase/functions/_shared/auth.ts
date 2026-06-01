import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export function getEnv(name: string) {
  if (typeof Deno !== "undefined" && typeof Deno.env?.get === "function") {
    return Deno.env.get(name);
  }

  return undefined;
}

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const supabaseUrl = getEnv("SUPABASE_URL");
const anonKey = getEnv("SUPABASE_ANON_KEY");
const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error("Supabase environment variables are not configured");
}

function getAuthorizationHeader(req: Request) {
  const header = req.headers.get("Authorization");
  if (!header) {
    throw new HttpError(401, "Missing Authorization header");
  }

  return header;
}

export function createUserClient(req: Request) {
  const authHeader = getAuthorizationHeader(req);

  return createClient(supabaseUrl!, anonKey!, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });
}

export function createAdminClient() {
  return createClient(supabaseUrl!, serviceRoleKey!);
}

type AppRole = "lecturer" | "student" | "admin";

export async function requireUser(req: Request) {
  const supabase = createUserClient(req);
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new HttpError(401, "Unauthorized");
  }

  return { supabase, user: data.user };
}

export async function resolveUserRoles(
  supabase: ReturnType<typeof createUserClient>,
  userId: string,
): Promise<AppRole[]> {
  const [rolesRes, profileRes] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase.from("profiles").select("role").eq("id", userId).maybeSingle(),
  ]);

  if (rolesRes.error && profileRes.error) {
    throw new HttpError(500, "Failed to verify user role");
  }

  const roles = new Set<AppRole>();

  for (const row of rolesRes.error ? [] : rolesRes.data ?? []) {
    if (row.role === "lecturer" || row.role === "student" || row.role === "admin") {
      roles.add(row.role);
    }
  }

  const profileRole = profileRes.error ? null : profileRes.data?.role;
  if (profileRole === "lecturer" || profileRole === "student" || profileRole === "admin") {
    roles.add(profileRole);
  }

  return [...roles];
}

export async function requireAppRoles(
  req: Request,
  allowedRoles: AppRole[],
) {
  const { supabase, user } = await requireUser(req);
  const roles = await resolveUserRoles(supabase, user.id);

  if (!allowedRoles.some((role) => roles.includes(role))) {
    throw new HttpError(403, `${allowedRoles.join(" or ")} access required`);
  }

  return { supabase, user, roles };
}

export async function requireLecturer(req: Request) {
  return requireAppRoles(req, ["lecturer", "admin"]);
}

export async function requireAdmin(req: Request) {
  return requireAppRoles(req, ["admin"]);
}

export function jsonError(error: unknown, corsHeaders: Record<string, string>) {
  if (error instanceof HttpError) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: error.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
    {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}
