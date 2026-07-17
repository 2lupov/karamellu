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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      bookings: {
        Row: {
          client_name: string
          client_phone: string
          created_at: string
          duration_minutes: number
          id: string
          master_id: string
          notes: string | null
          price: number | null
          price_variant_label: string | null
          scheduled_at: string
          service_id: string
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string
        }
        Insert: {
          client_name: string
          client_phone: string
          created_at?: string
          duration_minutes: number
          id?: string
          master_id: string
          notes?: string | null
          price?: number | null
          price_variant_label?: string | null
          scheduled_at: string
          service_id: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
        }
        Update: {
          client_name?: string
          client_phone?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          master_id?: string
          notes?: string | null
          price?: number | null
          price_variant_label?: string | null
          scheduled_at?: string
          service_id?: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_master_id_fkey"
            columns: ["master_id"]
            isOneToOne: false
            referencedRelation: "masters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_products: {
        Row: {
          barcode: string
          brand: string | null
          category_id: string | null
          created_at: string
          created_by_shop_id: string | null
          created_by_user_id: string | null
          description: string | null
          id: string
          image_hover: string | null
          image_url: string | null
          ingredients: string | null
          name: string
          skin_type: string | null
          updated_at: string
          usage_instructions: string | null
          verified: boolean
        }
        Insert: {
          barcode: string
          brand?: string | null
          category_id?: string | null
          created_at?: string
          created_by_shop_id?: string | null
          created_by_user_id?: string | null
          description?: string | null
          id?: string
          image_hover?: string | null
          image_url?: string | null
          ingredients?: string | null
          name: string
          skin_type?: string | null
          updated_at?: string
          usage_instructions?: string | null
          verified?: boolean
        }
        Update: {
          barcode?: string
          brand?: string | null
          category_id?: string | null
          created_at?: string
          created_by_shop_id?: string | null
          created_by_user_id?: string | null
          description?: string | null
          id?: string
          image_hover?: string | null
          image_url?: string | null
          ingredients?: string | null
          name?: string
          skin_type?: string | null
          updated_at?: string
          usage_instructions?: string | null
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "catalog_products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_products_created_by_shop_id_fkey"
            columns: ["created_by_shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          slug: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          slug: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          slug?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      client_bot_links: {
        Row: {
          chat_id: number
          created_at: string
          phone: string | null
          tg_first_name: string | null
          tg_username: string | null
          updated_at: string
        }
        Insert: {
          chat_id: number
          created_at?: string
          phone?: string | null
          tg_first_name?: string | null
          tg_username?: string | null
          updated_at?: string
        }
        Update: {
          chat_id?: number
          created_at?: string
          phone?: string | null
          tg_first_name?: string | null
          tg_username?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      master_schedule: {
        Row: {
          end_time: string
          id: string
          is_working: boolean
          master_id: string
          start_time: string
          weekday: number
        }
        Insert: {
          end_time?: string
          id?: string
          is_working?: boolean
          master_id: string
          start_time?: string
          weekday: number
        }
        Update: {
          end_time?: string
          id?: string
          is_working?: boolean
          master_id?: string
          start_time?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "master_schedule_master_id_fkey"
            columns: ["master_id"]
            isOneToOne: false
            referencedRelation: "masters"
            referencedColumns: ["id"]
          },
        ]
      }
      masters: {
        Row: {
          bio: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          order_index: number
          photo_url: string | null
          specialties: string[]
          updated_at: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          order_index?: number
          photo_url?: string | null
          specialties?: string[]
          updated_at?: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          order_index?: number
          photo_url?: string | null
          specialties?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          price: number
          product_brand: string
          product_id: string | null
          product_image: string | null
          product_name: string
          quantity: number
          total: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          price: number
          product_brand: string
          product_id?: string | null
          product_image?: string | null
          product_name: string
          quantity?: number
          total: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          price?: number
          product_brand?: string
          product_id?: string | null
          product_image?: string | null
          product_name?: string
          quantity?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address: string
          city: string
          created_at: string
          delivery_method: Database["public"]["Enums"]["delivery_method"]
          discount: number
          email: string | null
          first_name: string
          id: string
          last_name: string
          monobank_invoice_id: string | null
          notes: string | null
          nova_poshta_warehouse: string | null
          np_city_ref: string | null
          np_warehouse_type: string | null
          order_number: number
          payment_method: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          phone: string
          postal_code: string | null
          shipping_cost: number
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address: string
          city: string
          created_at?: string
          delivery_method?: Database["public"]["Enums"]["delivery_method"]
          discount?: number
          email?: string | null
          first_name: string
          id?: string
          last_name: string
          monobank_invoice_id?: string | null
          notes?: string | null
          nova_poshta_warehouse?: string | null
          np_city_ref?: string | null
          np_warehouse_type?: string | null
          order_number?: number
          payment_method?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          phone: string
          postal_code?: string | null
          shipping_cost?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string
          city?: string
          created_at?: string
          delivery_method?: Database["public"]["Enums"]["delivery_method"]
          discount?: number
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          monobank_invoice_id?: string | null
          notes?: string | null
          nova_poshta_warehouse?: string | null
          np_city_ref?: string | null
          np_warehouse_type?: string | null
          order_number?: number
          payment_method?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          phone?: string
          postal_code?: string | null
          shipping_cost?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          barcode: string | null
          best_seller: boolean | null
          brand: string
          category_id: string | null
          cost_price: number
          created_at: string
          description: string | null
          id: string
          image: string | null
          image_hover: string | null
          ingredients: string | null
          is_active: boolean | null
          name: string
          price: number
          promo_photo: string | null
          promo_video: string | null
          rating: number | null
          review_count: number | null
          skin_type: string | null
          stock_quantity: number
          updated_at: string
          usage_instructions: string | null
        }
        Insert: {
          barcode?: string | null
          best_seller?: boolean | null
          brand?: string
          category_id?: string | null
          cost_price?: number
          created_at?: string
          description?: string | null
          id?: string
          image?: string | null
          image_hover?: string | null
          ingredients?: string | null
          is_active?: boolean | null
          name: string
          price?: number
          promo_photo?: string | null
          promo_video?: string | null
          rating?: number | null
          review_count?: number | null
          skin_type?: string | null
          stock_quantity?: number
          updated_at?: string
          usage_instructions?: string | null
        }
        Update: {
          barcode?: string | null
          best_seller?: boolean | null
          brand?: string
          category_id?: string | null
          cost_price?: number
          created_at?: string
          description?: string | null
          id?: string
          image?: string | null
          image_hover?: string | null
          ingredients?: string | null
          is_active?: boolean | null
          name?: string
          price?: number
          promo_photo?: string | null
          promo_video?: string | null
          rating?: number | null
          review_count?: number | null
          skin_type?: string | null
          stock_quantity?: number
          updated_at?: string
          usage_instructions?: string | null
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
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          city: string | null
          country: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          postal_code: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          postal_code?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          postal_code?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          code: string
          created_at: string | null
          current_uses: number | null
          discount_type: string
          expires_at: string | null
          id: string
          is_active: boolean | null
          max_uses: number | null
          min_order: number | null
          updated_at: string | null
          value: number
        }
        Insert: {
          code: string
          created_at?: string | null
          current_uses?: number | null
          discount_type?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          min_order?: number | null
          updated_at?: string | null
          value?: number
        }
        Update: {
          code?: string
          created_at?: string | null
          current_uses?: number | null
          discount_type?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          min_order?: number | null
          updated_at?: string | null
          value?: number
        }
        Relationships: []
      }
      service_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          order_index: number
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          order_index?: number
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          order_index?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          category_id: string
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          is_active: boolean
          name: string
          order_index: number
          price_variants: Json
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          name: string
          order_index?: number
          price_variants?: Json
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          name?: string
          order_index?: number
          price_variants?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_inventory: {
        Row: {
          barcode: string
          catalog_product_id: string
          cost_price: number | null
          created_at: string
          custom_name: string | null
          id: string
          is_active: boolean
          price: number | null
          shop_id: string
          stock_quantity: number
          updated_at: string
        }
        Insert: {
          barcode: string
          catalog_product_id: string
          cost_price?: number | null
          created_at?: string
          custom_name?: string | null
          id?: string
          is_active?: boolean
          price?: number | null
          shop_id: string
          stock_quantity?: number
          updated_at?: string
        }
        Update: {
          barcode?: string
          catalog_product_id?: string
          cost_price?: number | null
          created_at?: string
          custom_name?: string | null
          id?: string
          is_active?: boolean
          price?: number | null
          shop_id?: string
          stock_quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_inventory_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_inventory_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_members: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["shop_role"]
          shop_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["shop_role"]
          shop_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["shop_role"]
          shop_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_members_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shops: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_user_id: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_user_id?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_user_id?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      telegram_auth_codes: {
        Row: {
          code: string
          created_at: string | null
          expires_at: string
          id: string
          telegram_first_name: string | null
          telegram_user_id: number
          telegram_username: string | null
          used: boolean | null
        }
        Insert: {
          code: string
          created_at?: string | null
          expires_at: string
          id?: string
          telegram_first_name?: string | null
          telegram_user_id: number
          telegram_username?: string | null
          used?: boolean | null
        }
        Update: {
          code?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          telegram_first_name?: string | null
          telegram_user_id?: number
          telegram_username?: string | null
          used?: boolean | null
        }
        Relationships: []
      }
      telegram_bot_last_messages: {
        Row: {
          chat_id: number
          message_ids: number[]
          updated_at: string
        }
        Insert: {
          chat_id: number
          message_ids?: number[]
          updated_at?: string
        }
        Update: {
          chat_id?: number
          message_ids?: number[]
          updated_at?: string
        }
        Relationships: []
      }
      telegram_registration_state: {
        Row: {
          chat_id: number
          created_at: string
          nickname: string | null
          step: string
          updated_at: string
        }
        Insert: {
          chat_id: number
          created_at?: string
          nickname?: string | null
          step?: string
          updated_at?: string
        }
        Update: {
          chat_id?: number
          created_at?: string
          nickname?: string | null
          step?: string
          updated_at?: string
        }
        Relationships: []
      }
      telegram_users: {
        Row: {
          created_at: string | null
          id: string
          telegram_first_name: string | null
          telegram_user_id: number
          telegram_username: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          telegram_first_name?: string | null
          telegram_user_id: number
          telegram_username?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          telegram_first_name?: string | null
          telegram_user_id?: number
          telegram_username?: string | null
          updated_at?: string | null
          user_id?: string
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
      video_generations: {
        Row: {
          chat_id: number
          created_at: string
          id: string
          operation_name: string
          product_id: string
          status: string
        }
        Insert: {
          chat_id: number
          created_at?: string
          id?: string
          operation_name: string
          product_id: string
          status?: string
        }
        Update: {
          chat_id?: number
          created_at?: string
          id?: string
          operation_name?: string
          product_id?: string
          status?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_busy_intervals: {
        Args: { _date: string; _master_id: string }
        Returns: {
          end_at: string
          start_at: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_shop_role: {
        Args: {
          _roles: Database["public"]["Enums"]["shop_role"][]
          _shop_id: string
          _user_id: string
        }
        Returns: boolean
      }
      is_any_shop_member: { Args: { _user_id: string }; Returns: boolean }
      is_shop_member: {
        Args: { _shop_id: string; _user_id: string }
        Returns: boolean
      }
      make_first_admin: { Args: never; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      booking_status: "pending" | "confirmed" | "completed" | "cancelled"
      delivery_method:
        | "nova_poshta"
        | "ukrposhta"
        | "courier"
        | "pickup"
        | "khmelnytskyi"
      order_status:
        | "new"
        | "confirmed"
        | "processing"
        | "shipped"
        | "delivered"
        | "returned"
        | "cancelled"
      payment_status: "pending" | "paid" | "failed" | "refunded"
      shop_role: "owner" | "admin" | "staff"
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
      app_role: ["admin", "moderator", "user"],
      booking_status: ["pending", "confirmed", "completed", "cancelled"],
      delivery_method: [
        "nova_poshta",
        "ukrposhta",
        "courier",
        "pickup",
        "khmelnytskyi",
      ],
      order_status: [
        "new",
        "confirmed",
        "processing",
        "shipped",
        "delivered",
        "returned",
        "cancelled",
      ],
      payment_status: ["pending", "paid", "failed", "refunded"],
      shop_role: ["owner", "admin", "staff"],
    },
  },
} as const
