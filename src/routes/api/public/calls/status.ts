import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createClient } from "@supabase/supabase-js";

const StatusQuerySchema = z.object({
  callId: z.string().uuid(),
});

export const Route = createFileRoute("/api/public/calls/status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const parsed = StatusQuerySchema.safeParse({
          callId: new URL(request.url).searchParams.get("callId"),
        });
        if (!parsed.success) return new Response("Invalid call id", { status: 400 });

        // Require authenticated user
        const authHeader = request.headers.get("authorization") || "";
        const token = authHeader.toLowerCase().startsWith("bearer ")
          ? authHeader.slice(7)
          : "";
        if (!token) return new Response("Unauthorized", { status: 401 });

        const userClient = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { global: { headers: { Authorization: `Bearer ${token}` } } },
        );
        const { data: userData, error: userErr } = await userClient.auth.getUser();
        if (userErr || !userData?.user) return new Response("Unauthorized", { status: 401 });
        const userId = userData.user.id;

        const { data, error } = await (supabaseAdmin as any)
          .from("calls")
          .select("status, updated_at, ended_at, caller_id, callee_id")
          .eq("id", parsed.data.callId)
          .maybeSingle();

        if (error) return Response.json({ error: "Could not read call" }, { status: 500 });
        if (!data) return Response.json({ status: "ended" });

        // Only caller or callee may read call status
        if (data.caller_id !== userId && data.callee_id !== userId) {
          return new Response("Forbidden", { status: 403 });
        }

        return Response.json({
          status: data.status,
          updatedAt: data.updated_at,
          endedAt: data.ended_at,
        });
      },
    },
  },
});
