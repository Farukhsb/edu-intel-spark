import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

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

export type AppRole = "lecturer" | "student" | "admin";

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

function hasAnyRole(roles: AppRole[], allowedRoles: AppRole[]) {
  return allowedRoles.some((role) => roles.includes(role));
}

function buildRoleErrorMessage(allowedRoles: AppRole[]) {
  if (allowedRoles.length === 1) {
    return `${allowedRoles[0][0].toUpperCase()}${allowedRoles[0].slice(1)} access required`;
  }

  const readableRoles = allowedRoles.map((role) => `${role[0].toUpperCase()}${role.slice(1)}`);
  return `${readableRoles.slice(0, -1).join(", ")} or ${readableRoles.at(-1)} access required`;
}

export async function requireAppRoles(req: Request, allowedRoles: AppRole[]) {
  const { supabase, user } = await requireUser(req);
  const roles = await resolveUserRoles(supabase, user.id);

  if (!hasAnyRole(roles, allowedRoles)) {
    throw new HttpError(403, buildRoleErrorMessage(allowedRoles));
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
