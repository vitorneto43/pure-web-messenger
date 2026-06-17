import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

// Runs every minute (pg_cron). Publishes scheduled posts/statuses and sends
// live reminders 30 minutes before scheduled lives.
export const Route = createFileRoute("/api/public/hooks/scheduler-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey");
        if (!apikey || apikey !== process.env.SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Unauthorized", { status: 401 });
        }
        const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });

        const summary = { posts: 0, statuses: 0, reminded: 0, hostAlerted: 0, missed: 0 };
        const nowIso = new Date().toISOString();

        // ---- 1. publish scheduled posts ----
        const { data: duePosts } = await sb
          .from("scheduled_posts")
          .select("*")
          .eq("status", "pending")
          .lte("scheduled_at", nowIso)
          .limit(50);
        for (const p of duePosts ?? []) {
          try {
            const { data: inserted, error } = await sb
              .from("posts")
              .insert({
                user_id: p.user_id,
                kind: p.kind,
                content: p.content,
                media_url: p.media_url,
                thumbnail_url: p.thumbnail_url,
                caption: p.caption,
                background: p.background,
                hashtags: p.hashtags ?? [],
                music_track_id: p.music_track_id,
                visibility: p.visibility,
              })
              .select("id")
              .single();
            if (error) throw error;
            await sb
              .from("scheduled_posts")
              .update({ status: "published", published_post_id: inserted.id })
              .eq("id", p.id);
            summary.posts++;
          } catch (e: unknown) {
            await sb
              .from("scheduled_posts")
              .update({ status: "failed", error_message: e instanceof Error ? e.message : String(e) })
              .eq("id", p.id);
          }
        }

        // ---- 2. publish scheduled statuses ----
        const { data: dueStatuses } = await sb
          .from("scheduled_statuses")
          .select("*")
          .eq("status", "pending")
          .lte("scheduled_at", nowIso)
          .limit(50);
        for (const s of dueStatuses ?? []) {
          try {
            const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
            const { data: inserted, error } = await sb
              .from("statuses")
              .insert({
                user_id: s.user_id,
                kind: s.kind,
                content: s.content,
                media_url: s.media_url,
                caption: s.caption,
                background: s.background,
                description: s.description,
                hashtags: s.hashtags ?? [],
                cta_url: s.cta_url,
                cta_label: s.cta_label,
                music_track_id: s.music_track_id,
                music_start_sec: s.music_start_sec,
                music_duration_sec: s.music_duration_sec,
                music_volume: s.music_volume,
                expires_at: expiresAt,
              })
              .select("id")
              .single();
            if (error) throw error;
            await sb
              .from("scheduled_statuses")
              .update({ status: "published", published_status_id: inserted.id })
              .eq("id", s.id);
            summary.statuses++;
          } catch (e: unknown) {
            await sb
              .from("scheduled_statuses")
              .update({ status: "failed", error_message: e instanceof Error ? e.message : String(e) })
              .eq("id", s.id);
          }
        }

        // ---- 3. live reminders (T-30min) and host alerts (T-0) ----
        const in31 = new Date(Date.now() + 31 * 60 * 1000).toISOString();
        const in1 = new Date(Date.now() + 60 * 1000).toISOString();
        const { data: upcoming } = await sb
          .from("scheduled_lives")
          .select("id,host_id,title,scheduled_at,reminder_sent_at,host_alert_sent_at,status")
          .in("status", ["scheduled", "reminded"])
          .lte("scheduled_at", in31)
          .gte("scheduled_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());

        try {
          if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT) {
            webpush.setVapidDetails(process.env.VAPID_SUBJECT, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
          }
        } catch {}

        for (const sl of upcoming ?? []) {
          const due30 =
            !sl.reminder_sent_at &&
            new Date(sl.scheduled_at).getTime() - Date.now() <= 30 * 60 * 1000 &&
            new Date(sl.scheduled_at).getTime() - Date.now() >= -2 * 60 * 1000;

          if (due30) {
            const { data: host } = await sb
              .from("profiles")
              .select("display_name,username,avatar_url")
              .eq("id", sl.host_id)
              .maybeSingle();
            const hostName = host?.display_name || host?.username || "Alguém";
            const title = `🔴 ${hostName} entra ao vivo em 30 min`;
            const body = sl.title || "Não perca!";
            const url = `/live`;

            // followers
            const { data: followers } = await sb
              .from("profile_follows")
              .select("follower_id")
              .eq("following_id", sl.host_id);
            const followerIds = (followers ?? []).map((f) => f.follower_id);

            if (followerIds.length) {
              // in-app notifications
              await sb.from("notifications").insert(
                followerIds.map((uid) => ({
                  user_id: uid,
                  type: "live_upcoming",
                  title,
                  body,
                  data: { scheduled_live_id: sl.id, host_id: sl.host_id, scheduled_at: sl.scheduled_at },
                })),
              );

              // web push
              const { data: subs } = await sb
                .from("push_subscriptions")
                .select("id,endpoint,p256dh,auth")
                .in("user_id", followerIds);
              if (subs?.length) {
                const payload = JSON.stringify({ type: "live_upcoming", title, body, url });
                await Promise.all(
                  subs.map(async (sub) => {
                    try {
                      await webpush.sendNotification(
                        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                        payload,
                        { TTL: 60 * 30, urgency: "normal" },
                      );
                    } catch (e: unknown) {
                      const err = e as { statusCode?: number };
                      if (err.statusCode === 404 || err.statusCode === 410) {
                        await sb.from("push_subscriptions").delete().eq("id", sub.id);
                      }
                    }
                  }),
                );
              }
            }
            await sb
              .from("scheduled_lives")
              .update({ status: "reminded", reminder_sent_at: new Date().toISOString() })
              .eq("id", sl.id);
            summary.reminded++;
          }

          // host alert (T-0)
          const dueHost =
            !sl.host_alert_sent_at &&
            new Date(sl.scheduled_at).getTime() <= Date.now() + 60 * 1000 &&
            new Date(sl.scheduled_at).getTime() >= Date.now() - 5 * 60 * 1000;
          if (dueHost) {
            await sb.from("notifications").insert({
              user_id: sl.host_id,
              type: "live_host_alert",
              title: "Hora da sua live ⏰",
              body: sl.title || "Toque para começar a transmitir",
              data: { scheduled_live_id: sl.id },
            });
            await sb
              .from("scheduled_lives")
              .update({ host_alert_sent_at: new Date().toISOString() })
              .eq("id", sl.id);
            summary.hostAlerted++;
          }
        }

        // ---- 4. mark very old missed scheduled lives ----
        const stale = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
        const { count } = await sb
          .from("scheduled_lives")
          .update({ status: "missed" }, { count: "exact" })
          .in("status", ["scheduled", "reminded"])
          .lt("scheduled_at", stale)
          .is("live_session_id", null);
        summary.missed = count ?? 0;

        // Ignore unused vars in production
        void in1;

        return Response.json({ ok: true, summary });
      },
    },
  },
});
