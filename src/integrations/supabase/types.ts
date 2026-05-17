export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      academic_integrity_reviews: {
        Row: {
          created_at: string
          decision: string
          evidence_summary: string | null
          id: string
          lecturer_id: string
          lecturer_note: string | null
          review_type: string
          submission_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          decision: string
          evidence_summary?: string | null
          id?: string
          lecturer_id: string
          lecturer_note?: string | null
          review_type: string
          submission_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          decision?: string
          evidence_summary?: string | null
          id?: string
          lecturer_id?: string
          lecturer_note?: string | null
          review_type?: string
          submission_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      academic_access_events: {
        Row: {
          actor_id: string
          actor_role: string
          assignment_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json
          moderation_case_id: string | null
          resource_id: string | null
          resource_type: string
          submission_id: string | null
        }
        Insert: {
          actor_id: string
          actor_role: string
          assignment_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          moderation_case_id?: string | null
          resource_id?: string | null
          resource_type: string
          submission_id?: string | null
        }
        Update: {
          actor_id?: string
          actor_role?: string
          assignment_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          moderation_case_id?: string | null
          resource_id?: string | null
          resource_type?: string
          submission_id?: string | null
        }
        Relationships: []
      }
      admin_audit_log: {
        Row: {
          action_type: string
          actor_id: string | null
          actor_role: string | null
          created_at: string
          details: Json
          id: string
          target_user_email: string | null
          target_user_id: string | null
          target_user_name: string | null
        }
        Insert: {
          action_type: string
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          details?: Json
          id?: string
          target_user_email?: string | null
          target_user_id?: string | null
          target_user_name?: string | null
        }
        Update: {
          action_type?: string
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          details?: Json
          id?: string
          target_user_email?: string | null
          target_user_id?: string | null
          target_user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_audit_log_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_recommendations: {
        Row: {
          assignment_id: string | null
          confidence: number
          created_at: string
          evidence: Json
          explanation: string
          id: string
          lecturer_id: string
          recommended_actions: Json
          rule_code: string
          severity: string
          status: string
          summary: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          assignment_id?: string | null
          confidence?: number
          created_at?: string
          evidence?: Json
          explanation: string
          id: string
          lecturer_id: string
          recommended_actions?: Json
          rule_code: string
          severity: string
          status?: string
          summary: string
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          assignment_id?: string | null
          confidence?: number
          created_at?: string
          evidence?: Json
          explanation?: string
          id?: string
          lecturer_id?: string
          recommended_actions?: Json
          rule_code?: string
          severity?: string
          status?: string
          summary?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "analytics_recommendations_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_recommendations_lecturer_id_fkey"
            columns: ["lecturer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          created_at: string
          description: string | null
          due_date: string | null
          file_url: string | null
          id: string
          lecturer_id: string
          max_score: number
          module_code: string | null
          rubric: Json | null
          status: Database["public"]["Enums"]["assignment_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          file_url?: string | null
          id?: string
          lecturer_id: string
          max_score?: number
          module_code?: string | null
          rubric?: Json | null
          status?: Database["public"]["Enums"]["assignment_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          file_url?: string | null
          id?: string
          lecturer_id?: string
          max_score?: number
          module_code?: string | null
          rubric?: Json | null
          status?: Database["public"]["Enums"]["assignment_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      assignment_cohorts: {
        Row: {
          assignment_id: string
          cohort_id: string
          created_at: string
        }
        Insert: {
          assignment_id: string
          cohort_id: string
          created_at?: string
        }
        Update: {
          assignment_id?: string
          cohort_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_cohorts_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_departments: {
        Row: {
          assignment_id: string
          created_at: string
          department_name: string | null
          department_id: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          department_name?: string | null
          department_id: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          department_name?: string | null
          department_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_departments_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_messages: {
        Row: {
          body: string
          category: string
          cleared: boolean
          created_at: string
          id: string
          read: boolean
          recipient_email: string | null
          recipient_id: string | null
          recipient_name: string
          related_assignment_id: string | null
          related_student_id: string | null
          sender_id: string
          subject: string
        }
        Insert: {
          body: string
          category: string
          cleared?: boolean
          created_at?: string
          id?: string
          read?: boolean
          recipient_email?: string | null
          recipient_id?: string | null
          recipient_name: string
          related_assignment_id?: string | null
          related_student_id?: string | null
          sender_id: string
          subject: string
        }
        Update: {
          body?: string
          category?: string
          cleared?: boolean
          created_at?: string
          id?: string
          read?: boolean
          recipient_email?: string | null
          recipient_id?: string | null
          recipient_name?: string
          related_assignment_id?: string | null
          related_student_id?: string | null
          sender_id?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      grade_audit_log: {
        Row: {
          actor_role: string | null
          changed_by: string | null
          created_at: string
          event_type: string
          grade_id: string | null
          id: string
          moderation_case_id: string | null
          new_values: Json
          previous_values: Json
          reason: string | null
          submission_id: string
        }
        Insert: {
          actor_role?: string | null
          changed_by?: string | null
          created_at?: string
          event_type: string
          grade_id?: string | null
          id?: string
          moderation_case_id?: string | null
          new_values?: Json
          previous_values?: Json
          reason?: string | null
          submission_id: string
        }
        Update: {
          actor_role?: string | null
          changed_by?: string | null
          created_at?: string
          event_type?: string
          grade_id?: string | null
          id?: string
          moderation_case_id?: string | null
          new_values?: Json
          previous_values?: Json
          reason?: string | null
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grade_audit_log_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_audit_log_grade_id_fkey"
            columns: ["grade_id"]
            isOneToOne: false
            referencedRelation: "grades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_audit_log_moderation_case_id_fkey"
            columns: ["moderation_case_id"]
            isOneToOne: false
            referencedRelation: "moderation_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_audit_log_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      grades: {
        Row: {
          ai_breakdown: Json | null
          ai_feedback: string | null
          ai_score: number | null
          assignment_type: string | null
          created_at: string
          final_feedback: string | null
          final_score: number | null
          grading_confidence: number | null
          grading_metadata: Json
          id: string
          lecturer_feedback: string | null
          lecturer_score: number | null
          reviewed_at: string | null
          reviewed_by: string | null
          submission_id: string
        }
        Insert: {
          ai_breakdown?: Json | null
          ai_feedback?: string | null
          ai_score?: number | null
          assignment_type?: string | null
          created_at?: string
          final_feedback?: string | null
          final_score?: number | null
          grading_confidence?: number | null
          grading_metadata?: Json
          id?: string
          lecturer_feedback?: string | null
          lecturer_score?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          submission_id: string
        }
        Update: {
          ai_breakdown?: Json | null
          ai_feedback?: string | null
          ai_score?: number | null
          assignment_type?: string | null
          created_at?: string
          final_feedback?: string | null
          final_score?: number | null
          grading_confidence?: number | null
          grading_metadata?: Json
          id?: string
          lecturer_feedback?: string | null
          lecturer_score?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grades_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      improvement_plan_progress: {
        Row: {
          completed: boolean
          completed_at: string | null
          id: string
          student_id: string
          task_key: string
          updated_at: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          id?: string
          student_id: string
          task_key: string
          updated_at?: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          id?: string
          student_id?: string
          task_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      moderation_cases: {
        Row: {
          ai_score_snapshot: number | null
          approved_at: string | null
          assignment_id: string
          confidence_score: number | null
          created_at: string
          final_agreed_feedback: string | null
          final_agreed_score: number | null
          first_marker_id: string | null
          first_marker_score: number | null
          grade_id: string | null
          id: string
          integrity_risk_score: number | null
          lecturer_id: string
          moderated_at: string | null
          moderator_id: string | null
          moderator_score: number | null
          status: string
          submission_id: string
          trigger_flags: Json
          trigger_summary: string | null
          updated_at: string
        }
        Insert: {
          ai_score_snapshot?: number | null
          approved_at?: string | null
          assignment_id: string
          confidence_score?: number | null
          created_at?: string
          final_agreed_feedback?: string | null
          final_agreed_score?: number | null
          first_marker_id?: string | null
          first_marker_score?: number | null
          grade_id?: string | null
          id?: string
          integrity_risk_score?: number | null
          lecturer_id: string
          moderated_at?: string | null
          moderator_id?: string | null
          moderator_score?: number | null
          status?: string
          submission_id: string
          trigger_flags?: Json
          trigger_summary?: string | null
          updated_at?: string
        }
        Update: {
          ai_score_snapshot?: number | null
          approved_at?: string | null
          assignment_id?: string
          confidence_score?: number | null
          created_at?: string
          final_agreed_feedback?: string | null
          final_agreed_score?: number | null
          first_marker_id?: string | null
          first_marker_score?: number | null
          grade_id?: string | null
          id?: string
          integrity_risk_score?: number | null
          lecturer_id?: string
          moderated_at?: string | null
          moderator_id?: string | null
          moderator_score?: number | null
          status?: string
          submission_id?: string
          trigger_flags?: Json
          trigger_summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderation_cases_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_cases_first_marker_id_fkey"
            columns: ["first_marker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_cases_grade_id_fkey"
            columns: ["grade_id"]
            isOneToOne: false
            referencedRelation: "grades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_cases_lecturer_id_fkey"
            columns: ["lecturer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_cases_moderator_id_fkey"
            columns: ["moderator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_cases_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: true
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_reviews: {
        Row: {
          action: string
          created_at: string
          id: string
          moderation_case_id: string
          notes: string | null
          proposed_feedback: string | null
          proposed_score: number | null
          reviewer_id: string
          reviewer_role: string
          snapshot: Json
          submission_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          moderation_case_id: string
          notes?: string | null
          proposed_feedback?: string | null
          proposed_score?: number | null
          reviewer_id: string
          reviewer_role: string
          snapshot?: Json
          submission_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          moderation_case_id?: string
          notes?: string | null
          proposed_feedback?: string | null
          proposed_score?: number | null
          reviewer_id?: string
          reviewer_role?: string
          snapshot?: Json
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderation_reviews_moderation_case_id_fkey"
            columns: ["moderation_case_id"]
            isOneToOne: false
            referencedRelation: "moderation_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_reviews_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          cohort_id: string | null
          created_at: string
          department_name: string | null
          department_id: string | null
          email: string | null
          full_name: string | null
          id: string
          must_change_password: boolean
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          cohort_id?: string | null
          created_at?: string
          department_name?: string | null
          department_id?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          must_change_password?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          cohort_id?: string | null
          created_at?: string
          department_name?: string | null
          department_id?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          must_change_password?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      recommendation_actions: {
        Row: {
          action_type: string
          created_at: string
          id: string
          lecturer_id: string
          payload: Json
          recommendation_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          id?: string
          lecturer_id: string
          payload?: Json
          recommendation_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          lecturer_id?: string
          payload?: Json
          recommendation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendation_actions_lecturer_id_fkey"
            columns: ["lecturer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendation_actions_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "analytics_recommendations"
            referencedColumns: ["id"]
          },
        ]
      }
      student_interventions: {
        Row: {
          assignment_id: string | null
          created_at: string
          follow_up_date: string | null
          id: string
          intervention_type: string
          lecturer_id: string
          notes: string | null
          priority: string
          status: string
          student_email: string | null
          student_id: string | null
          student_name: string
          title: string
          updated_at: string
        }
        Insert: {
          assignment_id?: string | null
          created_at?: string
          follow_up_date?: string | null
          id?: string
          intervention_type: string
          lecturer_id: string
          notes?: string | null
          priority?: string
          status?: string
          student_email?: string | null
          student_id?: string | null
          student_name: string
          title: string
          updated_at?: string
        }
        Update: {
          assignment_id?: string | null
          created_at?: string
          follow_up_date?: string | null
          id?: string
          intervention_type?: string
          lecturer_id?: string
          notes?: string | null
          priority?: string
          status?: string
          student_email?: string | null
          student_id?: string | null
          student_name?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      student_writing_profiles: {
        Row: {
          average_sentence_complexity: number
          baseline_vector: Json
          created_at: string
          error_fingerprint: Json
          id: string
          lexile_level: number
          sample_count: number
          student_id: string
          updated_at: string
          vocabulary_breadth: number
        }
        Insert: {
          average_sentence_complexity?: number
          baseline_vector?: Json
          created_at?: string
          error_fingerprint?: Json
          id?: string
          lexile_level?: number
          sample_count?: number
          student_id: string
          updated_at?: string
          vocabulary_breadth?: number
        }
        Update: {
          average_sentence_complexity?: number
          baseline_vector?: Json
          created_at?: string
          error_fingerprint?: Json
          id?: string
          lexile_level?: number
          sample_count?: number
          student_id?: string
          updated_at?: string
          vocabulary_breadth?: number
        }
        Relationships: [
          {
            foreignKeyName: "student_writing_profiles_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          assignment_id: string
          file_name: string
          file_type: string | null
          file_url: string
          id: string
          status: Database["public"]["Enums"]["submission_status"]
          student_email: string | null
          student_id: string | null
          student_name: string | null
          submitted_at: string
          uploaded_by: string
        }
        Insert: {
          assignment_id: string
          file_name: string
          file_type?: string | null
          file_url: string
          id?: string
          status?: Database["public"]["Enums"]["submission_status"]
          student_email?: string | null
          student_id?: string | null
          student_name?: string | null
          submitted_at?: string
          uploaded_by: string
        }
        Update: {
          assignment_id?: string
          file_name?: string
          file_type?: string | null
          file_url?: string
          id?: string
          status?: Database["public"]["Enums"]["submission_status"]
          student_email?: string | null
          student_id?: string | null
          student_name?: string | null
          submitted_at?: string
          uploaded_by?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_set_user_role: {
        Args: {
          p_target_role: Database["public"]["Enums"]["app_role"]
          p_target_user_id: string
        }
        Returns: {
          previous_role: string
          updated_role: string
          user_id: string
        }[]
      }
        apply_recommendation_action: {
          Args: {
            p_action_type: string
            p_payload?: Json
            p_recommendation_id: string
        }
        Returns: {
          assignment_id: string | null
          confidence: number
          created_at: string
          evidence: Json
          explanation: string
          id: string
          lecturer_id: string
          recommended_actions: Json
          rule_code: string
          severity: string
          status: string
          summary: string
          title: string
          type: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "analytics_recommendations"
          isOneToOne: true
          isSetofReturn: false
        }
        }
        get_student_grade_assignment_metadata: {
          Args: never
          Returns: {
            assignment_id: string
            max_score: number
            module_code: string | null
            submission_id: string
            title: string | null
          }[]
        }
        get_admin_dashboard_metrics: {
          Args: never
          Returns: {
            active_lecturers: number
            active_students: number
            high_integrity_risk_cases: number
            pending_moderation_cases: number
            total_assignments: number
            total_submissions: number
            total_users: number
          }[]
        }
        get_admin_assignment_oversight: {
          Args: never
          Returns: {
            created_at: string
            due_date: string | null
            graded_count: number
            id: string
            lecturer_name: string
            module_code: string | null
            released_count: number
            status: Database["public"]["Enums"]["assignment_status"]
            submission_count: number
            title: string
          }[]
        }
        get_admin_moderation_overview: {
          Args: never
          Returns: {
            assignment_title: string
            confidence_score: number | null
            created_at: string
            disagreement: boolean
            first_marker_name: string
            id: string
            integrity_risk_score: number | null
            moderator_name: string
            status: string
            trigger_summary: string | null
            updated_at: string
          }[]
        }
        get_admin_recent_activity: {
          Args: never
          Returns: {
            created_at: string
            detail: string
            id: string
            title: string
            tone: string
          }[]
        }
        get_student_submission_grade_projection: {
          Args: never
          Returns: {
            ai_breakdown: Json | null
            ai_feedback: string | null
            ai_score: number | null
            assignment_id: string
            assignment_title: string | null
            file_name: string
            file_url: string
            final_feedback: string | null
            final_score: number | null
            max_score: number | null
            module_code: string | null
            submission_id: string
            submission_status: Database["public"]["Enums"]["submission_status"]
            submitted_at: string
          }[]
        }
        has_role: {
          Args: {
            _role: Database["public"]["Enums"]["app_role"]
            _user_id: string
          }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_lecturer: { Args: never; Returns: boolean }
      is_student: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "lecturer" | "student" | "admin"
      assignment_status: "draft" | "published" | "closed"
      submission_status:
        | "submitted"
        | "ai_grading"
        | "ai_graded"
        | "under_review"
        | "approved"
        | "released"
        | "first_review"
        | "moderation_pending"
        | "moderation_in_progress"
        | "moderated"
        | "escalated"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["lecturer", "student", "admin"],
      assignment_status: ["draft", "published", "closed"],
      submission_status: [
        "submitted",
        "ai_grading",
        "ai_graded",
        "under_review",
        "approved",
        "released",
        "first_review",
        "moderation_pending",
        "moderation_in_progress",
        "moderated",
        "escalated",
      ],
    },
  },
} as const

