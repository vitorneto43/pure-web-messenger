import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'
import { render } from '@react-email/components'
import * as React from 'react'
import { TEMPLATES } from '@/lib/email-templates/registry'

// Cron route: scans for messages unread for > 2 minutes and < 24h,
// where the recipient was NOT online in the last 90 seconds, and enqueues
// one "new message" email per recipient at most once per hour.

export const Route = createFileRoute('/api/public/hooks/unread-message-emails')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Cron auth: Supabase anon key in apikey header
        const apikey = request.headers.get('apikey') || ''
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY || ''
        if (!apikey || !expected || apikey !== expected) {
          return new Response('Unauthorized', { status: 401 })
        }

        const supabaseUrl = process.env.SUPABASE_URL!
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
        const supabase = createClient(supabaseUrl, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })

        // Pull candidate recipients — messages unread for >2min, <24h old.
        let rows: Array<any> = []
        {
          const q = await supabase
            .from('messages')
            .select('id, conversation_id, sender_id, content, created_at')
            .is('read_at', null)
            .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
            .lte('created_at', new Date(Date.now() - 2 * 60 * 1000).toISOString())
            .order('created_at', { ascending: false })
            .limit(500)
          if (q.error) return Response.json({ error: q.error.message }, { status: 500 })
          rows = q.data ?? []
        }

        if (!rows || rows.length === 0) {
          return Response.json({ ok: true, enqueued: 0, reason: 'no_candidates' })
        }

        // Aggregate by (recipient_id) — pick most recent message per recipient.
        // recipient = the conversation member that is NOT the sender, in 1-1 chats.
        // Group messages by conversation; resolve recipients via conversation_members.
        const convIds = Array.from(new Set(rows.map((r: any) => r.conversation_id)))
        const { data: members } = await supabase
          .from('conversation_members')
          .select('conversation_id, user_id')
          .in('conversation_id', convIds)

        const { data: convs } = await supabase
          .from('conversations')
          .select('id, is_group')
          .in('id', convIds)
        const groupIds = new Set((convs ?? []).filter((c: any) => c.is_group).map((c: any) => c.id))

        // Build recipient → latest unread message map (skip group chats for now)
        type Cand = { recipientId: string; senderId: string; conversationId: string; messageId: string; content: string; createdAt: string }
        const perRecipient = new Map<string, Cand>()
        for (const m of rows) {
          if (groupIds.has(m.conversation_id)) continue
          const pair = (members ?? []).filter((x: any) => x.conversation_id === m.conversation_id)
          const recip = pair.find((p: any) => p.user_id !== m.sender_id)?.user_id
          if (!recip) continue
          const existing = perRecipient.get(recip)
          if (!existing || existing.createdAt < m.created_at) {
            perRecipient.set(recip, {
              recipientId: recip,
              senderId: m.sender_id,
              conversationId: m.conversation_id,
              messageId: m.id,
              content: m.content ?? '',
              createdAt: m.created_at,
            })
          }
        }

        if (perRecipient.size === 0) {
          return Response.json({ ok: true, enqueued: 0, reason: 'no_dm_recipients' })
        }

        const recipientIds = Array.from(perRecipient.keys())
        const senderIds = Array.from(new Set(Array.from(perRecipient.values()).map((c) => c.senderId)))

        const { data: recipientProfiles } = await supabase
          .from('profiles')
          .select('id, display_name, username, last_seen')
          .in('id', recipientIds)
        const { data: senderProfiles } = await supabase
          .from('profiles')
          .select('id, display_name, username')
          .in('id', senderIds)
        const { data: privEmails } = await supabase
          .from('profiles_private')
          .select('user_id, email')
          .in('user_id', recipientIds)

        const recipMap = new Map<string, any>((recipientProfiles ?? []).map((p: any) => [p.id, p]))
        const senderMap = new Map<string, any>((senderProfiles ?? []).map((p: any) => [p.id, p]))
        const emailMap = new Map<string, string>((privEmails ?? []).map((p: any) => [p.user_id, p.email]))

        // Recent suppressions: skip if email is in suppressed_emails or recently emailed (<1h)
        const allEmails = Array.from(new Set(Array.from(emailMap.values()).map((e) => e.toLowerCase())))
        const { data: suppressed } = await supabase
          .from('suppressed_emails')
          .select('email')
          .in('email', allEmails)
        const suppressedSet = new Set((suppressed ?? []).map((s: any) => s.email))

        const sinceHour = new Date(Date.now() - 60 * 60 * 1000).toISOString()
        const { data: recentSends } = await supabase
          .from('email_send_log')
          .select('recipient_email, created_at, template_name')
          .gte('created_at', sinceHour)
          .in('recipient_email', allEmails)
        const recentlyEmailed = new Set(
          (recentSends ?? [])
            .filter((r: any) => r.template_name === 'new-message')
            .map((r: any) => r.recipient_email),
        )

        let enqueued = 0
        const skipped: Record<string, number> = {}
        const tpl = TEMPLATES['new-message']

        for (const cand of perRecipient.values()) {
          const recip = recipMap.get(cand.recipientId)
          if (!recip) { skipped.no_profile = (skipped.no_profile || 0) + 1; continue }
          // Skip if user was active in the last 90s (probably online)
          if (recip.last_seen && Date.now() - new Date(recip.last_seen).getTime() < 90_000) {
            skipped.online = (skipped.online || 0) + 1
            continue
          }
          const email = (emailMap.get(cand.recipientId) || '').toLowerCase()
          if (!email) { skipped.no_email = (skipped.no_email || 0) + 1; continue }
          if (suppressedSet.has(email)) { skipped.suppressed = (skipped.suppressed || 0) + 1; continue }
          if (recentlyEmailed.has(email)) { skipped.throttled = (skipped.throttled || 0) + 1; continue }

          const sender = senderMap.get(cand.senderId)
          const senderName = sender?.display_name || sender?.username || 'Alguém'
          const recipientName = recip?.display_name || recip?.username || undefined

          const templateData = {
            recipientName,
            senderName,
            preview: cand.content,
            conversationUrl: `https://webconnectchat.com/chat/${cand.conversationId}`,
            unreadCount: 1,
          }

          let html: string
          let plainText: string
          try {
            const el = React.createElement(tpl.component as any, templateData)
            html = await render(el)
            plainText = await render(el, { plainText: true })
          } catch (e) {
            skipped.render_failed = (skipped.render_failed || 0) + 1
            continue
          }
          const subject = typeof tpl.subject === 'function' ? tpl.subject(templateData) : tpl.subject
          const messageId = `new-message-${cand.recipientId}-${Math.floor(Date.now() / (60 * 60 * 1000))}`

          await supabase.rpc('enqueue_email', {
            queue_name: 'transactional_emails',
            payload: {
              template_name: 'new-message',
              recipient_email: email,
              subject,
              html,
              plain_text: plainText,
              message_id: messageId,
              metadata: { kind: 'new-message', conversation_id: cand.conversationId },
            } as any,
          })

          await supabase.from('email_send_log').insert({
            message_id: messageId,
            template_name: 'new-message',
            recipient_email: email,
            status: 'pending',
            metadata: { conversation_id: cand.conversationId },
          })

          enqueued++
        }

        return Response.json({ ok: true, enqueued, candidates: perRecipient.size, skipped })
      },
    },
  },
})
