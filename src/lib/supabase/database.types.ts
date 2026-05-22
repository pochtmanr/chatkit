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
      agent_sessions: {
        Row: {
          business_id: string
          created_at: string
          ended_at: string | null
          ended_reason: string | null
          id: string
          started_at: string
          status: string
          support_agent_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          ended_at?: string | null
          ended_reason?: string | null
          id?: string
          started_at?: string
          status?: string
          support_agent_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          ended_at?: string | null
          ended_reason?: string | null
          id?: string
          started_at?: string
          status?: string
          support_agent_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_sessions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_sessions_support_agent_id_fkey"
            columns: ["support_agent_id"]
            isOneToOne: false
            referencedRelation: "agent_presence_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_sessions_support_agent_id_fkey"
            columns: ["support_agent_id"]
            isOneToOne: false
            referencedRelation: "support_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_events: {
        Row: {
          business_id: string | null
          created_at: string
          id: string
          kind: string
          payload: Json
        }
        Insert: {
          business_id?: string | null
          created_at?: string
          id?: string
          kind: string
          payload: Json
        }
        Update: {
          business_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "billing_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          about: string | null
          address_line1: string | null
          address_line2: string | null
          allowed_origins: string[]
          city: string | null
          company_size: string | null
          contact_email: string | null
          contact_phone: string | null
          country: string | null
          created_at: string
          current_plan_id: string
          email_from: string | null
          hubspot_access_token: string | null
          hubspot_channel_account_email: string | null
          hubspot_channel_account_id: string | null
          hubspot_conversations_mode: boolean
          hubspot_custom_channel_id: string | null
          hubspot_inbox_id: string | null
          hubspot_owner_id: string | null
          hubspot_portal_id: string | null
          hubspot_refresh_token: string | null
          hubspot_token_expires_at: string | null
          hubspot_webhook_secret: string | null
          id: string
          industry: string | null
          integration_type: string
          logo_url: string | null
          name: string
          onboarding_completed_at: string | null
          owner_user_id: string
          plan: string
          plan_renews_at: string | null
          postal_code: string | null
          region: string | null
          revolut_customer_id: string | null
          revolut_subscription_id: string | null
          slug: string
          status: string
          updated_at: string
          website_url: string | null
        }
        Insert: {
          about?: string | null
          address_line1?: string | null
          address_line2?: string | null
          allowed_origins?: string[]
          city?: string | null
          company_size?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          current_plan_id?: string
          email_from?: string | null
          hubspot_access_token?: string | null
          hubspot_channel_account_email?: string | null
          hubspot_channel_account_id?: string | null
          hubspot_conversations_mode?: boolean
          hubspot_custom_channel_id?: string | null
          hubspot_inbox_id?: string | null
          hubspot_owner_id?: string | null
          hubspot_portal_id?: string | null
          hubspot_refresh_token?: string | null
          hubspot_token_expires_at?: string | null
          hubspot_webhook_secret?: string | null
          id?: string
          industry?: string | null
          integration_type?: string
          logo_url?: string | null
          name: string
          onboarding_completed_at?: string | null
          owner_user_id: string
          plan?: string
          plan_renews_at?: string | null
          postal_code?: string | null
          region?: string | null
          revolut_customer_id?: string | null
          revolut_subscription_id?: string | null
          slug: string
          status?: string
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          about?: string | null
          address_line1?: string | null
          address_line2?: string | null
          allowed_origins?: string[]
          city?: string | null
          company_size?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          current_plan_id?: string
          email_from?: string | null
          hubspot_access_token?: string | null
          hubspot_channel_account_email?: string | null
          hubspot_channel_account_id?: string | null
          hubspot_conversations_mode?: boolean
          hubspot_custom_channel_id?: string | null
          hubspot_inbox_id?: string | null
          hubspot_owner_id?: string | null
          hubspot_portal_id?: string | null
          hubspot_refresh_token?: string | null
          hubspot_token_expires_at?: string | null
          hubspot_webhook_secret?: string | null
          id?: string
          industry?: string | null
          integration_type?: string
          logo_url?: string | null
          name?: string
          onboarding_completed_at?: string | null
          owner_user_id?: string
          plan?: string
          plan_renews_at?: string | null
          postal_code?: string | null
          region?: string | null
          revolut_customer_id?: string | null
          revolut_subscription_id?: string | null
          slug?: string
          status?: string
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "businesses_current_plan_id_fkey"
            columns: ["current_plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_billing: {
        Row: {
          admin_seats_used: number
          conversations_used: number
          period_key: string
          seen_conversations: string[]
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          admin_seats_used?: number
          conversations_used?: number
          period_key: string
          seen_conversations?: string[]
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          admin_seats_used?: number
          conversations_used?: number
          period_key?: string
          seen_conversations?: string[]
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_billing_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_users: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          fcm_tokens: string[]
          last_seen_at: string | null
          name: string | null
          notification_prefs: Json
          role: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          fcm_tokens?: string[]
          last_seen_at?: string | null
          name?: string | null
          notification_prefs?: Json
          role?: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          fcm_tokens?: string[]
          last_seen_at?: string | null
          name?: string | null
          notification_prefs?: Json
          role?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_hubspot_links: {
        Row: {
          conversation_id: string
          created_at: string
          hubspot_thread_id: string | null
          hubspot_ticket_id: string | null
          tenant_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          hubspot_thread_id?: string | null
          hubspot_ticket_id?: string | null
          tenant_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          hubspot_thread_id?: string | null
          hubspot_ticket_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_hubspot_links_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_start_options: {
        Row: {
          business_id: string
          created_at: string
          description: string | null
          icon: string
          id: string
          inbox_id: string
          is_active: boolean
          kind: string
          label: string
          required_skills: string[]
          sort_order: number
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          inbox_id: string
          is_active?: boolean
          kind: string
          label: string
          required_skills?: string[]
          sort_order?: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          inbox_id?: string
          is_active?: boolean
          kind?: string
          label?: string
          required_skills?: string[]
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_start_options_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_start_options_inbox_id_fkey"
            columns: ["inbox_id"]
            isOneToOne: false
            referencedRelation: "inboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          assigned_at: string | null
          assigned_to: string | null
          created_at: string
          external_ref: string | null
          id: string
          inbox_id: string
          kind: string
          last_at: string | null
          last_message: string | null
          last_outbound_at: string | null
          participants: string[]
          reassign_after: string | null
          start_option_id: string | null
          status: string
          status_updated_at: string
          tenant_id: string
          transferred_note: string | null
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_to?: string | null
          created_at?: string
          external_ref?: string | null
          id?: string
          inbox_id: string
          kind: string
          last_at?: string | null
          last_message?: string | null
          last_outbound_at?: string | null
          participants?: string[]
          reassign_after?: string | null
          start_option_id?: string | null
          status?: string
          status_updated_at?: string
          tenant_id: string
          transferred_note?: string | null
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          assigned_to?: string | null
          created_at?: string
          external_ref?: string | null
          id?: string
          inbox_id?: string
          kind?: string
          last_at?: string | null
          last_message?: string | null
          last_outbound_at?: string | null
          participants?: string[]
          reassign_after?: string | null
          start_option_id?: string | null
          status?: string
          status_updated_at?: string
          tenant_id?: string
          transferred_note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_inbox_id_fkey"
            columns: ["inbox_id"]
            isOneToOne: false
            referencedRelation: "inboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_start_option_id_fkey"
            columns: ["start_option_id"]
            isOneToOne: false
            referencedRelation: "conversation_start_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      data_export_requests: {
        Row: {
          business_id: string
          created_at: string
          download_url: string | null
          error: string | null
          expires_at: string | null
          id: string
          ready_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          download_url?: string | null
          error?: string | null
          expires_at?: string | null
          id?: string
          ready_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          download_url?: string | null
          error?: string | null
          expires_at?: string | null
          id?: string
          ready_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_export_requests_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      deletion_requests: {
        Row: {
          business_id: string | null
          cancelled_at: string | null
          executed_at: string | null
          id: string
          kind: string
          requested_at: string
          scheduled_at: string
          user_id: string
        }
        Insert: {
          business_id?: string | null
          cancelled_at?: string | null
          executed_at?: string | null
          id?: string
          kind: string
          requested_at?: string
          scheduled_at: string
          user_id: string
        }
        Update: {
          business_id?: string | null
          cancelled_at?: string | null
          executed_at?: string | null
          id?: string
          kind?: string
          requested_at?: string
          scheduled_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deletion_requests_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      faq_items: {
        Row: {
          action_href: string | null
          answer: string
          audience: string
          category: string | null
          created_at: string
          id: string
          inbox_id: string | null
          is_published: boolean
          language: string
          position: number
          question: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          action_href?: string | null
          answer: string
          audience: string
          category?: string | null
          created_at?: string
          id?: string
          inbox_id?: string | null
          is_published?: boolean
          language?: string
          position?: number
          question: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          action_href?: string | null
          answer?: string
          audience?: string
          category?: string | null
          created_at?: string
          id?: string
          inbox_id?: string | null
          is_published?: boolean
          language?: string
          position?: number
          question?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "faq_items_inbox_id_fkey"
            columns: ["inbox_id"]
            isOneToOne: false
            referencedRelation: "inboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faq_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      inboxes: {
        Row: {
          api_key: string
          archived_at: string | null
          audience: string
          auth_mode: string
          business_id: string
          created_at: string
          id: string
          name: string
          project_id: string
          purpose: string
          server_secret_hash: string | null
          server_secret_previous_hash: string | null
          server_secret_rotated_at: string | null
          slug: string
          updated_at: string
          webhook_events: string[]
          webhook_secret: string | null
          webhook_secret_previous: string | null
          webhook_secret_rotated_at: string | null
          webhook_url: string | null
          widget_signing_secret: string
          widget_signing_secret_previous: string | null
        }
        Insert: {
          api_key: string
          archived_at?: string | null
          audience: string
          auth_mode?: string
          business_id: string
          created_at?: string
          id?: string
          name: string
          project_id: string
          purpose: string
          server_secret_hash?: string | null
          server_secret_previous_hash?: string | null
          server_secret_rotated_at?: string | null
          slug: string
          updated_at?: string
          webhook_events?: string[]
          webhook_secret?: string | null
          webhook_secret_previous?: string | null
          webhook_secret_rotated_at?: string | null
          webhook_url?: string | null
          widget_signing_secret?: string
          widget_signing_secret_previous?: string | null
        }
        Update: {
          api_key?: string
          archived_at?: string | null
          audience?: string
          auth_mode?: string
          business_id?: string
          created_at?: string
          id?: string
          name?: string
          project_id?: string
          purpose?: string
          server_secret_hash?: string | null
          server_secret_previous_hash?: string | null
          server_secret_rotated_at?: string | null
          slug?: string
          updated_at?: string
          webhook_events?: string[]
          webhook_secret?: string | null
          webhook_secret_previous?: string | null
          webhook_secret_rotated_at?: string | null
          webhook_url?: string | null
          widget_signing_secret?: string
          widget_signing_secret_previous?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inboxes_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inboxes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          business_id: string
          created_at: string
          display_name: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          revoked_at: string | null
          role: string
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          business_id: string
          created_at?: string
          display_name: string
          email: string
          expires_at: string
          id?: string
          invited_by: string
          revoked_at?: string | null
          role?: string
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          business_id?: string
          created_at?: string
          display_name?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          revoked_at?: string | null
          role?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_cents: number
          business_id: string
          created_at: string
          currency: string
          hosted_invoice_url: string | null
          id: string
          paid_at: string | null
          period_end: string
          period_start: string
          plan_id: string
          revolut_order_id: string | null
          revolut_payment_id: string | null
          status: string
        }
        Insert: {
          amount_cents: number
          business_id: string
          created_at?: string
          currency?: string
          hosted_invoice_url?: string | null
          id?: string
          paid_at?: string | null
          period_end: string
          period_start: string
          plan_id: string
          revolut_order_id?: string | null
          revolut_payment_id?: string | null
          status: string
        }
        Update: {
          amount_cents?: number
          business_id?: string
          created_at?: string
          currency?: string
          hosted_invoice_url?: string | null
          id?: string
          paid_at?: string | null
          period_end?: string
          period_start?: string
          plan_id?: string
          revolut_order_id?: string | null
          revolut_payment_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_access_keys: {
        Row: {
          business_id: string
          created_at: string
          created_by: string
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          revoked_at: string | null
        }
        Insert: {
          business_id: string
          created_at?: string
          created_by: string
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          revoked_at?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string
          created_by?: string
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mcp_access_keys_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string | null
          conversation_id: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          hubspot_message_id: string | null
          id: string
          media_url: string | null
          message_type: string
          read_by: string[]
          receiver_id: string | null
          reply_to: string | null
          sender_id: string
          tenant_id: string
        }
        Insert: {
          body?: string | null
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          hubspot_message_id?: string | null
          id?: string
          media_url?: string | null
          message_type?: string
          read_by?: string[]
          receiver_id?: string | null
          reply_to?: string | null
          sender_id: string
          tenant_id: string
        }
        Update: {
          body?: string | null
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          hubspot_message_id?: string | null
          id?: string
          media_url?: string | null
          message_type?: string
          read_by?: string[]
          receiver_id?: string | null
          reply_to?: string | null
          sender_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "unassigned_or_stale_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_webhooks: {
        Row: {
          conversation_id: string
          created_at: string
          event_kind: string
          id: string
          inbox_id: string
          last_error: string | null
          payload: Json
          retry_count: number
          sent_at: string | null
        }
        Insert: {
          conversation_id: string
          created_at?: string
          event_kind: string
          id?: string
          inbox_id: string
          last_error?: string | null
          payload: Json
          retry_count?: number
          sent_at?: string | null
        }
        Update: {
          conversation_id?: string
          created_at?: string
          event_kind?: string
          id?: string
          inbox_id?: string
          last_error?: string | null
          payload?: Json
          retry_count?: number
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pending_webhooks_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_webhooks_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "unassigned_or_stale_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_webhooks_inbox_id_fkey"
            columns: ["inbox_id"]
            isOneToOne: false
            referencedRelation: "inboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          currency: string
          features: Json
          id: string
          is_public: boolean
          max_businesses: number
          max_conversations_per_month: number
          max_inboxes_per_business: number
          monthly_price_cents: number
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          currency?: string
          features?: Json
          id: string
          is_public?: boolean
          max_businesses: number
          max_conversations_per_month: number
          max_inboxes_per_business: number
          monthly_price_cents: number
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          currency?: string
          features?: Json
          id?: string
          is_public?: boolean
          max_businesses?: number
          max_conversations_per_month?: number
          max_inboxes_per_business?: number
          monthly_price_cents?: number
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          archived_at: string | null
          business_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          business_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          business_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_links: {
        Row: {
          action_href: string
          audience: string
          created_at: string
          hint: string | null
          id: string
          inbox_id: string | null
          is_published: boolean
          label: string
          language: string
          position: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          action_href: string
          audience: string
          created_at?: string
          hint?: string | null
          id?: string
          inbox_id?: string | null
          is_published?: boolean
          label: string
          language?: string
          position?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          action_href?: string
          audience?: string
          created_at?: string
          hint?: string | null
          id?: string
          inbox_id?: string | null
          is_published?: boolean
          label?: string
          language?: string
          position?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quick_links_inbox_id_fkey"
            columns: ["inbox_id"]
            isOneToOne: false
            referencedRelation: "inboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quick_links_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      support_agents: {
        Row: {
          accepted_at: string | null
          archived_at: string | null
          avatar_url: string | null
          business_id: string
          created_at: string
          display_name: string
          id: string
          invited_at: string
          invited_by: string | null
          last_assigned_at: string | null
          role: string
          skills: string[]
          status: string
          status_changed_at: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          archived_at?: string | null
          avatar_url?: string | null
          business_id: string
          created_at?: string
          display_name: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          last_assigned_at?: string | null
          role?: string
          skills?: string[]
          status?: string
          status_changed_at?: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          archived_at?: string | null
          avatar_url?: string | null
          business_id?: string
          created_at?: string
          display_name?: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          last_assigned_at?: string | null
          role?: string
          skills?: string[]
          status?: string
          status_changed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_agents_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_deliveries: {
        Row: {
          attempted_at: string
          completed_at: string | null
          error: string | null
          event: string
          event_kind: string | null
          id: string
          payload: Json
          response_body: string | null
          response_code: number | null
          status: string
          tenant_id: string
          webhook_url: string
        }
        Insert: {
          attempted_at?: string
          completed_at?: string | null
          error?: string | null
          event: string
          event_kind?: string | null
          id?: string
          payload: Json
          response_body?: string | null
          response_code?: number | null
          status?: string
          tenant_id: string
          webhook_url: string
        }
        Update: {
          attempted_at?: string
          completed_at?: string | null
          error?: string | null
          event?: string
          event_kind?: string | null
          id?: string
          payload?: Json
          response_body?: string | null
          response_code?: number | null
          status?: string
          tenant_id?: string
          webhook_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      widget_config: {
        Row: {
          bubble_style: string
          business_id: string
          button_style: string
          greeting_message: string | null
          launcher_icon_preset: string | null
          launcher_icon_url: string | null
          primary_color: string
          roundness: string
          updated_at: string
        }
        Insert: {
          bubble_style?: string
          business_id: string
          button_style?: string
          greeting_message?: string | null
          launcher_icon_preset?: string | null
          launcher_icon_url?: string | null
          primary_color?: string
          roundness?: string
          updated_at?: string
        }
        Update: {
          bubble_style?: string
          business_id?: string
          button_style?: string
          greeting_message?: string | null
          launcher_icon_preset?: string | null
          launcher_icon_url?: string | null
          primary_color?: string
          roundness?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "widget_config_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      agent_presence_view: {
        Row: {
          avatar_url: string | null
          business_id: string | null
          display_name: string | null
          effective_status: string | null
          id: string | null
          last_assigned_at: string | null
          role: string | null
          status: string | null
          status_changed_at: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          business_id?: string | null
          display_name?: string | null
          effective_status?: never
          id?: string | null
          last_assigned_at?: string | null
          role?: string | null
          status?: string | null
          status_changed_at?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          business_id?: string | null
          display_name?: string | null
          effective_status?: never
          id?: string | null
          last_assigned_at?: string | null
          role?: string | null
          status?: string | null
          status_changed_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_agents_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      unassigned_or_stale_view: {
        Row: {
          assigned_at: string | null
          assigned_to: string | null
          created_at: string | null
          external_ref: string | null
          id: string | null
          inbox_id: string | null
          kind: string | null
          last_at: string | null
          last_message: string | null
          last_outbound_at: string | null
          participants: string[] | null
          reassign_after: string | null
          status: string | null
          status_updated_at: string | null
          tenant_id: string | null
          transferred_note: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_to?: string | null
          created_at?: string | null
          external_ref?: string | null
          id?: string | null
          inbox_id?: string | null
          kind?: string | null
          last_at?: string | null
          last_message?: string | null
          last_outbound_at?: string | null
          participants?: string[] | null
          reassign_after?: string | null
          status?: string | null
          status_updated_at?: string | null
          tenant_id?: string | null
          transferred_note?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_to?: string | null
          created_at?: string | null
          external_ref?: string | null
          id?: string | null
          inbox_id?: string | null
          kind?: string | null
          last_at?: string | null
          last_message?: string | null
          last_outbound_at?: string | null
          participants?: string[] | null
          reassign_after?: string | null
          status?: string | null
          status_updated_at?: string | null
          tenant_id?: string | null
          transferred_note?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_inbox_id_fkey"
            columns: ["inbox_id"]
            isOneToOne: false
            referencedRelation: "inboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      assign_conversation: { Args: { conv_id: string }; Returns: string }
      tg_enqueue_assignment_webhook: {
        Args: { p_conversation_id: string; p_new: string; p_previous: string }
        Returns: undefined
      }
      user_owns_business: { Args: { b: string }; Returns: boolean }
      user_owns_inbox: { Args: { i: string }; Returns: boolean }
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
