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
      applications: {
        Row: {
          amount: number | null
          applied_date: string | null
          contact: string | null
          created_at: string
          deadline: string | null
          group_id: string | null
          id: string
          kind: string
          link: string | null
          location: string | null
          notes: string | null
          organization: string | null
          reminder_at: string | null
          reminder_days_before: number | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          applied_date?: string | null
          contact?: string | null
          created_at?: string
          deadline?: string | null
          group_id?: string | null
          id?: string
          kind?: string
          link?: string | null
          location?: string | null
          notes?: string | null
          organization?: string | null
          reminder_at?: string | null
          reminder_days_before?: number | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number | null
          applied_date?: string | null
          contact?: string | null
          created_at?: string
          deadline?: string | null
          group_id?: string | null
          id?: string
          kind?: string
          link?: string | null
          location?: string | null
          notes?: string | null
          organization?: string | null
          reminder_at?: string | null
          reminder_days_before?: number | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_items: {
        Row: {
          budget_id: string
          created_at: string
          id: string
          name: string
          planned_amount: number
          purchased: boolean
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          budget_id: string
          created_at?: string
          id?: string
          name: string
          planned_amount?: number
          purchased?: boolean
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          budget_id?: string
          created_at?: string
          id?: string
          name?: string
          planned_amount?: number
          purchased?: boolean
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      budgets: {
        Row: {
          auto_renew: boolean
          category_id: string | null
          created_at: string
          id: string
          month: string | null
          monthly_limit: number
          name: string | null
          period_end: string | null
          period_start: string | null
          recurrence: string
          user_id: string
        }
        Insert: {
          auto_renew?: boolean
          category_id?: string | null
          created_at?: string
          id?: string
          month?: string | null
          monthly_limit: number
          name?: string | null
          period_end?: string | null
          period_start?: string | null
          recurrence?: string
          user_id: string
        }
        Update: {
          auto_renew?: boolean
          category_id?: string | null
          created_at?: string
          id?: string
          month?: string | null
          monthly_limit?: number
          name?: string | null
          period_end?: string | null
          period_start?: string | null
          recurrence?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          name: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      cost_providers: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          is_active: boolean
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      cost_tiers: {
        Row: {
          created_at: string
          fee: number
          id: string
          max_amount: number
          min_amount: number
          provider_id: string
          tx_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          fee: number
          id?: string
          max_amount: number
          min_amount: number
          provider_id: string
          tx_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          fee?: number
          id?: string
          max_amount?: number
          min_amount?: number
          provider_id?: string
          tx_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_tiers_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "cost_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      group_invites: {
        Row: {
          active: boolean
          code: string
          created_at: string
          created_by: string
          expires_at: string | null
          group_id: string
          id: string
          max_uses: number | null
          uses: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          group_id: string
          id?: string
          max_uses?: number | null
          uses?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          group_id?: string
          id?: string
          max_uses?: number | null
          uses?: number
        }
        Relationships: [
          {
            foreignKeyName: "group_invites_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          created_at: string
          display_name: string | null
          group_id: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          group_id: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          group_id?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          emoji: string | null
          id: string
          kind: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          emoji?: string | null
          id?: string
          kind?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          emoji?: string | null
          id?: string
          kind?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      pending_recurring: {
        Row: {
          created_at: string
          due_date: string
          id: string
          rule_id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          due_date: string
          id?: string
          rule_id: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          due_date?: string
          id?: string
          rule_id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          currency: string
          display_name: string | null
          feature_focus: string
          fiscal_month_start_day: number
          fiscal_year_start_month: number
          id: string
          modules: string[]
          notify_applications: boolean
          notify_budgets: boolean
          notify_email: boolean
          notify_recurring: boolean
          notify_tasks: boolean
          onboarded: boolean
          reminder_lead_minutes: number
          theme: string
          tour_completed: boolean
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          currency?: string
          display_name?: string | null
          feature_focus?: string
          fiscal_month_start_day?: number
          fiscal_year_start_month?: number
          id: string
          modules?: string[]
          notify_applications?: boolean
          notify_budgets?: boolean
          notify_email?: boolean
          notify_recurring?: boolean
          notify_tasks?: boolean
          onboarded?: boolean
          reminder_lead_minutes?: number
          theme?: string
          tour_completed?: boolean
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          currency?: string
          display_name?: string | null
          feature_focus?: string
          fiscal_month_start_day?: number
          fiscal_year_start_month?: number
          id?: string
          modules?: string[]
          notify_applications?: boolean
          notify_budgets?: boolean
          notify_email?: boolean
          notify_recurring?: boolean
          notify_tasks?: boolean
          onboarded?: boolean
          reminder_lead_minutes?: number
          theme?: string
          tour_completed?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      recurring_rules: {
        Row: {
          active: boolean
          align_fiscal: boolean
          amount: number
          category_id: string | null
          created_at: string
          description: string
          frequency: string
          id: string
          method: string | null
          next_due: string
          start_date: string
          task_id: string | null
          type: string
          until_date: string | null
          user_id: string
          wallet_id: string | null
        }
        Insert: {
          active?: boolean
          align_fiscal?: boolean
          amount: number
          category_id?: string | null
          created_at?: string
          description: string
          frequency: string
          id?: string
          method?: string | null
          next_due?: string
          start_date?: string
          task_id?: string | null
          type: string
          until_date?: string | null
          user_id: string
          wallet_id?: string | null
        }
        Update: {
          active?: boolean
          align_fiscal?: boolean
          amount?: number
          category_id?: string | null
          created_at?: string
          description?: string
          frequency?: string
          id?: string
          method?: string | null
          next_due?: string
          start_date?: string
          task_id?: string | null
          type?: string
          until_date?: string | null
          user_id?: string
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recurring_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_rules_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      savings_contributions: {
        Row: {
          amount: number
          created_at: string
          date: string
          goal_id: string
          group_id: string | null
          id: string
          note: string | null
          user_id: string
          wallet_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          date?: string
          goal_id: string
          group_id?: string | null
          id?: string
          note?: string | null
          user_id: string
          wallet_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          goal_id?: string
          group_id?: string | null
          id?: string
          note?: string | null
          user_id?: string
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "savings_contributions_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "savings_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "savings_contributions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      savings_goals: {
        Row: {
          completed: boolean
          created_at: string
          deadline: string | null
          group_id: string | null
          icon: string | null
          id: string
          name: string
          repository_type: string | null
          target_amount: number
          user_id: string
          wallet_id: string | null
        }
        Insert: {
          completed?: boolean
          created_at?: string
          deadline?: string | null
          group_id?: string | null
          icon?: string | null
          id?: string
          name: string
          repository_type?: string | null
          target_amount: number
          user_id: string
          wallet_id?: string | null
        }
        Update: {
          completed?: boolean
          created_at?: string
          deadline?: string | null
          group_id?: string | null
          icon?: string | null
          id?: string
          name?: string
          repository_type?: string | null
          target_amount?: number
          user_id?: string
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "savings_goals_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      subtasks: {
        Row: {
          created_at: string
          done: boolean
          id: string
          task_id: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          done?: boolean
          id?: string
          task_id: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          done?: boolean
          id?: string
          task_id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subtasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_assignees: {
        Row: {
          assigned_by: string
          created_at: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          assigned_by: string
          created_at?: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          assigned_by?: string
          created_at?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignees_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          group_id: string | null
          id: string
          labels: string[]
          linked_transaction_id: string | null
          planned_cost: number | null
          priority: string
          reminder_minutes: number | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          group_id?: string | null
          id?: string
          labels?: string[]
          linked_transaction_id?: string | null
          planned_cost?: number | null
          priority?: string
          reminder_minutes?: number | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          group_id?: string | null
          id?: string
          labels?: string[]
          linked_transaction_id?: string | null
          planned_cost?: number | null
          priority?: string
          reminder_minutes?: number | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_linked_transaction_id_fkey"
            columns: ["linked_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          date: string
          description: string
          fee: number
          id: string
          method: string | null
          note: string | null
          recurring_rule_id: string | null
          task_id: string | null
          to_wallet_id: string | null
          transfer_group: string | null
          type: string
          user_id: string
          wallet_id: string | null
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          date?: string
          description: string
          fee?: number
          id?: string
          method?: string | null
          note?: string | null
          recurring_rule_id?: string | null
          task_id?: string | null
          to_wallet_id?: string | null
          transfer_group?: string | null
          type: string
          user_id: string
          wallet_id?: string | null
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          date?: string
          description?: string
          fee?: number
          id?: string
          method?: string | null
          note?: string | null
          recurring_rule_id?: string | null
          task_id?: string | null
          to_wallet_id?: string | null
          transfer_group?: string | null
          type?: string
          user_id?: string
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_to_wallet_id_fkey"
            columns: ["to_wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          created_at: string
          id: string
          name: string
          opening_balance: number
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          opening_balance?: number
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          opening_balance?: number
          type?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_group_invite: { Args: { _code: string }; Returns: string }
      is_group_admin: {
        Args: { _group: string; _user: string }
        Returns: boolean
      }
      is_group_member: {
        Args: { _group: string; _user: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
