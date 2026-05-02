import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://esm.sh/zod@3.23.8";

import { createAdminClient, HttpError, jsonError, requireAdmin } from "../_shared/auth.ts";
import { createCorsForbiddenResponse, getCorsHeaders } from "../_shared/cors.ts";
import { logError } from "../_shared/log.ts";

const RoleChangeRequestSchema = z.object({
  targetUserId: z.string().uuid(),
  nextRole: z.enum(["student", "lecturer"]),
});

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (!corsHeaders) return createCorsForbiddenResponse();
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (req.method !== "POST") {
      throw new HttpError(405, "Method not allowed");
    }

    const { supabase, user } = await requireAdmin(req);

    const body = await req.json().catch(() => null);
    const parsed = RoleChangeRequestSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          error: "Invalid request format",
          details: parsed.error.issues,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { targetUserId, nextRole } = parsed.data;
    const { data: actorProfile, error: actorProfileError } = await supabase
      .from("profiles")
      .select("id, full_name, email, role")
      .eq("id", user.id)
      .maybeSingle();

    if (actorProfileError) {
      throw new HttpError(403, "Admin profile could not be resolved");
    }

    const supabaseAdmin = createAdminClient();

    const { data: targetProfile, error: targetProfileError } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, role")
      .eq("id", targetUserId)
      .maybeSingle();

    if (targetProfileError || !targetProfile) {
      throw new HttpError(404, "Target user was not found");
    }

    if (targetProfile.id === user.id) {
      throw new HttpError(400, "Admin users cannot change their own role");
    }

    if (targetProfile.role === "admin") {
      throw new HttpError(400, "Admin users cannot be changed by this action");
    }

    const currentRole = String(targetProfile.role);
    if (currentRole !== "student" && currentRole !== "lecturer") {
      throw new HttpError(400, `Unsupported current role: ${currentRole}`);
    }

    if (currentRole === nextRole) {
      throw new HttpError(400, `Role is already set to ${nextRole}`);
    }

    const { data: existingRoles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("id, role")
      .eq("user_id", targetUserId)
      .in("role", ["student", "lecturer"]);

    if (rolesError) {
      throw new HttpError(500, "Could not verify existing role mapping");
    }

    if ((existingRoles ?? []).length !== 1) {
      throw new HttpError(400, "Conflicting user_roles state for target user");
    }

    const { error: updateProfileError } = await supabaseAdmin
      .from("profiles")
      .update({ role: nextRole })
      .eq("id", targetUserId);

    if (updateProfileError) {
      throw new HttpError(500, updateProfileError.message);
    }

    const { error: deleteRolesError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", targetUserId)
      .in("role", ["student", "lecturer"]);

    if (deleteRolesError) {
      throw new HttpError(500, deleteRolesError.message);
    }

    const { error: insertRoleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: targetUserId, role: nextRole });

    if (insertRoleError) {
      throw new HttpError(500, insertRoleError.message);
    }

    const { error: auditError } = await supabaseAdmin
      .from("admin_audit_log")
      .insert({
        actor_id: user.id,
        actor_role: "admin",
        action_type: "role_changed",
        target_user_id: targetUserId,
        target_user_name: targetProfile.full_name || targetProfile.email || "Unknown user",
        target_user_email: targetProfile.email,
        details: {
          actor_name: actorProfile.full_name || actorProfile.email || "Admin",
          previous_role: currentRole,
          updated_role: nextRole,
        },
      });

    if (auditError) {
      throw new HttpError(500, auditError.message);
    }

    return new Response(JSON.stringify({
      data: [{
        user_id: targetUserId,
        previous_role: currentRole,
        updated_role: nextRole,
      }],
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    logError("admin-set-user-role error", error);
    return jsonError(error, corsHeaders);
  }
});
