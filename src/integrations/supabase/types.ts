export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
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
      grades: {
        Row: {
          ai_breakdown: Json | null
          ai_feedback: string | null
          ai_score: number | null
          created_at: string
          final_feedback: string | null
          final_score: number | null
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
          created_at?: string
          final_feedback?: string | null
          final_score?: number | null
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
          created_at?: string
          final_feedback?: string | null
          final_score?: number | null
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
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_lecturer: { Args: never; Returns: boolean }
      is_student: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "lecturer" | "student"
      assignment_status: "draft" | "published" | "closed"
      submission_status:
        | "submitted"
        | "ai_grading"
        | "ai_graded"
        | "under_review"
        | "approved"
        | "released"
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
  public: {
    Enums: {
      app_role: ["lecturer", "student"],
      assignment_status: ["draft", "published", "closed"],
      submission_status: [
        "submitted",
        "ai_grading",
        "ai_graded",
        "under_review",
        "approved",
        "released",
      ],
    },
  },
} as const
