import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "crypto";

// LiveKit Egress webhook: notified when a recording starts / ends / fails.
// Configure the webhook URL in LiveKit Cloud project settings:
//   https://<project>.lovable.app/api/public/hooks/livekit-egress
// Validation: LiveKit signs payloads via the `Authorization` header (JWT) but
// also supports webhook signing keys; we accept either via shared secret.

export const Route = createFileRoute("/api/public/hooks/livekit-egress")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.text();

        // Optional shared-secret signature (recommended). LiveKit sends `Authorization: <token>`.
        // Require signature validation — reject if secret is not configured.
        const wantSecret = process.env.LIVEKIT_WEBHOOK_SECRET;
        if (!wantSecret) {
          return new Response("Webhook secret not configured", { status: 503 });
        }
        const sigHeader = request.headers.get("x-livekit-signature") ?? request.headers.get("authorization") ?? "";
        const expected = createHmac("sha256", wantSecret).update(body).digest("hex");
        const a = Buffer.from(sigHeader);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: {
          event?: string;
          egressInfo?: {
            egress_id?: string;
            status?: string;
            file?: { filename?: string; size?: number; duration?: number; location?: string };
            file_results?: Array<{ filename?: string; size?: number; duration?: number; location?: string }>;
          };
        } = {};
        try {
          payload = JSON.parse(body);
        } catch {
          return new Response("bad payload", { status: 400 });
        }

        const info = payload.egressInfo;
        const egressId = info?.egress_id;
        if (!egressId) return Response.json({ ok: true, ignored: true });

        const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });

        const fileRes = info?.file_results?.[0] ?? info?.file;
        const update: Record<string, unknown> = {};
        const event = payload.event ?? "";

        if (event === "egress_started") {
          update.status = "recording";
        } else if (event === "egress_updated") {
          update.status = info?.status === "EGRESS_ENDING" ? "processing" : "recording";
        } else if (event === "egress_ended") {
          const ok = info?.status === "EGRESS_COMPLETE" || !!fileRes?.location;
          update.status = ok ? "ready" : "failed";
          if (fileRes?.duration) update.duration_sec = Math.round(Number(fileRes.duration) / 1_000_000_000); // ns→s
          if (fileRes?.size) update.size_bytes = Number(fileRes.size);
          if (fileRes?.filename) update.storage_path = fileRes.filename;
          if (fileRes?.location) update.file_url = fileRes.location;
          update.ended_at = new Date().toISOString();
        }

        if (Object.keys(update).length) {
          await sb.from("live_recordings").update(update).eq("livekit_egress_id", egressId);
        }
        return Response.json({ ok: true });
      },
    },
  },
});
