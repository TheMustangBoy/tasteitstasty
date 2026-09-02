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
      admin_users: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          label: string
          note: string
          paused: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          label: string
          note?: string
          paused?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          note?: string
          paused?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      extras: {
        Row: {
          created_at: string
          id: string
          name: string
          price: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          name: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      ingredients: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      opening_hours: {
        Row: {
          close_time: string
          closed: boolean
          created_at: string
          open_time: string
          updated_at: string
          weekday: number
        }
        Insert: {
          close_time?: string
          closed?: boolean
          created_at?: string
          open_time?: string
          updated_at?: string
          weekday: number
        }
        Update: {
          close_time?: string
          closed?: boolean
          created_at?: string
          open_time?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: []
      }
      orders: {
        Row: {
          cancel_note: string | null
          cancel_reason: string | null
          created_at: string
          customer_name: string
          id: string
          internal_note: string
          lines: Json
          note: string
          payment: string
          phone: string
          pickup_at: string
          pickup_label: string
          reference: string
          status: string
          status_timestamps: Json
          total: number
          updated_at: string
        }
        Insert: {
          cancel_note?: string | null
          cancel_reason?: string | null
          created_at?: string
          customer_name?: string
          id?: string
          internal_note?: string
          lines?: Json
          note?: string
          payment?: string
          phone?: string
          pickup_at: string
          pickup_label?: string
          reference: string
          status?: string
          status_timestamps?: Json
          total?: number
          updated_at?: string
        }
        Update: {
          cancel_note?: string | null
          cancel_reason?: string | null
          created_at?: string
          customer_name?: string
          id?: string
          internal_note?: string
          lines?: Json
          note?: string
          payment?: string
          phone?: string
          pickup_at?: string
          pickup_label?: string
          reference?: string
          status?: string
          status_timestamps?: Json
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          active: boolean
          category_id: string
          created_at: string
          description: string
          extra_ids: string[]
          id: string
          image_url: string
          ingredients: string[]
          ingredients_placeholder: boolean
          name: string
          options: Json
          patties: number | null
          price: number
          removable: string[]
          sold_out: boolean
          sort_order: number
          tag: string
          updated_at: string
          vegetarian: boolean
        }
        Insert: {
          active?: boolean
          category_id: string
          created_at?: string
          description?: string
          extra_ids?: string[]
          id: string
          image_url?: string
          ingredients?: string[]
          ingredients_placeholder?: boolean
          name: string
          options?: Json
          patties?: number | null
          price?: number
          removable?: string[]
          sold_out?: boolean
          sort_order?: number
          tag?: string
          updated_at?: string
          vegetarian?: boolean
        }
        Update: {
          active?: boolean
          category_id?: string
          created_at?: string
          description?: string
          extra_ids?: string[]
          id?: string
          image_url?: string
          ingredients?: string[]
          ingredients_placeholder?: boolean
          name?: string
          options?: Json
          patties?: number | null
          price?: number
          removable?: string[]
          sold_out?: boolean
          sort_order?: number
          tag?: string
          updated_at?: string
          vegetarian?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_settings: {
        Row: {
          created_at: string
          id: number
          max_orders_per_slot: number
          min_lead_minutes: number
          orders_paused: boolean
          updated_at: string
          wheel_sound_on: boolean
        }
        Insert: {
          created_at?: string
          id?: number
          max_orders_per_slot?: number
          min_lead_minutes?: number
          orders_paused?: boolean
          updated_at?: string
          wheel_sound_on?: boolean
        }
        Update: {
          created_at?: string
          id?: number
          max_orders_per_slot?: number
          min_lead_minutes?: number
          orders_paused?: boolean
          updated_at?: string
          wheel_sound_on?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_slot_bookings: {
        Args: never
        Returns: {
          bookings: number
          pickup_at: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      place_order: {
        Args: {
          p_customer_name: string
          p_lines: Json
          p_note?: string
          p_payment: string
          p_phone: string
          p_pickup_at: string
          p_pickup_label: string
          p_reference: string
          p_total: number
        }
        Returns: {
          cancel_note: string | null
          cancel_reason: string | null
          created_at: string
          customer_name: string
          id: string
          internal_note: string
          lines: Json
          note: string
          payment: string
          phone: string
          pickup_at: string
          pickup_label: string
          reference: string
          status: string
          status_timestamps: Json
          total: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
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
