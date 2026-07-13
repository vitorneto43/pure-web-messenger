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
      ambassador_settings: {
        Row: {
          id: boolean
          ranking_public: boolean
          rewards_enabled: boolean
          updated_at: string
        }
        Insert: {
          id?: boolean
          ranking_public?: boolean
          rewards_enabled?: boolean
          updated_at?: string
        }
        Update: {
          id?: boolean
          ranking_public?: boolean
          rewards_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      ambassador_tiers: {
        Row: {
          active: boolean
          created_at: string
          icon: string
          id: string
          min_invites: number
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          icon?: string
          id?: string
          min_invites: number
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          icon?: string
          id?: string
          min_invites?: number
          name?: string
          sort_order?: number
          updated_at?: string
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
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string | null
          created_at: string
          device_hash: string | null
          id: string
          ip_hash: string | null
          metadata: Json
          target_id: string | null
          target_type: string | null
          target_user_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          device_hash?: string | null
          id?: string
          ip_hash?: string | null
          metadata?: Json
          target_id?: string | null
          target_type?: string | null
          target_user_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          device_hash?: string | null
          id?: string
          ip_hash?: string | null
          metadata?: Json
          target_id?: string | null
          target_type?: string | null
          target_user_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      badges: {
        Row: {
          category: string
          code: string
          color: string
          created_at: string
          criteria: Json
          description: string
          display_priority: number
          icon: string
          id: string
          is_automatic: boolean
          name: string
          tier: number
        }
        Insert: {
          category: string
          code: string
          color?: string
          created_at?: string
          criteria?: Json
          description: string
          display_priority?: number
          icon: string
          id?: string
          is_automatic?: boolean
          name: string
          tier?: number
        }
        Update: {
          category?: string
          code?: string
          color?: string
          created_at?: string
          criteria?: Json
          description?: string
          display_priority?: number
          icon?: string
          id?: string
          is_automatic?: boolean
          name?: string
          tier?: number
        }
        Relationships: []
      }
      banned_ips: {
        Row: {
          banned_by: string | null
          created_at: string
          expires_at: string | null
          id: string
          ip_hash: string
          reason: string | null
          related_user_id: string | null
        }
        Insert: {
          banned_by?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          ip_hash: string
          reason?: string | null
          related_user_id?: string | null
        }
        Update: {
          banned_by?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          ip_hash?: string
          reason?: string | null
          related_user_id?: string | null
        }
        Relationships: []
      }
      behavior_signals: {
        Row: {
          created_at: string
          device_hash: string | null
          id: string
          ip_hash: string | null
          kind: string
          metadata: Json
          user_id: string | null
          weight: number
        }
        Insert: {
          created_at?: string
          device_hash?: string | null
          id?: string
          ip_hash?: string | null
          kind: string
          metadata?: Json
          user_id?: string | null
          weight?: number
        }
        Update: {
          created_at?: string
          device_hash?: string | null
          id?: string
          ip_hash?: string | null
          kind?: string
          metadata?: Json
          user_id?: string | null
          weight?: number
        }
        Relationships: []
      }
      boost_review_results: {
        Row: {
          boost_id: string
          boost_kind: string
          category: string | null
          confidence: number | null
          created_at: string
          id: string
          payload: Json | null
          reason: string | null
          reviewer: string
          verdict: string
        }
        Insert: {
          boost_id: string
          boost_kind: string
          category?: string | null
          confidence?: number | null
          created_at?: string
          id?: string
          payload?: Json | null
          reason?: string | null
          reviewer: string
          verdict: string
        }
        Update: {
          boost_id?: string
          boost_kind?: string
          category?: string | null
          confidence?: number | null
          created_at?: string
          id?: string
          payload?: Json | null
          reason?: string | null
          reviewer?: string
          verdict?: string
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
      coin_purchases: {
        Row: {
          amount_cents: number
          coins: number
          completed_at: string | null
          created_at: string
          currency: string
          id: string
          package_id: string
          status: string
          stripe_session_id: string | null
          user_id: string
        }
        Insert: {
          amount_cents: number
          coins: number
          completed_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          package_id: string
          status?: string
          stripe_session_id?: string | null
          user_id: string
        }
        Update: {
          amount_cents?: number
          coins?: number
          completed_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          package_id?: string
          status?: string
          stripe_session_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      compliance_access_logs: {
        Row: {
          accessor_email: string | null
          accessor_id: string | null
          created_at: string
          data_accessed: string
          data_summary: Json
          id: string
          ip_hash: string | null
          process_number: string | null
          reason: string
          request_id: string | null
          target_user_id: string | null
          user_agent: string | null
        }
        Insert: {
          accessor_email?: string | null
          accessor_id?: string | null
          created_at?: string
          data_accessed: string
          data_summary?: Json
          id?: string
          ip_hash?: string | null
          process_number?: string | null
          reason: string
          request_id?: string | null
          target_user_id?: string | null
          user_agent?: string | null
        }
        Update: {
          accessor_email?: string | null
          accessor_id?: string | null
          created_at?: string
          data_accessed?: string
          data_summary?: Json
          id?: string
          ip_hash?: string | null
          process_number?: string | null
          reason?: string
          request_id?: string | null
          target_user_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_access_logs_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "compliance_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          attachments: Json | null
          created_at: string
          created_by: string | null
          date_range_end: string | null
          date_range_start: string | null
          fulfilled_at: string | null
          id: string
          legal_basis: string | null
          notes: string | null
          process_number: string
          reason: string
          requester_contact: string | null
          requester_name: string | null
          requesting_authority: string
          status: string
          target_user_id: string | null
          target_username: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          attachments?: Json | null
          created_at?: string
          created_by?: string | null
          date_range_end?: string | null
          date_range_start?: string | null
          fulfilled_at?: string | null
          id?: string
          legal_basis?: string | null
          notes?: string | null
          process_number: string
          reason: string
          requester_contact?: string | null
          requester_name?: string | null
          requesting_authority: string
          status?: string
          target_user_id?: string | null
          target_username?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          attachments?: Json | null
          created_at?: string
          created_by?: string | null
          date_range_end?: string | null
          date_range_start?: string | null
          fulfilled_at?: string | null
          id?: string
          legal_basis?: string | null
          notes?: string | null
          process_number?: string
          reason?: string
          requester_contact?: string | null
          requester_name?: string | null
          requesting_authority?: string
          status?: string
          target_user_id?: string | null
          target_username?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      content_reports: {
        Row: {
          assigned_to: string | null
          created_at: string
          details: string | null
          evidence_snapshot: Json | null
          id: string
          reason: string
          reported_user_id: string | null
          reporter_id: string
          resolved_at: string | null
          reviewer_id: string | null
          reviewer_notes: string | null
          status: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: Database["public"]["Enums"]["report_target_type"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          details?: string | null
          evidence_snapshot?: Json | null
          id?: string
          reason: string
          reported_user_id?: string | null
          reporter_id: string
          resolved_at?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: Database["public"]["Enums"]["report_target_type"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          details?: string | null
          evidence_snapshot?: Json | null
          id?: string
          reason?: string
          reported_user_id?: string | null
          reporter_id?: string
          resolved_at?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_id?: string
          target_type?: Database["public"]["Enums"]["report_target_type"]
          updated_at?: string
        }
        Relationships: []
      }
      conversation_members: {
        Row: {
          conversation_id: string
          joined_at: string
          last_read_at: string
          left_at: string | null
          role: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          joined_at?: string
          last_read_at?: string
          left_at?: string | null
          role?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          joined_at?: string
          last_read_at?: string
          left_at?: string | null
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
          category: Database["public"]["Enums"]["group_category"] | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_group: boolean
          join_policy: Database["public"]["Enums"]["group_join_policy"]
          member_count: number
          name: string | null
          pinned_message: string | null
          rules: string | null
          updated_at: string
          visibility: Database["public"]["Enums"]["group_visibility"]
        }
        Insert: {
          avatar_url?: string | null
          category?: Database["public"]["Enums"]["group_category"] | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_group?: boolean
          join_policy?: Database["public"]["Enums"]["group_join_policy"]
          member_count?: number
          name?: string | null
          pinned_message?: string | null
          rules?: string | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["group_visibility"]
        }
        Update: {
          avatar_url?: string | null
          category?: Database["public"]["Enums"]["group_category"] | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_group?: boolean
          join_policy?: Database["public"]["Enums"]["group_join_policy"]
          member_count?: number
          name?: string | null
          pinned_message?: string | null
          rules?: string | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["group_visibility"]
        }
        Relationships: []
      }
      device_fingerprints: {
        Row: {
          account_count: number
          banned_account_count: number
          blocked_at: string | null
          blocked_reason: string | null
          fingerprint_hash: string
          first_seen_at: string
          is_blocked: boolean
          last_seen_at: string
          metadata: Json
          risk_level: string
        }
        Insert: {
          account_count?: number
          banned_account_count?: number
          blocked_at?: string | null
          blocked_reason?: string | null
          fingerprint_hash: string
          first_seen_at?: string
          is_blocked?: boolean
          last_seen_at?: string
          metadata?: Json
          risk_level?: string
        }
        Update: {
          account_count?: number
          banned_account_count?: number
          blocked_at?: string | null
          blocked_reason?: string | null
          fingerprint_hash?: string
          first_seen_at?: string
          is_blocked?: boolean
          last_seen_at?: string
          metadata?: Json
          risk_level?: string
        }
        Relationships: []
      }
      device_user_links: {
        Row: {
          fingerprint_hash: string
          first_seen_at: string
          id: string
          last_seen_at: string
          seen_count: number
          user_id: string
        }
        Insert: {
          fingerprint_hash: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          seen_count?: number
          user_id: string
        }
        Update: {
          fingerprint_hash?: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          seen_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_user_links_fingerprint_hash_fkey"
            columns: ["fingerprint_hash"]
            isOneToOne: false
            referencedRelation: "device_fingerprints"
            referencedColumns: ["fingerprint_hash"]
          },
        ]
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
      group_join_requests: {
        Row: {
          conversation_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          message: string | null
          status: Database["public"]["Enums"]["group_join_request_status"]
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          message?: string | null
          status?: Database["public"]["Enums"]["group_join_request_status"]
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          message?: string | null
          status?: Database["public"]["Enums"]["group_join_request_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_join_requests_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      group_reports: {
        Row: {
          conversation_id: string
          created_at: string
          details: string | null
          id: string
          reason: Database["public"]["Enums"]["group_report_reason"]
          reporter_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["group_report_status"]
        }
        Insert: {
          conversation_id: string
          created_at?: string
          details?: string | null
          id?: string
          reason: Database["public"]["Enums"]["group_report_reason"]
          reporter_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["group_report_status"]
        }
        Update: {
          conversation_id?: string
          created_at?: string
          details?: string | null
          id?: string
          reason?: Database["public"]["Enums"]["group_report_reason"]
          reporter_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["group_report_status"]
        }
        Relationships: [
          {
            foreignKeyName: "group_reports_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_clicks: {
        Row: {
          channel: string
          created_at: string
          id: string
          inviter_id: string
          ip_hash: string | null
          referrer: string | null
          user_agent: string | null
          utm: Json
        }
        Insert: {
          channel?: string
          created_at?: string
          id?: string
          inviter_id: string
          ip_hash?: string | null
          referrer?: string | null
          user_agent?: string | null
          utm?: Json
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          inviter_id?: string
          ip_hash?: string | null
          referrer?: string | null
          user_agent?: string | null
          utm?: Json
        }
        Relationships: [
          {
            foreignKeyName: "invite_clicks_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      invite_signups: {
        Row: {
          channel: string
          click_id: string | null
          created_at: string
          id: string
          install_source: string | null
          invited_user_id: string
          inviter_id: string
        }
        Insert: {
          channel?: string
          click_id?: string | null
          created_at?: string
          id?: string
          install_source?: string | null
          invited_user_id: string
          inviter_id: string
        }
        Update: {
          channel?: string
          click_id?: string | null
          created_at?: string
          id?: string
          install_source?: string | null
          invited_user_id?: string
          inviter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invite_signups_click_id_fkey"
            columns: ["click_id"]
            isOneToOne: false
            referencedRelation: "invite_clicks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_signups_invited_user_id_fkey"
            columns: ["invited_user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_signups_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ip_reputation: {
        Row: {
          accounts_banned: number
          accounts_created: number
          country: string | null
          first_seen_at: string
          ip_hash: string
          last_seen_at: string
          notes: string | null
          region: string | null
          risk_level: string
          updated_at: string
        }
        Insert: {
          accounts_banned?: number
          accounts_created?: number
          country?: string | null
          first_seen_at?: string
          ip_hash: string
          last_seen_at?: string
          notes?: string | null
          region?: string | null
          risk_level?: string
          updated_at?: string
        }
        Update: {
          accounts_banned?: number
          accounts_created?: number
          country?: string | null
          first_seen_at?: string
          ip_hash?: string
          last_seen_at?: string
          notes?: string | null
          region?: string | null
          risk_level?: string
          updated_at?: string
        }
        Relationships: []
      }
      ip_user_links: {
        Row: {
          first_seen_at: string
          id: string
          ip_hash: string
          last_seen_at: string
          user_id: string
        }
        Insert: {
          first_seen_at?: string
          id?: string
          ip_hash: string
          last_seen_at?: string
          user_id: string
        }
        Update: {
          first_seen_at?: string
          id?: string
          ip_hash?: string
          last_seen_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ip_user_links_ip_hash_fkey"
            columns: ["ip_hash"]
            isOneToOne: false
            referencedRelation: "ip_reputation"
            referencedColumns: ["ip_hash"]
          },
        ]
      }
      live_chat_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          live_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          live_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          live_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_chat_messages_live_id_fkey"
            columns: ["live_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      live_gifts_catalog: {
        Row: {
          coins_cost: number
          emoji: string
          enabled: boolean
          id: string
          name: string
          rarity: string
          sort_order: number
        }
        Insert: {
          coins_cost: number
          emoji: string
          enabled?: boolean
          id: string
          name: string
          rarity?: string
          sort_order?: number
        }
        Update: {
          coins_cost?: number
          emoji?: string
          enabled?: boolean
          id?: string
          name?: string
          rarity?: string
          sort_order?: number
        }
        Relationships: []
      }
      live_gifts_sent: {
        Row: {
          coins_spent: number
          created_at: string
          gift_id: string
          id: string
          live_id: string
          quantity: number
          sender_id: string
        }
        Insert: {
          coins_spent: number
          created_at?: string
          gift_id: string
          id?: string
          live_id: string
          quantity?: number
          sender_id: string
        }
        Update: {
          coins_spent?: number
          created_at?: string
          gift_id?: string
          id?: string
          live_id?: string
          quantity?: number
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_gifts_sent_gift_id_fkey"
            columns: ["gift_id"]
            isOneToOne: false
            referencedRelation: "live_gifts_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_gifts_sent_live_id_fkey"
            columns: ["live_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
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
      live_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          live_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          live_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          live_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_reactions_live_id_fkey"
            columns: ["live_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      live_recordings: {
        Row: {
          call_id: string | null
          created_at: string
          duration_sec: number | null
          ended_at: string | null
          error_message: string | null
          file_url: string | null
          host_id: string
          id: string
          is_public: boolean
          live_id: string | null
          livekit_egress_id: string | null
          size_bytes: number | null
          started_at: string | null
          status: string
          storage_path: string | null
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          call_id?: string | null
          created_at?: string
          duration_sec?: number | null
          ended_at?: string | null
          error_message?: string | null
          file_url?: string | null
          host_id: string
          id?: string
          is_public?: boolean
          live_id?: string | null
          livekit_egress_id?: string | null
          size_bytes?: number | null
          started_at?: string | null
          status?: string
          storage_path?: string | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          call_id?: string | null
          created_at?: string
          duration_sec?: number | null
          ended_at?: string | null
          error_message?: string | null
          file_url?: string | null
          host_id?: string
          id?: string
          is_public?: boolean
          live_id?: string | null
          livekit_egress_id?: string | null
          size_bytes?: number | null
          started_at?: string | null
          status?: string
          storage_path?: string | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_recordings_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_recordings_live_id_fkey"
            columns: ["live_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      live_sessions: {
        Row: {
          cover_url: string | null
          created_at: string
          ended_at: string | null
          host_id: string
          host_last_seen: string
          id: string
          livekit_room: string
          peak_viewers: number
          scheduled_live_id: string | null
          started_at: string
          status: Database["public"]["Enums"]["live_status"]
          title: string
          total_gift_coins: number
          total_reactions: number
          viewer_count: number
          will_record: boolean
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          ended_at?: string | null
          host_id: string
          host_last_seen?: string
          id?: string
          livekit_room: string
          peak_viewers?: number
          scheduled_live_id?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["live_status"]
          title?: string
          total_gift_coins?: number
          total_reactions?: number
          viewer_count?: number
          will_record?: boolean
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          ended_at?: string | null
          host_id?: string
          host_last_seen?: string
          id?: string
          livekit_room?: string
          peak_viewers?: number
          scheduled_live_id?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["live_status"]
          title?: string
          total_gift_coins?: number
          total_reactions?: number
          viewer_count?: number
          will_record?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "live_sessions_scheduled_live_id_fkey"
            columns: ["scheduled_live_id"]
            isOneToOne: false
            referencedRelation: "scheduled_lives"
            referencedColumns: ["id"]
          },
        ]
      }
      live_stage_requests: {
        Row: {
          created_at: string
          id: string
          live_id: string
          status: Database["public"]["Enums"]["stage_request_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          live_id: string
          status?: Database["public"]["Enums"]["stage_request_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          live_id?: string
          status?: Database["public"]["Enums"]["stage_request_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_stage_requests_live_id_fkey"
            columns: ["live_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      live_viewers: {
        Row: {
          last_seen: string
          live_id: string
          user_id: string
        }
        Insert: {
          last_seen?: string
          live_id: string
          user_id: string
        }
        Update: {
          last_seen?: string
          live_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_viewers_live_id_fkey"
            columns: ["live_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
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
      moderation_actions: {
        Row: {
          action_type: Database["public"]["Enums"]["moderation_action_type"]
          created_at: string
          duration_days: number | null
          expires_at: string | null
          id: string
          metadata: Json | null
          moderator_id: string | null
          reason: string | null
          report_id: string | null
          severity: string
          target_user_id: string | null
        }
        Insert: {
          action_type: Database["public"]["Enums"]["moderation_action_type"]
          created_at?: string
          duration_days?: number | null
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          moderator_id?: string | null
          reason?: string | null
          report_id?: string | null
          severity?: string
          target_user_id?: string | null
        }
        Update: {
          action_type?: Database["public"]["Enums"]["moderation_action_type"]
          created_at?: string
          duration_days?: number | null
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          moderator_id?: string | null
          reason?: string | null
          report_id?: string | null
          severity?: string
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "moderation_actions_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "content_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_weights: {
        Row: {
          id: number
          limit_groups_per_day_new: number
          limit_invites_per_day_new: number
          limit_links_per_day_new: number
          limit_messages_per_day_new: number
          new_account_days: number
          new_account_trust_threshold: number
          threshold_ban: number
          threshold_restriction: number
          threshold_suspension: number
          threshold_warning: number
          updated_at: string
          updated_by: string | null
          weight_behavior: number
          weight_blocks: number
          weight_links: number
          weight_report: number
          weight_spam: number
        }
        Insert: {
          id?: number
          limit_groups_per_day_new?: number
          limit_invites_per_day_new?: number
          limit_links_per_day_new?: number
          limit_messages_per_day_new?: number
          new_account_days?: number
          new_account_trust_threshold?: number
          threshold_ban?: number
          threshold_restriction?: number
          threshold_suspension?: number
          threshold_warning?: number
          updated_at?: string
          updated_by?: string | null
          weight_behavior?: number
          weight_blocks?: number
          weight_links?: number
          weight_report?: number
          weight_spam?: number
        }
        Update: {
          id?: number
          limit_groups_per_day_new?: number
          limit_invites_per_day_new?: number
          limit_links_per_day_new?: number
          limit_messages_per_day_new?: number
          new_account_days?: number
          new_account_trust_threshold?: number
          threshold_ban?: number
          threshold_restriction?: number
          threshold_suspension?: number
          threshold_warning?: number
          updated_at?: string
          updated_by?: string | null
          weight_behavior?: number
          weight_blocks?: number
          weight_links?: number
          weight_report?: number
          weight_spam?: number
        }
        Relationships: []
      }
      music_track_plays: {
        Row: {
          created_at: string
          id: string
          source: string
          track_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          source?: string
          track_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          source?: string
          track_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "music_track_plays_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "story_music_tracks"
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
      post_boost_clicks: {
        Row: {
          amount_charged_cents: number | null
          boost_id: string | null
          created_at: string
          cta_url: string | null
          id: string
          post_id: string
          session_hash: string | null
          user_id: string | null
        }
        Insert: {
          amount_charged_cents?: number | null
          boost_id?: string | null
          created_at?: string
          cta_url?: string | null
          id?: string
          post_id: string
          session_hash?: string | null
          user_id?: string | null
        }
        Update: {
          amount_charged_cents?: number | null
          boost_id?: string | null
          created_at?: string
          cta_url?: string | null
          id?: string
          post_id?: string
          session_hash?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_boost_clicks_boost_id_fkey"
            columns: ["boost_id"]
            isOneToOne: false
            referencedRelation: "post_boosts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_boost_clicks_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_boosts: {
        Row: {
          activated_at: string | null
          amount_cents: number
          boost_type: string
          checkout_session_id: string | null
          cpm_cents: number | null
          created_at: string
          currency: string
          duration_days: number
          ends_at: string | null
          environment: string
          id: string
          is_free_reward: boolean
          objective: string | null
          package: string
          post_id: string
          refund_reason: string | null
          refunded_amount_cents: number
          refunded_at: string | null
          review_reason: string | null
          review_status: string
          reviewed_at: string | null
          status: string
          target_age_max: number | null
          target_age_min: number | null
          target_countries: string[]
          target_gender: string | null
          target_interests: string[]
          target_states: string[]
          transaction_id: string | null
          updated_at: string
          user_id: string
          views_remaining: number
          views_total: number
        }
        Insert: {
          activated_at?: string | null
          amount_cents?: number
          boost_type?: string
          checkout_session_id?: string | null
          cpm_cents?: number | null
          created_at?: string
          currency?: string
          duration_days?: number
          ends_at?: string | null
          environment?: string
          id?: string
          is_free_reward?: boolean
          objective?: string | null
          package: string
          post_id: string
          refund_reason?: string | null
          refunded_amount_cents?: number
          refunded_at?: string | null
          review_reason?: string | null
          review_status?: string
          reviewed_at?: string | null
          status?: string
          target_age_max?: number | null
          target_age_min?: number | null
          target_countries?: string[]
          target_gender?: string | null
          target_interests?: string[]
          target_states?: string[]
          transaction_id?: string | null
          updated_at?: string
          user_id: string
          views_remaining?: number
          views_total?: number
        }
        Update: {
          activated_at?: string | null
          amount_cents?: number
          boost_type?: string
          checkout_session_id?: string | null
          cpm_cents?: number | null
          created_at?: string
          currency?: string
          duration_days?: number
          ends_at?: string | null
          environment?: string
          id?: string
          is_free_reward?: boolean
          objective?: string | null
          package?: string
          post_id?: string
          refund_reason?: string | null
          refunded_amount_cents?: number
          refunded_at?: string | null
          review_reason?: string | null
          review_status?: string
          reviewed_at?: string | null
          status?: string
          target_age_max?: number | null
          target_age_min?: number | null
          target_countries?: string[]
          target_gender?: string | null
          target_interests?: string[]
          target_states?: string[]
          transaction_id?: string | null
          updated_at?: string
          user_id?: string
          views_remaining?: number
          views_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "post_boosts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comment_reactions: {
        Row: {
          comment_id: string
          created_at: string
          emoji: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          emoji?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          emoji?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comment_reactions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          parent_id: string | null
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_reactions: {
        Row: {
          created_at: string
          emoji: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_shares: {
        Row: {
          channel: string | null
          created_at: string
          id: string
          post_id: string
          user_id: string | null
        }
        Insert: {
          channel?: string | null
          created_at?: string
          id?: string
          post_id: string
          user_id?: string | null
        }
        Update: {
          channel?: string | null
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_shares_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_views: {
        Row: {
          created_at: string
          id: string
          post_id: string
          session_hash: string | null
          viewer_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          session_hash?: string | null
          viewer_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          session_hash?: string | null
          viewer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_views_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          background: string | null
          caption: string | null
          content: string | null
          created_at: string
          cta_label: string | null
          cta_url: string | null
          hashtags: string[]
          id: string
          is_official: boolean
          kind: string
          media_url: string | null
          music_start_sec: number | null
          music_track_id: string | null
          music_volume: number | null
          pinned: boolean
          pinned_at: string | null
          thumbnail_url: string | null
          updated_at: string
          user_id: string
          visibility: string
        }
        Insert: {
          background?: string | null
          caption?: string | null
          content?: string | null
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          hashtags?: string[]
          id?: string
          is_official?: boolean
          kind: string
          media_url?: string | null
          music_start_sec?: number | null
          music_track_id?: string | null
          music_volume?: number | null
          pinned?: boolean
          pinned_at?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          user_id: string
          visibility?: string
        }
        Update: {
          background?: string | null
          caption?: string | null
          content?: string | null
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          hashtags?: string[]
          id?: string
          is_official?: boolean
          kind?: string
          media_url?: string | null
          music_start_sec?: number | null
          music_track_id?: string | null
          music_volume?: number | null
          pinned?: boolean
          pinned_at?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          user_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_music_track_id_fkey"
            columns: ["music_track_id"]
            isOneToOne: false
            referencedRelation: "story_music_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      profile_views: {
        Row: {
          id: string
          owner_id: string
          viewed_at: string
          viewer_id: string
        }
        Insert: {
          id?: string
          owner_id: string
          viewed_at?: string
          viewer_id: string
        }
        Update: {
          id?: string
          owner_id?: string
          viewed_at?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_views_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_views_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          banned_at: string | null
          bio: string | null
          birth_date: string | null
          created_at: string
          display_name: string
          goal: string | null
          id: string
          interests: string[]
          invited_by: string | null
          last_seen: string
          moderation_note: string | null
          onboarded: boolean
          show_city: boolean
          signup_campaign: string | null
          signup_landing: string | null
          signup_medium: string | null
          signup_referrer: string | null
          signup_source: string | null
          social_links: Json
          strike_count: number
          suspended_until: string | null
          updated_at: string
          username: string
          visibility: string
        }
        Insert: {
          avatar_url?: string | null
          banned_at?: string | null
          bio?: string | null
          birth_date?: string | null
          created_at?: string
          display_name: string
          goal?: string | null
          id: string
          interests?: string[]
          invited_by?: string | null
          last_seen?: string
          moderation_note?: string | null
          onboarded?: boolean
          show_city?: boolean
          signup_campaign?: string | null
          signup_landing?: string | null
          signup_medium?: string | null
          signup_referrer?: string | null
          signup_source?: string | null
          social_links?: Json
          strike_count?: number
          suspended_until?: string | null
          updated_at?: string
          username: string
          visibility?: string
        }
        Update: {
          avatar_url?: string | null
          banned_at?: string | null
          bio?: string | null
          birth_date?: string | null
          created_at?: string
          display_name?: string
          goal?: string | null
          id?: string
          interests?: string[]
          invited_by?: string | null
          last_seen?: string
          moderation_note?: string | null
          onboarded?: boolean
          show_city?: boolean
          signup_campaign?: string | null
          signup_landing?: string | null
          signup_medium?: string | null
          signup_referrer?: string | null
          signup_source?: string | null
          social_links?: Json
          strike_count?: number
          suspended_until?: string | null
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
      scheduled_lives: {
        Row: {
          cover_url: string | null
          created_at: string
          description: string | null
          host_alert_sent_at: string | null
          host_id: string
          id: string
          live_session_id: string | null
          reminder_sent_at: string | null
          scheduled_at: string
          status: string
          title: string
          updated_at: string
          will_record: boolean
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          host_alert_sent_at?: string | null
          host_id: string
          id?: string
          live_session_id?: string | null
          reminder_sent_at?: string | null
          scheduled_at: string
          status?: string
          title?: string
          updated_at?: string
          will_record?: boolean
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          host_alert_sent_at?: string | null
          host_id?: string
          id?: string
          live_session_id?: string | null
          reminder_sent_at?: string | null
          scheduled_at?: string
          status?: string
          title?: string
          updated_at?: string
          will_record?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_lives_live_session_id_fkey"
            columns: ["live_session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_posts: {
        Row: {
          background: string | null
          caption: string | null
          content: string | null
          created_at: string
          error_message: string | null
          hashtags: string[]
          id: string
          kind: string
          media_url: string | null
          music_track_id: string | null
          published_post_id: string | null
          scheduled_at: string
          status: string
          thumbnail_url: string | null
          updated_at: string
          user_id: string
          visibility: string
        }
        Insert: {
          background?: string | null
          caption?: string | null
          content?: string | null
          created_at?: string
          error_message?: string | null
          hashtags?: string[]
          id?: string
          kind: string
          media_url?: string | null
          music_track_id?: string | null
          published_post_id?: string | null
          scheduled_at: string
          status?: string
          thumbnail_url?: string | null
          updated_at?: string
          user_id: string
          visibility?: string
        }
        Update: {
          background?: string | null
          caption?: string | null
          content?: string | null
          created_at?: string
          error_message?: string | null
          hashtags?: string[]
          id?: string
          kind?: string
          media_url?: string | null
          music_track_id?: string | null
          published_post_id?: string | null
          scheduled_at?: string
          status?: string
          thumbnail_url?: string | null
          updated_at?: string
          user_id?: string
          visibility?: string
        }
        Relationships: []
      }
      scheduled_statuses: {
        Row: {
          background: string | null
          caption: string | null
          content: string | null
          created_at: string
          cta_label: string | null
          cta_url: string | null
          description: string | null
          error_message: string | null
          hashtags: string[]
          id: string
          kind: string
          media_url: string | null
          music_duration_sec: number
          music_start_sec: number
          music_track_id: string | null
          music_volume: number
          published_status_id: string | null
          scheduled_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          background?: string | null
          caption?: string | null
          content?: string | null
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          description?: string | null
          error_message?: string | null
          hashtags?: string[]
          id?: string
          kind: string
          media_url?: string | null
          music_duration_sec?: number
          music_start_sec?: number
          music_track_id?: string | null
          music_volume?: number
          published_status_id?: string | null
          scheduled_at: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          background?: string | null
          caption?: string | null
          content?: string | null
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          description?: string | null
          error_message?: string | null
          hashtags?: string[]
          id?: string
          kind?: string
          media_url?: string | null
          music_duration_sec?: number
          music_start_sec?: number
          music_track_id?: string | null
          music_volume?: number
          published_status_id?: string | null
          scheduled_at?: string
          status?: string
          updated_at?: string
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
      spam_signals: {
        Row: {
          auto_action: string | null
          content_hash: string | null
          conversation_id: string | null
          created_at: string
          id: string
          ip: string | null
          ip_hash: string | null
          message_id: string | null
          reasons: string[]
          score: number
          sender_id: string
          user_agent: string | null
        }
        Insert: {
          auto_action?: string | null
          content_hash?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          ip_hash?: string | null
          message_id?: string | null
          reasons?: string[]
          score?: number
          sender_id: string
          user_agent?: string | null
        }
        Update: {
          auto_action?: string | null
          content_hash?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          ip_hash?: string | null
          message_id?: string | null
          reasons?: string[]
          score?: number
          sender_id?: string
          user_agent?: string | null
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
          review_reason: string | null
          review_status: string
          reviewed_at: string | null
          status: string
          status_id: string
          target_age_max: number | null
          target_age_min: number | null
          target_countries: string[] | null
          target_gender: string
          target_interests: string[]
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
          review_reason?: string | null
          review_status?: string
          reviewed_at?: string | null
          status?: string
          status_id: string
          target_age_max?: number | null
          target_age_min?: number | null
          target_countries?: string[] | null
          target_gender?: string
          target_interests?: string[]
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
          review_reason?: string | null
          review_status?: string
          reviewed_at?: string | null
          status?: string
          status_id?: string
          target_age_max?: number | null
          target_age_min?: number | null
          target_countries?: string[] | null
          target_gender?: string
          target_interests?: string[]
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
      status_comment_reactions: {
        Row: {
          comment_id: string
          created_at: string
          emoji: string
          id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          emoji: string
          id?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          emoji?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_comment_reactions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "status_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      status_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          parent_id: string | null
          status_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          parent_id?: string | null
          status_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          status_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "status_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_comments_status_id_fkey"
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
          description: string | null
          expires_at: string
          hashtags: string[]
          id: string
          is_official: boolean
          kind: string
          media_url: string | null
          music_duration_sec: number
          music_start_sec: number
          music_track_id: string | null
          music_volume: number
          pinned: boolean
          pinned_at: string | null
          user_id: string
        }
        Insert: {
          background?: string | null
          caption?: string | null
          content?: string | null
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          description?: string | null
          expires_at?: string
          hashtags?: string[]
          id?: string
          is_official?: boolean
          kind: string
          media_url?: string | null
          music_duration_sec?: number
          music_start_sec?: number
          music_track_id?: string | null
          music_volume?: number
          pinned?: boolean
          pinned_at?: string | null
          user_id: string
        }
        Update: {
          background?: string | null
          caption?: string | null
          content?: string | null
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          description?: string | null
          expires_at?: string
          hashtags?: string[]
          id?: string
          is_official?: boolean
          kind?: string
          media_url?: string | null
          music_duration_sec?: number
          music_start_sec?: number
          music_track_id?: string | null
          music_volume?: number
          pinned?: boolean
          pinned_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "statuses_music_track_id_fkey"
            columns: ["music_track_id"]
            isOneToOne: false
            referencedRelation: "story_music_tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statuses_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      story_music_tracks: {
        Row: {
          artist: string
          audio_url: string
          cover_url: string | null
          created_at: string
          duration_sec: number
          genre: string | null
          id: string
          is_active: boolean
          license: string
          mood: string
          play_count: number
          sort_order: number
          source: string
          source_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          artist: string
          audio_url: string
          cover_url?: string | null
          created_at?: string
          duration_sec?: number
          genre?: string | null
          id?: string
          is_active?: boolean
          license?: string
          mood?: string
          play_count?: number
          sort_order?: number
          source?: string
          source_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          artist?: string
          audio_url?: string
          cover_url?: string | null
          created_at?: string
          duration_sec?: number
          genre?: string | null
          id?: string
          is_active?: boolean
          license?: string
          mood?: string
          play_count?: number
          sort_order?: number
          source?: string
          source_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          admin_reply: string | null
          created_at: string
          email: string
          id: string
          message: string
          name: string
          replied_at: string | null
          replied_by: string | null
          status: string
          updated_at: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          admin_reply?: string | null
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          replied_at?: string | null
          replied_by?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          admin_reply?: string | null
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          replied_at?: string | null
          replied_by?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
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
      user_badges: {
        Row: {
          awarded_at: string
          awarded_by: string | null
          badge_id: string
          id: string
          user_id: string
        }
        Insert: {
          awarded_at?: string
          awarded_by?: string | null
          badge_id: string
          id?: string
          user_id: string
        }
        Update: {
          awarded_at?: string
          awarded_by?: string | null
          badge_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_awarded_by_fkey"
            columns: ["awarded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      user_coins: {
        Row: {
          balance: number
          lifetime_earned: number
          lifetime_spent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          lifetime_earned?: number
          lifetime_spent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          lifetime_earned?: number
          lifetime_spent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      user_trust_scores: {
        Row: {
          components: Json
          score: number
          updated_at: string
          user_id: string
        }
        Insert: {
          components?: Json
          score?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          components?: Json
          score?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_award_badge: {
        Args: { _badge_code: string; _user_id: string }
        Returns: undefined
      }
      admin_boost_overview: { Args: { _days?: number }; Returns: Json }
      admin_invites_overview: { Args: never; Returns: Json }
      admin_list_admins: { Args: never; Returns: Json }
      admin_newsletter_stats: { Args: never; Returns: Json }
      admin_onboarding_survey_stats: { Args: { _days?: number }; Returns: Json }
      admin_push_logs: { Args: { _days?: number }; Returns: Json }
      admin_revoke_badge: {
        Args: { _badge_code: string; _user_id: string }
        Returns: undefined
      }
      admin_send_newsletter: { Args: { _post_id: string }; Returns: Json }
      admin_signup_sources: { Args: never; Returns: Json }
      admin_usage_analytics: { Args: { _days?: number }; Returns: Json }
      admin_user_activity_stats: { Args: never; Returns: Json }
      admin_user_confirmation_stats: { Args: never; Returns: Json }
      can_view_full_profile: { Args: { _owner: string }; Returns: boolean }
      can_view_profile: {
        Args: { _owner: string; _viewer: string }
        Returns: boolean
      }
      check_account_rate_limit: {
        Args: { _action: string; _user_id: string }
        Returns: Json
      }
      claim_invite_reward: { Args: never; Returns: Json }
      cleanup_stale_lives: { Args: { p_minutes?: number }; Returns: number }
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
      discover_public_posts: {
        Args: { _limit?: number; _offset?: number }
        Returns: {
          avatar_url: string
          background: string
          caption: string
          comments_count: number
          content: string
          created_at: string
          cta_label: string
          cta_url: string
          display_name: string
          hashtags: string[]
          is_boosted: boolean
          is_official: boolean
          kind: string
          media_url: string
          music_track_id: string
          pinned: boolean
          post_id: string
          reactions_count: number
          thumbnail_url: string
          user_id: string
          username: string
          viewer_already_liked: boolean
          views_count: number
        }[]
      }
      discover_public_statuses: {
        Args: { _limit?: number; _offset?: number }
        Returns: {
          avatar_url: string
          background: string
          caption: string
          city: string
          comments_count: number
          content: string
          created_at: string
          cta_label: string
          cta_url: string
          description: string
          display_name: string
          expires_at: string
          hashtags: string[]
          is_boosted: boolean
          is_official: boolean
          kind: string
          media_url: string
          reactions_count: number
          score: number
          status_id: string
          user_id: string
          username: string
          viewer_already_follows: boolean
          viewer_already_liked: boolean
          views_count: number
        }[]
      }
      dispatch_status_push: {
        Args: {
          _comment_id: string
          _emoji: string
          _kind: string
          _preview: string
          _sender_id: string
          _status_id: string
        }
        Returns: undefined
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      end_live: { Args: { p_live_id: string }; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      extract_mentions: { Args: { p_text: string }; Returns: string[] }
      get_admin_invite_overview: { Args: never; Returns: Json }
      get_ambassador_level: { Args: { _user_id: string }; Returns: Json }
      get_boost_report: { Args: { _boost_id: string }; Returns: Json }
      get_hashtag_people: {
        Args: { _limit?: number; _tag: string }
        Returns: {
          avatar_url: string
          city: string
          display_name: string
          last_caption: string
          last_status_id: string
          last_used_at: string
          shares_conversation: boolean
          user_id: string
          username: string
          uses_count: number
          viewer_follows: boolean
        }[]
      }
      get_invite_stats: { Args: never; Returns: Json }
      get_live_pix_info: {
        Args: { p_live_id: string }
        Returns: {
          city: string
          pix_key: string
          pix_key_type: string
          recipient_name: string
        }[]
      }
      get_my_invite_stats: { Args: never; Returns: Json }
      get_my_restrictions: { Args: never; Returns: Json }
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
      get_post_boost_report: { Args: { _boost_id: string }; Returns: Json }
      get_public_post: {
        Args: { _post_id: string }
        Returns: {
          avatar_url: string
          background: string
          caption: string
          comments_count: number
          content: string
          created_at: string
          display_name: string
          hashtags: string[]
          is_official: boolean
          kind: string
          media_url: string
          music_track_id: string
          post_id: string
          reactions_count: number
          thumbnail_url: string
          user_id: string
          username: string
          views_count: number
        }[]
      }
      get_public_post_comments: {
        Args: { _post_id: string }
        Returns: {
          avatar_url: string
          content: string
          created_at: string
          display_name: string
          id: string
          parent_id: string
          post_id: string
          reactions_count: number
          user_id: string
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
      get_status_push_secret: { Args: never; Returns: string }
      get_status_share_count: { Args: { _status_id: string }; Returns: number }
      get_status_view_count: { Args: { _status_id: string }; Returns: number }
      get_top_ambassadors: {
        Args: { _limit?: number }
        Returns: {
          avatar_url: string
          display_name: string
          invited: number
          tier_icon: string
          tier_name: string
          user_id: string
          username: string
        }[]
      }
      get_top_hosts_weekly: {
        Args: { p_limit?: number }
        Returns: {
          avatar_url: string
          display_name: string
          gifts_count: number
          host_id: string
          lives_count: number
          total_coins: number
          username: string
        }[]
      }
      get_trending_hashtags: {
        Args: { _limit?: number }
        Returns: {
          authors_count: number
          last_used_at: string
          tag: string
          uses_count: number
        }[]
      }
      get_user_badges: {
        Args: { _user_id: string }
        Returns: {
          awarded_at: string
          category: string
          code: string
          color: string
          description: string
          display_priority: number
          icon: string
          name: string
          tier: number
        }[]
      }
      get_user_posts_archive: {
        Args: { _user_id: string }
        Returns: {
          background: string
          caption: string
          comment_count: number
          content: string
          created_at: string
          id: string
          kind: string
          media_url: string
          pinned: boolean
          pinned_at: string
          reaction_count: number
          user_id: string
        }[]
      }
      get_user_status_archive: {
        Args: { _user_id: string }
        Returns: {
          background: string
          caption: string
          comment_count: number
          content: string
          created_at: string
          expires_at: string
          id: string
          kind: string
          media_url: string
          pinned: boolean
          pinned_at: string
          reaction_count: number
          user_id: string
          view_count: number
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
      heartbeat_viewer: { Args: { p_live_id: string }; Returns: number }
      host_live_heartbeat: { Args: { p_live_id: string }; Returns: undefined }
      increment_music_play_count: {
        Args: { _track_id: string }
        Returns: undefined
      }
      is_conversation_member: {
        Args: { _conv_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_admin: {
        Args: { _conv_id: string; _user_id: string }
        Returns: boolean
      }
      is_ip_hash_banned: { Args: { _ip_hash: string }; Returns: boolean }
      is_protected_superadmin_email: {
        Args: { _user_id: string }
        Returns: boolean
      }
      is_user_restricted: { Args: { _user_id: string }; Returns: Json }
      is_wavechat_official_account: {
        Args: { _user_id: string }
        Returns: boolean
      }
      leave_stage: { Args: { p_live_id: string }; Returns: undefined }
      list_active_music_tracks: {
        Args: { _mood?: string; _search?: string }
        Returns: {
          artist: string
          audio_url: string
          cover_url: string | null
          created_at: string
          duration_sec: number
          genre: string | null
          id: string
          is_active: boolean
          license: string
          mood: string
          play_count: number
          sort_order: number
          source: string
          source_url: string | null
          title: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "story_music_tracks"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      log_compliance_access: {
        Args: {
          _data_accessed: string
          _data_summary?: Json
          _ip_hash?: string
          _reason: string
          _request_id: string
          _target_user_id: string
          _user_agent?: string
        }
        Returns: string
      }
      log_music_play: {
        Args: { _source?: string; _track_id: string }
        Returns: undefined
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
      new_music_tracks: {
        Args: { _limit?: number }
        Returns: {
          artist: string
          audio_url: string
          cover_url: string | null
          created_at: string
          duration_sec: number
          genre: string | null
          id: string
          is_active: boolean
          license: string
          mood: string
          play_count: number
          sort_order: number
          source: string
          source_url: string | null
          title: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "story_music_tracks"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      propagate_severe_ban: {
        Args: { _reason: string; _user_id: string }
        Returns: undefined
      }
      public_discover_people: {
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
          username: string
        }[]
      }
      public_online_users: {
        Args: { _limit?: number }
        Returns: {
          avatar_url: string
          display_name: string
          online_at: string
          user_id: string
          username: string
          visibility: string
        }[]
      }
      public_search_users: {
        Args: { q: string }
        Returns: {
          avatar_url: string
          display_name: string
          id: string
          username: string
        }[]
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      recompute_device_risk: { Args: { _fp_hash: string }; Returns: string }
      recompute_ip_risk: { Args: { _ip_hash: string }; Returns: string }
      recompute_trust_score: { Args: { _user_id: string }; Returns: number }
      recompute_user_badges: { Args: { _user_id: string }; Returns: undefined }
      record_profile_view: { Args: { _owner: string }; Returns: undefined }
      record_status_share: { Args: { _status_id: string }; Returns: undefined }
      redeem_free_boost: { Args: { _status_id: string }; Returns: Json }
      register_ban: { Args: { _user_id: string }; Returns: undefined }
      register_boost_click: { Args: { _status_id: string }; Returns: Json }
      register_device_seen: {
        Args: { _fp_hash: string; _user_id: string }
        Returns: undefined
      }
      register_ip_seen: {
        Args: {
          _country?: string
          _ip_hash: string
          _region?: string
          _user_id: string
        }
        Returns: undefined
      }
      register_post_boost_click: { Args: { _post_id: string }; Returns: Json }
      register_post_view: {
        Args: { _post_id: string; _session_hash?: string }
        Returns: undefined
      }
      register_status_view: { Args: { _status_id: string }; Returns: Json }
      report_message_with_snapshot: {
        Args: { _details?: string; _message_id: string; _reason: string }
        Returns: string
      }
      request_profile_view: { Args: { _owner: string }; Returns: Json }
      request_stage: {
        Args: { p_live_id: string }
        Returns: {
          created_at: string
          id: string
          live_id: string
          status: Database["public"]["Enums"]["stage_request_status"]
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "live_stage_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolve_stage_request: {
        Args: {
          p_new_status: Database["public"]["Enums"]["stage_request_status"]
          p_request_id: string
        }
        Returns: {
          created_at: string
          id: string
          live_id: string
          status: Database["public"]["Enums"]["stage_request_status"]
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "live_stage_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
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
      send_live_gift: {
        Args: { p_gift_id: string; p_live_id: string; p_quantity?: number }
        Returns: {
          coins_spent: number
          created_at: string
          gift_id: string
          id: string
          live_id: string
          quantity: number
          sender_id: string
        }
        SetofOptions: {
          from: "*"
          to: "live_gifts_sent"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      send_live_reaction: {
        Args: { p_emoji: string; p_live_id: string }
        Returns: undefined
      }
      start_live: {
        Args: { p_cover_url?: string; p_title: string }
        Returns: {
          cover_url: string | null
          created_at: string
          ended_at: string | null
          host_id: string
          host_last_seen: string
          id: string
          livekit_room: string
          peak_viewers: number
          scheduled_live_id: string | null
          started_at: string
          status: Database["public"]["Enums"]["live_status"]
          title: string
          total_gift_coins: number
          total_reactions: number
          viewer_count: number
          will_record: boolean
        }
        SetofOptions: {
          from: "*"
          to: "live_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      survey_interest_tags: { Args: { _user_id: string }; Returns: string[] }
      toggle_follow: { Args: { _target: string }; Returns: boolean }
      toggle_post_pin: { Args: { _post_id: string }; Returns: boolean }
      toggle_status_pin: { Args: { _status_id: string }; Returns: boolean }
      trending_music_tracks: {
        Args: { _days?: number; _limit?: number }
        Returns: {
          artist: string
          audio_url: string
          cover_url: string
          created_at: string
          duration_sec: number
          genre: string
          id: string
          is_active: boolean
          license: string
          mood: string
          play_count: number
          sort_order: number
          source: string
          source_url: string
          title: string
          trend_plays: number
          updated_at: string
        }[]
      }
      users_share_conversation: {
        Args: { _a: string; _b: string }
        Returns: boolean
      }
      write_audit_log: {
        Args: {
          _action: string
          _device_hash?: string
          _ip_hash?: string
          _metadata?: Json
          _target_id?: string
          _target_type?: string
          _target_user_id?: string
          _user_agent?: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "user" | "moderator" | "superadmin"
      group_category:
        | "business"
        | "tech"
        | "games"
        | "music"
        | "entertainment"
        | "relationships"
        | "travel"
        | "sports"
        | "education"
        | "other"
      group_join_policy: "open" | "request"
      group_join_request_status: "pending" | "approved" | "rejected"
      group_report_reason:
        | "spam"
        | "adult"
        | "violence"
        | "scam"
        | "copyright"
        | "other"
      group_report_status: "pending" | "reviewed" | "dismissed" | "actioned"
      group_visibility: "private" | "public"
      live_status: "live" | "ended"
      moderation_action_type:
        | "warning"
        | "content_removed"
        | "suspended"
        | "banned"
        | "content_hidden"
        | "report_rejected"
        | "unsuspended"
        | "unbanned"
      report_status: "pending" | "in_review" | "resolved" | "rejected"
      report_target_type:
        | "profile"
        | "status"
        | "message"
        | "group"
        | "conversation"
        | "status_comment"
        | "post"
        | "post_comment"
        | "live"
        | "platform"
      stage_request_status:
        | "pending"
        | "approved"
        | "rejected"
        | "kicked"
        | "left"
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
      group_category: [
        "business",
        "tech",
        "games",
        "music",
        "entertainment",
        "relationships",
        "travel",
        "sports",
        "education",
        "other",
      ],
      group_join_policy: ["open", "request"],
      group_join_request_status: ["pending", "approved", "rejected"],
      group_report_reason: [
        "spam",
        "adult",
        "violence",
        "scam",
        "copyright",
        "other",
      ],
      group_report_status: ["pending", "reviewed", "dismissed", "actioned"],
      group_visibility: ["private", "public"],
      live_status: ["live", "ended"],
      moderation_action_type: [
        "warning",
        "content_removed",
        "suspended",
        "banned",
        "content_hidden",
        "report_rejected",
        "unsuspended",
        "unbanned",
      ],
      report_status: ["pending", "in_review", "resolved", "rejected"],
      report_target_type: [
        "profile",
        "status",
        "message",
        "group",
        "conversation",
        "status_comment",
        "post",
        "post_comment",
        "live",
        "platform",
      ],
      stage_request_status: [
        "pending",
        "approved",
        "rejected",
        "kicked",
        "left",
      ],
    },
  },
} as const
