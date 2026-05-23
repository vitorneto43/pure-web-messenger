import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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

        const { data, error } = await (supabaseAdmin as any)
          .from("calls")
          .select("status, updated_at, ended_at")
          .eq("id", parsed.data.callId)
          .maybeSingle();

        if (error) return Response.json({ error: "Could not read call" }, { status: 500 });
        if (!data) return Response.json({ status: "ended" });

        return Response.json({
          status: data.status,
          updatedAt: data.updated_at,
          endedAt: data.ended_at,
        });
      },
    },
  },
});