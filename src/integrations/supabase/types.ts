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
      admin_access_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          ip: string | null
          metadata: Json
          success: boolean
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip?: string | null
          metadata?: Json
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip?: string | null
          metadata?: Json
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      admin_pins: {
        Row: {
          created_at: string
          pin_hash: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          pin_hash: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          pin_hash?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_usage_logs: {
        Row: {
          created_at: string
          feature: string
          id: string
          input_chars: number
          model: string | null
          output_chars: number
          success: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          feature: string
          id?: string
          input_chars?: number
          model?: string | null
          output_chars?: number
          success?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          feature?: string
          id?: string
          input_chars?: number
          model?: string | null
          output_chars?: number
          success?: boolean
          user_id?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          created_at: string
          event_name: string
          id: string
          metadata: Json
          path: string | null
          referrer: string | null
          session_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_name: string
          id?: string
          metadata?: Json
          path?: string | null
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_name?: string
          id?: string
          metadata?: Json
          path?: string | null
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      calls: {
        Row: {
          callee_id: string
          caller_id: string
          conversation_id: string
          created_at: string
          ended_at: string | null
          id: string
          kind: string
          seen_at: string | null
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          callee_id: string
          caller_id: string
          conversation_id: string
          created_at?: string
          ended_at?: string | null
          id?: string
          kind: string
          seen_at?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          callee_id?: string
          caller_id?: string
          conversation_id?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          kind?: string
          seen_at?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calls_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_members: {
        Row: {
          conversation_id: string
          joined_at: string
          last_read_at: string
          role: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          joined_at?: string
          last_read_at?: string
          role?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          joined_at?: string
          last_read_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          avatar_url: string | null
          created_at: string
          created_by: string | null
          id: string
          is_group: boolean
          name: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_group?: boolean
          name?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_group?: boolean
          name?: string | null
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
      invite_rewards: {
        Row: {
          created_at: string
          granted_for_count: number
          id: string
          redeemed: boolean
          redeemed_at: string | null
          user_id: string
          views_amount: number
        }
        Insert: {
          created_at?: string
          granted_for_count?: number
          id?: string
          redeemed?: boolean
          redeemed_at?: string | null
          user_id: string
          views_amount?: number
        }
        Update: {
          created_at?: string
          granted_for_count?: number
          id?: string
          redeemed?: boolean
          redeemed_at?: string | null
          user_id?: string
          views_amount?: number
        }
        Relationships: []
      }
      live_locations: {
        Row: {
          accuracy: number | null
          conversation_id: string
          ended_at: string | null
          expires_at: string
          heading: number | null
          id: string
          latitude: number
          longitude: number
          message_id: string | null
          speed: number | null
          started_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accuracy?: number | null
          conversation_id: string
          ended_at?: string | null
          expires_at: string
          heading?: number | null
          id?: string
          latitude: number
          longitude: number
          message_id?: string | null
          speed?: number | null
          started_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accuracy?: number | null
          conversation_id?: string
          ended_at?: string | null
          expires_at?: string
          heading?: number | null
          id?: string
          latitude?: number
          longitude?: number
          message_id?: string | null
          speed?: number | null
          started_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          attachment_name: string | null
          attachment_type: string | null
          attachment_url: string | null
          content: string | null
          conversation_id: string
          created_at: string
          deleted_for: string[]
          deleted_for_everyone_at: string | null
          edited_at: string | null
          id: string
          sender_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          content?: string | null
          conversation_id: string
          created_at?: string
          deleted_for?: string[]
          deleted_for_everyone_at?: string | null
          edited_at?: string | null
          id?: string
          sender_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          content?: string | null
          conversation_id?: string
          created_at?: string
          deleted_for?: string[]
          deleted_for_everyone_at?: string | null
          edited_at?: string | null
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      native_push_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      newsletter_feedback: {
        Row: {
          created_at: string
          email: string | null
          handled: boolean
          id: string
          message: string
          replied_at: string | null
          replied_by: string | null
          reply: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          handled?: boolean
          id?: string
          message: string
          replied_at?: string | null
          replied_by?: string | null
          reply?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          handled?: boolean
          id?: string
          message?: string
          replied_at?: string | null
          replied_by?: string | null
          reply?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      newsletter_posts: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          cta_label: string | null
          cta_url: string | null
          id: string
          media_type: string | null
          media_url: string | null
          recipients_count: number
          sent_at: string | null
          status: string
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          cta_label?: string | null
          cta_url?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          recipients_count?: number
          sent_at?: string | null
          status?: string
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          cta_label?: string | null
          cta_url?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          recipients_count?: number
          sent_at?: string | null
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
          source: string | null
          status: string
          unsubscribed_at: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          source?: string | null
          status?: string
          unsubscribed_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          source?: string | null
          status?: string
          unsubscribed_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          data: Json
          id: string
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json
          id?: string
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json
          id?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profile_view_requests: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          requester_id: string
          responded_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          requester_id: string
          responded_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          requester_id?: string
          responded_at?: string | null
          status?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string
          goal: string | null
          id: string
          invited_by: string | null
          last_seen: string
          onboarded: boolean
          show_city: boolean
          signup_campaign: string | null
          signup_landing: string | null
          signup_medium: string | null
          signup_referrer: string | null
          signup_source: string | null
          updated_at: string
          username: string
          visibility: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name: string
          goal?: string | null
          id: string
          invited_by?: string | null
          last_seen?: string
          onboarded?: boolean
          show_city?: boolean
          signup_campaign?: string | null
          signup_landing?: string | null
          signup_medium?: string | null
          signup_referrer?: string | null
          signup_source?: string | null
          updated_at?: string
          username: string
          visibility?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          goal?: string | null
          id?: string
          invited_by?: string | null
          last_seen?: string
          onboarded?: boolean
          show_city?: boolean
          signup_campaign?: string | null
          signup_landing?: string | null
          signup_medium?: string | null
          signup_referrer?: string | null
          signup_source?: string | null
          updated_at?: string
          username?: string
          visibility?: string
        }
        Relationships: []
      }
      profiles_private: {
        Row: {
          app_version: string | null
          city: string | null
          country: string | null
          created_at: string
          device_platform: string | null
          email: string | null
          gender: string | null
          last_ip: string | null
          pix_key: string | null
          pix_key_type: string | null
          preferred_bank: string | null
          region: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          app_version?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          device_platform?: string | null
          email?: string | null
          gender?: string | null
          last_ip?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          preferred_bank?: string | null
          region?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          app_version?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          device_platform?: string | null
          email?: string | null
          gender?: string | null
          last_ip?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          preferred_bank?: string | null
          region?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_private_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_logs: {
        Row: {
          channel: string
          conversation_id: string | null
          created_at: string
          endpoint: string | null
          error: string | null
          id: string
          kind: string
          recipient_id: string
          sender_id: string | null
          status_code: number | null
          success: boolean
          user_agent: string | null
        }
        Insert: {
          channel: string
          conversation_id?: string | null
          created_at?: string
          endpoint?: string | null
          error?: string | null
          id?: string
          kind?: string
          recipient_id: string
          sender_id?: string | null
          status_code?: number | null
          success?: boolean
          user_agent?: string | null
        }
        Update: {
          channel?: string
          conversation_id?: string | null
          created_at?: string
          endpoint?: string | null
          error?: string | null
          id?: string
          kind?: string
          recipient_id?: string
          sender_id?: string | null
          status_code?: number | null
          success?: boolean
          user_agent?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      share_logs: {
        Row: {
          content_type: string
          created_at: string
          id: string
          target: string
          user_id: string
        }
        Insert: {
          content_type: string
          created_at?: string
          id?: string
          target: string
          user_id: string
        }
        Update: {
          content_type?: string
          created_at?: string
          id?: string
          target?: string
          user_id?: string
        }
        Relationships: []
      }
      status_boost_clicks: {
        Row: {
          boost_id: string
          clicker_id: string | null
          created_at: string
          id: string
          status_id: string
          viewer_age_range: string | null
          viewer_country: string | null
          viewer_gender: string | null
          viewer_state: string | null
        }
        Insert: {
          boost_id: string
          clicker_id?: string | null
          created_at?: string
          id?: string
          status_id: string
          viewer_age_range?: string | null
          viewer_country?: string | null
          viewer_gender?: string | null
          viewer_state?: string | null
        }
        Update: {
          boost_id?: string
          clicker_id?: string | null
          created_at?: string
          id?: string
          status_id?: string
          viewer_age_range?: string | null
          viewer_country?: string | null
          viewer_gender?: string | null
          viewer_state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "status_boost_clicks_boost_id_fkey"
            columns: ["boost_id"]
            isOneToOne: false
            referencedRelation: "status_boosts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_boost_clicks_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      status_boosts: {
        Row: {
          activated_at: string | null
          amount_cents: number
          boost_type: string
          checkout_session_id: string | null
          cpm_cents: number | null
          created_at: string
          currency: string
          duration_days: number | null
          ends_at: string | null
          environment: string
          id: string
          is_free_reward: boolean
          objective: string
          package: string
          refund_reason: string | null
          refunded_amount_cents: number | null
          refunded_at: string | null
          status: string
          status_id: string
          target_age_max: number | null
          target_age_min: number | null
          target_gender: string
          target_states: string[]
          transaction_id: string | null
          updated_at: string
          user_id: string
          views_remaining: number
          views_total: number
        }
        Insert: {
          activated_at?: string | null
          amount_cents: number
          boost_type?: string
          checkout_session_id?: string | null
          cpm_cents?: number | null
          created_at?: string
          currency?: string
          duration_days?: number | null
          ends_at?: string | null
          environment?: string
          id?: string
          is_free_reward?: boolean
          objective?: string
          package: string
          refund_reason?: string | null
          refunded_amount_cents?: number | null
          refunded_at?: string | null
          status?: string
          status_id: string
          target_age_max?: number | null
          target_age_min?: number | null
          target_gender?: string
          target_states?: string[]
          transaction_id?: string | null
          updated_at?: string
          user_id: string
          views_remaining: number
          views_total: number
        }
        Update: {
          activated_at?: string | null
          amount_cents?: number
          boost_type?: string
          checkout_session_id?: string | null
          cpm_cents?: number | null
          created_at?: string
          currency?: string
          duration_days?: number | null
          ends_at?: string | null
          environment?: string
          id?: string
          is_free_reward?: boolean
          objective?: string
          package?: string
          refund_reason?: string | null
          refunded_amount_cents?: number | null
          refunded_at?: string | null
          status?: string
          status_id?: string
          target_age_max?: number | null
          target_age_min?: number | null
          target_gender?: string
          target_states?: string[]
          transaction_id?: string | null
          updated_at?: string
          user_id?: string
          views_remaining?: number
          views_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "status_boosts_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      status_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          status_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          status_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          status_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_reactions_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      status_views: {
        Row: {
          boost_id: string | null
          from_boost: boolean
          status_id: string
          viewed_at: string
          viewer_age_range: string | null
          viewer_country: string | null
          viewer_gender: string | null
          viewer_id: string
          viewer_state: string | null
        }
        Insert: {
          boost_id?: string | null
          from_boost?: boolean
          status_id: string
          viewed_at?: string
          viewer_age_range?: string | null
          viewer_country?: string | null
          viewer_gender?: string | null
          viewer_id: string
          viewer_state?: string | null
        }
        Update: {
          boost_id?: string | null
          from_boost?: boolean
          status_id?: string
          viewed_at?: string
          viewer_age_range?: string | null
          viewer_country?: string | null
          viewer_gender?: string | null
          viewer_id?: string
          viewer_state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "status_views_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      statuses: {
        Row: {
          background: string | null
          caption: string | null
          content: string | null
          created_at: string
          cta_label: string | null
          cta_url: string | null
          expires_at: string
          id: string
          is_official: boolean
          kind: string
          media_url: string | null
          user_id: string
        }
        Insert: {
          background?: string | null
          caption?: string | null
          content?: string | null
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          expires_at?: string
          id?: string
          is_official?: boolean
          kind: string
          media_url?: string | null
          user_id: string
        }
        Update: {
          background?: string | null
          caption?: string | null
          content?: string | null
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          expires_at?: string
          id?: string
          is_official?: boolean
          kind?: string
          media_url?: string | null
          user_id?: string
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
      typing_indicators: {
        Row: {
          conversation_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "typing_indicators_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_onboarding_survey: {
        Row: {
          age_range: string
          created_at: string
          favorite_feature: string
          id: string
          main_goal: string
          reason_joined: string
          source_channel: string
          user_id: string
        }
        Insert: {
          age_range: string
          created_at?: string
          favorite_feature: string
          id?: string
          main_goal: string
          reason_joined: string
          source_channel: string
          user_id: string
        }
        Update: {
          age_range?: string
          created_at?: string
          favorite_feature?: string
          id?: string
          main_goal?: string
          reason_joined?: string
          source_channel?: string
          user_id?: string
        }
        Relationships: []
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
      admin_boost_overview: { Args: { _days?: number }; Returns: Json }
      admin_invites_overview: { Args: never; Returns: Json }
      admin_list_admins: { Args: never; Returns: Json }
      admin_newsletter_stats: { Args: never; Returns: Json }
      admin_onboarding_survey_stats: { Args: { _days?: number }; Returns: Json }
      admin_push_logs: { Args: { _days?: number }; Returns: Json }
      admin_send_newsletter: { Args: { _post_id: string }; Returns: Json }
      admin_signup_sources: { Args: never; Returns: Json }
      admin_usage_analytics: { Args: { _days?: number }; Returns: Json }
      admin_user_activity_stats: { Args: never; Returns: Json }
      admin_user_confirmation_stats: { Args: never; Returns: Json }
      can_view_full_profile: { Args: { _owner: string }; Returns: boolean }
      claim_invite_reward: { Args: never; Returns: Json }
      complete_onboarding: {
        Args: { _display_name: string; _username: string }
        Returns: Json
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      discover_people: {
        Args: { _limit?: number }
        Returns: {
          avatar_url: string
          city: string
          country: string
          display_name: string
          id: string
          mutual_count: number
          reason: string
          region: string
          score: number
          username: string
        }[]
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_boost_report: { Args: { _boost_id: string }; Returns: Json }
      get_invite_stats: { Args: never; Returns: Json }
      get_my_sponsored_status_ids: { Args: never; Returns: string[] }
      get_people_you_may_know: {
        Args: { _limit?: number }
        Returns: {
          avatar_url: string
          display_name: string
          id: string
          mutual_count: number
          reason: string
          username: string
        }[]
      }
      get_public_profile: { Args: { _username: string }; Returns: Json }
      get_status_profile_cards: {
        Args: { _user_ids: string[] }
        Returns: {
          avatar_url: string
          display_name: string
          id: string
        }[]
      }
      has_min_role: {
        Args: {
          _min: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_conversation_member: {
        Args: { _conv_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_admin: {
        Args: { _conv_id: string; _user_id: string }
        Returns: boolean
      }
      is_protected_superadmin_email: {
        Args: { _user_id: string }
        Returns: boolean
      }
      is_wavechat_official_account: {
        Args: { _user_id: string }
        Returns: boolean
      }
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
      redeem_free_boost: { Args: { _status_id: string }; Returns: Json }
      register_boost_click: { Args: { _status_id: string }; Returns: Json }
      register_status_view: { Args: { _status_id: string }; Returns: Json }
      request_profile_view: { Args: { _owner: string }; Returns: Json }
      respond_profile_view: {
        Args: { _approve: boolean; _requester: string }
        Returns: Json
      }
      role_rank: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: number
      }
      search_users: {
        Args: { q: string }
        Returns: {
          avatar_url: string
          display_name: string
          id: string
          username: string
        }[]
      }
      survey_interest_tags: { Args: { _user_id: string }; Returns: string[] }
      users_share_conversation: {
        Args: { _a: string; _b: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "moderator" | "superadmin"
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
      app_role: ["admin", "user", "moderator", "superadmin"],
    },
  },
} as const
