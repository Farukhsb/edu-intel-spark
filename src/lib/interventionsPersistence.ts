import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  getInterventionErrorText,
  mapInterventionEventRow,
  mapInterventionRow,
} from "@/lib/interventionsFormatters";
import type {
  InterventionDbClient,
  InterventionEntry,
  InterventionEventEntry,
  ManualInterventionStatus,
  StudentInterventionEventInsert,
  StudentInterventionEventRow,
  StudentInterventionInsert,
  StudentInterventionRow,
} from "@/lib/interventionsTypes";

export async function fetchStudentInterventions(
  supabaseClient: InterventionDbClient,
  lecturerId: string,
  studentId: string,
) {
  const { data, error } = await supabaseClient
    .from("student_interventions")
    .select("id, lecturer_id, student_id, student_name, student_email, intervention_type, status, priority, title, notes, follow_up_date, assignment_id, created_at, updated_at")
    .eq("lecturer_id", lecturerId)
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });

  if (error) {
    return { data: null, error };
  }

  return {
    data: ((data || []) as StudentInterventionRow[]).map(mapInterventionRow),
    error: null,
  };
}

export async function fetchStudentInterventionEvents(
  supabaseClient: InterventionDbClient,
  lecturerId: string,
  studentId: string,
) {
  const { data, error } = await supabaseClient
    .from("student_intervention_events")
    .select("id, intervention_id, student_id, lecturer_id, contact_target_type, contact_target_name, contact_method, contacted_at, outcome, summary, next_step, created_at, updated_at")
    .eq("lecturer_id", lecturerId)
    .eq("student_id", studentId)
    .order("contacted_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return { data: null, error };
  }

  return {
    data: ((data || []) as StudentInterventionEventRow[]).map(mapInterventionEventRow),
    error: null,
  };
}

export async function insertManualIntervention(
  supabaseClient: InterventionDbClient,
  payload: StudentInterventionInsert,
) {
  const { data, error } = await supabaseClient
    .from("student_interventions")
    .insert(payload)
    .select("id, lecturer_id, student_id, student_name, student_email, intervention_type, status, priority, title, notes, follow_up_date, assignment_id, created_at, updated_at")
    .single();

  if (error) {
    return { data: null, error };
  }

  return {
    data: mapInterventionRow(data as StudentInterventionRow),
    error: null,
  };
}

export async function insertRecommendationInterventions(
  supabaseClient: InterventionDbClient,
  rows: StudentInterventionInsert[],
) {
  if (rows.length === 0) {
    return { error: null };
  }

  const { error } = await supabaseClient.from("student_interventions").insert(rows);
  return { error };
}

export async function insertStudentInterventionEvent(
  supabaseClient: InterventionDbClient,
  payload: StudentInterventionEventInsert,
) {
  const { data, error } = await supabaseClient
    .from("student_intervention_events")
    .insert(payload)
    .select("id, intervention_id, student_id, lecturer_id, contact_target_type, contact_target_name, contact_method, contacted_at, outcome, summary, next_step, created_at, updated_at")
    .single();

  if (error) {
    return { data: null, error };
  }

  return {
    data: mapInterventionEventRow(data as StudentInterventionEventRow),
    error: null,
  };
}

export async function updateStudentInterventionStatus(
  supabaseClient: InterventionDbClient,
  interventionId: string,
  status: ManualInterventionStatus,
) {
  const { data, error } = await supabaseClient
    .from("student_interventions")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", interventionId)
    .select("id, lecturer_id, student_id, student_name, student_email, intervention_type, status, priority, title, notes, follow_up_date, assignment_id, created_at, updated_at")
    .single();

  if (error) {
    return { data: null, error };
  }

  return {
    data: mapInterventionRow(data as StudentInterventionRow),
    error: null,
  };
}

export { getInterventionErrorText };
