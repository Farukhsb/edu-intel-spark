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

export async function requireUser(req: Request) {
  const supabase = createUserClient(req);
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new HttpError(401, "Unauthorized");
  }

  return { supabase, user: data.user };
}

export async function requireLecturer(req: Request) {
  const { supabase, user } = await requireUser(req);

  const { data: role, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "lecturer")
    .maybeSingle();

  if (error) {
    throw new HttpError(500, "Failed to verify lecturer role");
  }

  if (!role) {
    throw new HttpError(403, "Lecturer access required");
  }

  return { supabase, user };
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
