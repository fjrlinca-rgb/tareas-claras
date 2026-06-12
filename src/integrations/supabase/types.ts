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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      actividades_tecnicas: {
        Row: {
          created_at: string
          descripcion: string | null
          estado: string
          fecha_fin: string | null
          fecha_inicio: string
          id: string
          observaciones: string | null
          tecnico_email: string | null
          tecnico_id: string
          tiempo_total_segundos: number | null
          tiempo_total_texto: string | null
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descripcion?: string | null
          estado?: string
          fecha_fin?: string | null
          fecha_inicio?: string
          id?: string
          observaciones?: string | null
          tecnico_email?: string | null
          tecnico_id: string
          tiempo_total_segundos?: number | null
          tiempo_total_texto?: string | null
          tipo?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descripcion?: string | null
          estado?: string
          fecha_fin?: string | null
          fecha_inicio?: string
          id?: string
          observaciones?: string | null
          tecnico_email?: string | null
          tecnico_id?: string
          tiempo_total_segundos?: number | null
          tiempo_total_texto?: string | null
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      attachments: {
        Row: {
          bucket: string
          created_at: string
          file_name: string
          id: string
          mime_type: string | null
          parent_id: string
          parent_type: string
          path: string
          size_bytes: number | null
          uploaded_by: string | null
          uploaded_by_email: string | null
        }
        Insert: {
          bucket: string
          created_at?: string
          file_name: string
          id?: string
          mime_type?: string | null
          parent_id: string
          parent_type: string
          path: string
          size_bytes?: number | null
          uploaded_by?: string | null
          uploaded_by_email?: string | null
        }
        Update: {
          bucket?: string
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          parent_id?: string
          parent_type?: string
          path?: string
          size_bytes?: number | null
          uploaded_by?: string | null
          uploaded_by_email?: string | null
        }
        Relationships: []
      }
      companies: {
        Row: {
          active: boolean
          contact: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string
          puede_crear_ordenes: boolean
          updated_at: string
        }
        Insert: {
          active?: boolean
          contact?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          puede_crear_ordenes?: boolean
          updated_at?: string
        }
        Update: {
          active?: boolean
          contact?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          puede_crear_ordenes?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      entradas: {
        Row: {
          assigned_technician: string | null
          created_at: string
          description: string | null
          fecha_finalizacion: string | null
          fecha_inicio_revision: string | null
          id: string
          observations: string | null
          priority: string
          status: string
          tiempo_resolucion_segundos: number | null
          tiempo_resolucion_texto: string | null
          title: string
          updated_at: string
          user_id: string
          visto_por_supervisor: boolean
          visto_por_tecnico: boolean
        }
        Insert: {
          assigned_technician?: string | null
          created_at?: string
          description?: string | null
          fecha_finalizacion?: string | null
          fecha_inicio_revision?: string | null
          id?: string
          observations?: string | null
          priority?: string
          status?: string
          tiempo_resolucion_segundos?: number | null
          tiempo_resolucion_texto?: string | null
          title: string
          updated_at?: string
          user_id: string
          visto_por_supervisor?: boolean
          visto_por_tecnico?: boolean
        }
        Update: {
          assigned_technician?: string | null
          created_at?: string
          description?: string | null
          fecha_finalizacion?: string | null
          fecha_inicio_revision?: string | null
          id?: string
          observations?: string | null
          priority?: string
          status?: string
          tiempo_resolucion_segundos?: number | null
          tiempo_resolucion_texto?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          visto_por_supervisor?: boolean
          visto_por_tecnico?: boolean
        }
        Relationships: []
      }
      historial_ordenes: {
        Row: {
          action: string
          changed_by: string | null
          changed_by_email: string | null
          created_at: string
          field: string | null
          id: string
          new_value: string | null
          old_value: string | null
          orden_id: string
        }
        Insert: {
          action: string
          changed_by?: string | null
          changed_by_email?: string | null
          created_at?: string
          field?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          orden_id: string
        }
        Update: {
          action?: string
          changed_by?: string | null
          changed_by_email?: string | null
          created_at?: string
          field?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          orden_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          finalized_at: string
          id: string
          kind: string
          message: string
          parent_id: string
          read: boolean
          technician_email: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          finalized_at?: string
          id?: string
          kind: string
          message: string
          parent_id: string
          read?: boolean
          technician_email?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          finalized_at?: string
          id?: string
          kind?: string
          message?: string
          parent_id?: string
          read?: boolean
          technician_email?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      ordenes_trabajo: {
        Row: {
          assigned_technician: string | null
          company_id: string | null
          created_at: string
          description: string | null
          evidencias: Json
          fecha_finalizacion: string | null
          fecha_inicio_revision: string | null
          id: string
          observations: string | null
          priority: string
          status: string
          tiempo_resolucion_segundos: number | null
          tiempo_resolucion_texto: string | null
          tipo: string
          title: string
          updated_at: string
          user_id: string
          visto_por_supervisor: boolean
          visto_por_tecnico: boolean
        }
        Insert: {
          assigned_technician?: string | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          evidencias?: Json
          fecha_finalizacion?: string | null
          fecha_inicio_revision?: string | null
          id?: string
          observations?: string | null
          priority?: string
          status?: string
          tiempo_resolucion_segundos?: number | null
          tiempo_resolucion_texto?: string | null
          tipo?: string
          title: string
          updated_at?: string
          user_id: string
          visto_por_supervisor?: boolean
          visto_por_tecnico?: boolean
        }
        Update: {
          assigned_technician?: string | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          evidencias?: Json
          fecha_finalizacion?: string | null
          fecha_inicio_revision?: string | null
          id?: string
          observations?: string | null
          priority?: string
          status?: string
          tiempo_resolucion_segundos?: number | null
          tiempo_resolucion_texto?: string | null
          tipo?: string
          title?: string
          updated_at?: string
          user_id?: string
          visto_por_supervisor?: boolean
          visto_por_tecnico?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ordenes_trabajo_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          company_id: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          username: string | null
        }
        Insert: {
          active?: boolean
          company_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          username?: string | null
        }
        Update: {
          active?: boolean
          company_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      reportes_diarios: {
        Row: {
          created_at: string
          criticos: number
          en_proceso: number
          en_revision: number
          fecha: string
          finalizados: number
          id: string
          pendientes: number
          prioridad_alta: number
          prioridad_baja: number
          prioridad_critica: number
          prioridad_media: number
          sla_cumplido_pct: number
          tickets_creados: number
          tickets_finalizados: number
          tickets_por_empresa: Json
          tickets_por_tecnico: Json
          tiempo_promedio_resolucion_horas: number
          total_tickets: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          criticos?: number
          en_proceso?: number
          en_revision?: number
          fecha: string
          finalizados?: number
          id?: string
          pendientes?: number
          prioridad_alta?: number
          prioridad_baja?: number
          prioridad_critica?: number
          prioridad_media?: number
          sla_cumplido_pct?: number
          tickets_creados?: number
          tickets_finalizados?: number
          tickets_por_empresa?: Json
          tickets_por_tecnico?: Json
          tiempo_promedio_resolucion_horas?: number
          total_tickets?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          criticos?: number
          en_proceso?: number
          en_revision?: number
          fecha?: string
          finalizados?: number
          id?: string
          pendientes?: number
          prioridad_alta?: number
          prioridad_baja?: number
          prioridad_critica?: number
          prioridad_media?: number
          sla_cumplido_pct?: number
          tickets_creados?: number
          tickets_finalizados?: number
          tickets_por_empresa?: Json
          tickets_por_tecnico?: Json
          tiempo_promedio_resolucion_horas?: number
          total_tickets?: number
          updated_at?: string
        }
        Relationships: []
      }
      technicians: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          email: string
          id: string
          name: string
          phone: string | null
          specialty: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
          name: string
          phone?: string | null
          specialty?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          name?: string
          phone?: string | null
          specialty?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ticket_history: {
        Row: {
          action: string
          changed_by: string | null
          changed_by_email: string | null
          created_at: string
          field: string | null
          id: string
          new_value: string | null
          old_value: string | null
          ticket_id: string
        }
        Insert: {
          action: string
          changed_by?: string | null
          changed_by_email?: string | null
          created_at?: string
          field?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          ticket_id: string
        }
        Update: {
          action?: string
          changed_by?: string | null
          changed_by_email?: string | null
          created_at?: string
          field?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_history_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "entradas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      can_access_parent: {
        Args: { _parent_id: string; _parent_type: string }
        Returns: boolean
      }
      format_duracion: { Args: { segundos: number }; Returns: string }
      generar_snapshot_diario: {
        Args: { fecha_objetivo?: string }
        Returns: {
          created_at: string
          criticos: number
          en_proceso: number
          en_revision: number
          fecha: string
          finalizados: number
          id: string
          pendientes: number
          prioridad_alta: number
          prioridad_baja: number
          prioridad_critica: number
          prioridad_media: number
          sla_cumplido_pct: number
          tickets_creados: number
          tickets_finalizados: number
          tickets_por_empresa: Json
          tickets_por_tecnico: Json
          tiempo_promedio_resolucion_horas: number
          total_tickets: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "reportes_diarios"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      puede_crear_ordenes: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "cliente" | "supervisor" | "tecnico"
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
      app_role: ["cliente", "supervisor", "tecnico"],
    },
  },
} as const
