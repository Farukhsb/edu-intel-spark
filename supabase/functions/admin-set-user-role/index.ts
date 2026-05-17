import { z } from "https://esm.sh/zod@3.23.8";

import { createAdminClient, HttpError, jsonError, requireAdmin } from "../_shared/auth.ts";
import { createCorsForbiddenResponse, getCorsHeaders } from "../_shared/cors.ts";
import { logError } from "../_shared/log.ts";
import { applySharedRateLimit, createRateLimitResponse } from "../_shared/rate-limit.ts";

const RoleChangeRequestSchema = z.object({
  targetUserId: z.string().uuid(),
  nextRole: z.enum(["student", "lecturer"]).optional(),
  syncOnly: z.boolean().optional(),
});

const resolveDepartmentName = (input: {
  department_name?: string | null;
  department_id?: string | null;
}) => input.department_name ?? input.department_id ?? null;

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (!corsHeaders) return createCorsForbiddenResponse();
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (req.method !== "POST") {
      throw new HttpError(405, "Method not allowed");
    }

    const { supabase, user } = await requireAdmin(req);
    const rateLimit = await applySharedRateLimit(createAdminClient(), req, {
      scope: "admin-set-user-role",
      limit: 15,
      windowMs: 60_000,
      userId: user.id,
    });

    if (!rateLimit.allowed) {
      return createRateLimitResponse(corsHeaders, rateLimit.retryAfterSeconds);
    }

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

    const { targetUserId, nextRole, syncOnly = false } = parsed.data;
    const { data: actorProfile, error: actorProfileError } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, cohort_id, department_name, department_id")
      .eq("id", user.id)
      .maybeSingle();

    if (actorProfileError) {
      throw new HttpError(403, "Admin profile could not be resolved");
    }

    const supabaseAdmin = createAdminClient();

    const { data: targetProfile, error: targetProfileError } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, role, cohort_id, department_name, department_id")
      .eq("id", targetUserId)
      .maybeSingle();

    if (targetProfileError || !targetProfile) {
      throw new HttpError(404, "Target user was not found");
    }

    if (!syncOnly && targetProfile.id === user.id) {
      throw new HttpError(400, "Admin users cannot change their own role");
    }

    if (!syncOnly && targetProfile.role === "admin") {
      throw new HttpError(400, "Admin users cannot be changed by this action");
    }

    const currentRole = String(targetProfile.role);
    if (currentRole !== "student" && currentRole !== "lecturer" && currentRole !== "admin") {
      throw new HttpError(400, `Unsupported current role: ${currentRole}`);
    }

    const resolvedNextRole = syncOnly ? currentRole : nextRole;

    if (!resolvedNextRole) {
      throw new HttpError(400, "A nextRole is required when syncOnly is false");
    }

    if (!syncOnly && currentRole === resolvedNextRole) {
      throw new HttpError(400, `Role is already set to ${resolvedNextRole}`);
    }

    if (!syncOnly) {
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
        .update({ role: resolvedNextRole })
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
        .insert({ user_id: targetUserId, role: resolvedNextRole });

      if (insertRoleError) {
        throw new HttpError(500, insertRoleError.message);
      }
    }

    const { data: authUserResult, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(targetUserId);

    if (authUserError || !authUserResult?.user) {
      throw new HttpError(500, "Could not load auth user for metadata sync");
    }

    const existingMetadata =
      authUserResult.user.user_metadata && typeof authUserResult.user.user_metadata === "object"
        ? authUserResult.user.user_metadata
        : {};

    const departmentName = resolveDepartmentName(targetProfile);

    const nextMetadata = {
      ...existingMetadata,
      full_name: targetProfile.full_name || existingMetadata.full_name || null,
      role: resolvedNextRole,
      cohort_id: targetProfile.cohort_id ?? existingMetadata.cohort_id ?? null,
      department_name: departmentName ?? existingMetadata.department_name ?? existingMetadata.department_id ?? null,
      department_id: departmentName ?? existingMetadata.department_id ?? existingMetadata.department_name ?? null,
    };

    const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
      user_metadata: nextMetadata,
    });

    if (authUpdateError) {
      throw new HttpError(500, `Role metadata sync failed: ${authUpdateError.message}`);
    }

    const { error: auditError } = await supabaseAdmin
      .from("admin_audit_log")
      .insert({
        actor_id: user.id,
        actor_role: "admin",
        action_type: syncOnly ? "role_metadata_synced" : "role_changed",
        target_user_id: targetUserId,
        target_user_name: targetProfile.full_name || targetProfile.email || "Unknown user",
        target_user_email: targetProfile.email,
        details: {
          actor_name: actorProfile.full_name || actorProfile.email || "Admin",
          previous_role: currentRole,
          updated_role: resolvedNextRole,
          sync_only: syncOnly,
        },
      });

    if (auditError) {
      throw new HttpError(500, auditError.message);
    }

    return new Response(JSON.stringify({
      data: [{
        user_id: targetUserId,
        previous_role: currentRole,
        updated_role: resolvedNextRole,
        sync_only: syncOnly,
      }],
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    logError("admin-set-user-role error", error);
    return jsonError(error, corsHeaders);
  }
});
