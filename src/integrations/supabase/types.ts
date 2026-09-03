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
          checkout_key: string | null
          created_at: string
          customer_name: string
          customer_status_token: string | null
          id: string
          internal_note: string
          lines: Json
          note: string
          paid_at: string | null
          payment: string
          payment_provider: string | null
          payment_status: string | null
          phone: string
          pickup_at: string
          pickup_label: string
          reference: string
          status: string
          status_timestamps: Json
          stripe_payment_intent_id: string | null
          total: number
          updated_at: string
        }
        Insert: {
          cancel_note?: string | null
          cancel_reason?: string | null
          checkout_key?: string | null
          created_at?: string
          customer_name?: string
          customer_status_token?: string | null
          id?: string
          internal_note?: string
          lines?: Json
          note?: string
          paid_at?: string | null
          payment?: string
          payment_provider?: string | null
          payment_status?: string | null
          phone?: string
          pickup_at: string
          pickup_label?: string
          reference: string
          status?: string
          status_timestamps?: Json
          stripe_payment_intent_id?: string | null
          total?: number
          updated_at?: string
        }
        Update: {
          cancel_note?: string | null
          cancel_reason?: string | null
          checkout_key?: string | null
          created_at?: string
          customer_name?: string
          customer_status_token?: string | null
          id?: string
          internal_note?: string
          lines?: Json
          note?: string
          paid_at?: string | null
          payment?: string
          payment_provider?: string | null
          payment_status?: string | null
          phone?: string
          pickup_at?: string
          pickup_label?: string
          reference?: string
          status?: string
          status_timestamps?: Json
          stripe_payment_intent_id?: string | null
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      payment_reservations: {
        Row: {
          checkout_key: string | null
          created_at: string
          currency: string
          customer_name: string
          expires_at: string
          final_order_id: string | null
          id: string
          last_error: string | null
          lines: Json
          note: string
          phone: string
          pickup_at: string
          pickup_label: string
          reference: string
          status: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          token: string
          total: number
          updated_at: string
        }
        Insert: {
          checkout_key?: string | null
          created_at?: string
          currency?: string
          customer_name?: string
          expires_at: string
          final_order_id?: string | null
          id?: string
          last_error?: string | null
          lines?: Json
          note?: string
          phone?: string
          pickup_at: string
          pickup_label?: string
          reference: string
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          token: string
          total?: number
          updated_at?: string
        }
        Update: {
          checkout_key?: string | null
          created_at?: string
          currency?: string
          customer_name?: string
          expires_at?: string
          final_order_id?: string | null
          id?: string
          last_error?: string | null
          lines?: Json
          note?: string
          phone?: string
          pickup_at?: string
          pickup_label?: string
          reference?: string
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          token?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_reservations_final_order_id_fkey"
            columns: ["final_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
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
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string
          user_id?: string
        }
        Relationships: []
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
      assert_slot_capacity: {
        Args: { p_pickup_at: string }
        Returns: undefined
      }
      attach_payment_intent: {
        Args: { p_payment_intent_id: string; p_reservation_id: string }
        Returns: undefined
      }
      create_payment_reservation: {
        Args: {
          p_checkout_key: string
          p_customer_name: string
          p_lines: Json
          p_note?: string
          p_phone: string
          p_pickup_at: string
          p_pickup_label: string
          p_token: string
          p_total: number
          p_ttl_minutes?: number
        }
        Returns: {
          checkout_key: string | null
          created_at: string
          currency: string
          customer_name: string
          expires_at: string
          final_order_id: string | null
          id: string
          last_error: string | null
          lines: Json
          note: string
          phone: string
          pickup_at: string
          pickup_label: string
          reference: string
          status: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          token: string
          total: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "payment_reservations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_ingredient: {
        Args: { p_id: string; p_name: string }
        Returns: number
      }
      finalize_payment_reservation: {
        Args: {
          p_amount_cents: number
          p_currency: string
          p_payment_intent_id: string
          p_reservation_id: string
        }
        Returns: {
          cancel_note: string | null
          cancel_reason: string | null
          checkout_key: string | null
          created_at: string
          customer_name: string
          customer_status_token: string | null
          id: string
          internal_note: string
          lines: Json
          note: string
          paid_at: string | null
          payment: string
          payment_provider: string | null
          payment_status: string | null
          phone: string
          pickup_at: string
          pickup_label: string
          reference: string
          status: string
          status_timestamps: Json
          stripe_payment_intent_id: string | null
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
      get_slot_bookings: {
        Args: never
        Returns: {
          bookings: number
          pickup_at: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      mark_payment_reservation: {
        Args: { p_error?: string; p_reservation_id: string; p_status: string }
        Returns: undefined
      }
      mark_refunded_by_payment_intent: {
        Args: { p_payment_intent_id: string }
        Returns: boolean
      }
      next_order_reference: { Args: never; Returns: string }
      note_payment_failure: {
        Args: { p_error: string; p_reservation_id: string }
        Returns: undefined
      }
      place_order: {
        Args: {
          p_checkout_key?: string
          p_customer_name: string
          p_lines: Json
          p_note?: string
          p_payment: string
          p_phone: string
          p_pickup_at: string
          p_pickup_label: string
          p_reference: string
          p_status_token?: string
          p_total: number
        }
        Returns: {
          cancel_note: string | null
          cancel_reason: string | null
          checkout_key: string | null
          created_at: string
          customer_name: string
          customer_status_token: string | null
          id: string
          internal_note: string
          lines: Json
          note: string
          paid_at: string | null
          payment: string
          payment_provider: string | null
          payment_status: string | null
          phone: string
          pickup_at: string
          pickup_label: string
          reference: string
          status: string
          status_timestamps: Json
          stripe_payment_intent_id: string | null
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
      rename_ingredient: {
        Args: {
          p_id: string
          p_new_name: string
          p_old_name: string
          p_sort_order?: number
        }
        Returns: number
      }
      slot_has_capacity_excluding: {
        Args: { p_pickup_at: string; p_reservation_id: string }
        Returns: boolean
      }
      validate_order_payload: {
        Args: { p_lines: Json; p_pickup_at: string; p_total: number }
        Returns: Json
      }
      verify_push_hook_secret: { Args: { p_secret: string }; Returns: boolean }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
