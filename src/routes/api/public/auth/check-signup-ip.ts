import { createFileRoute } from "@tanstack/react-router";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { createHash } from "crypto";

// Endpoint público chamado ANTES do cadastro para bloquear IPs banidos
// por abuso anterior (spam grave / conteúdo ilegal). Privacidade: o IP
// nunca é retornado nem armazenado; comparamos apenas o hash com pepper.

const PEPPER = process.env.SPAM_HASH_PEPPER || "wavechat-default-pepper";

function sha(value: string) {
  return createHash("sha256").update(`${PEPPER}:${value}`).digest("hex");
}

export const Route = createFileRoute("/api/public/auth/check-signup-ip")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const rawIp =
            getRequestHeader("cf-connecting-ip") ||
            getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ||
            getRequestIP({ xForwardedFor: true }) ||
            null;

          if (!rawIp) {
            // Não conseguimos identificar a origem — permitimos.
            return Response.json({ allowed: true });
          }

          const ipHash = sha(`ip:${rawIp}`);
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data, error } = await supabaseAdmin.rpc("is_ip_hash_banned", {
            _ip_hash: ipHash,
          });
          if (error) {
            return Response.json({ allowed: true });
          }
          return Response.json({ allowed: !data });
        } catch {
          return Response.json({ allowed: true });
        }
      },
    },
  },
});
