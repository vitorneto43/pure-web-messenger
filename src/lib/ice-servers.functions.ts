import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Fallback ICE servers (STUN + free public TURN) used if Metered fails.
const FALLBACK_ICE: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
];

export const getIceServers = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ iceServers: RTCIceServer[] }> => {
    const app = process.env.METERED_APP_NAME;
    const apiKey = process.env.METERED_API_KEY;

    if (!app || !apiKey) {
      return { iceServers: FALLBACK_ICE };
    }

    try {
      const res = await fetch(
        `https://${app}.metered.live/api/v1/turn/credentials?apiKey=${apiKey}`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (!res.ok) {
        console.error("Metered TURN fetch failed:", res.status);
        return { iceServers: FALLBACK_ICE };
      }
      const data = (await res.json()) as RTCIceServer[];
      if (!Array.isArray(data) || data.length === 0) {
        return { iceServers: FALLBACK_ICE };
      }
      // Prepend Google STUN as extra redundancy.
      return {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          ...data,
        ],
      };
    } catch (err) {
      console.error("Metered TURN error:", err);
      return { iceServers: FALLBACK_ICE };
    }
  }
);
