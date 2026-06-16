// Server-only helper to mint LiveKit JWTs using HS256 via Web Crypto.
// Compatible with the Cloudflare Worker runtime (no Node-only deps).

function toB64Url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  // btoa works in workerd runtime
  return btoa(bin).replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function signJwtHS256(payload: Record<string, unknown>, secret: string): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const enc = new TextEncoder();
  const headerB64 = toB64Url(enc.encode(JSON.stringify(header)));
  const payloadB64 = toB64Url(enc.encode(JSON.stringify(payload)));
  const data = enc.encode(`${headerB64}.${payloadB64}`);
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, data);
  return `${headerB64}.${payloadB64}.${toB64Url(sig)}`;
}

export interface MintTokenOptions {
  identity: string;
  name?: string;
  metadata?: string;
  room: string;
  canPublish: boolean;
  ttlSeconds?: number;
}

export async function createLiveKitToken(opts: MintTokenOptions): Promise<{ token: string; wsUrl: string }> {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const wsUrl = process.env.LIVEKIT_WS_URL;
  if (!apiKey || !apiSecret || !wsUrl) {
    throw new Error("LiveKit credentials not configured");
  }
  const now = Math.floor(Date.now() / 1000);
  const exp = now + (opts.ttlSeconds ?? 60 * 60 * 6);
  const payload: Record<string, unknown> = {
    iss: apiKey,
    sub: opts.identity,
    iat: now,
    nbf: now,
    exp,
    name: opts.name ?? opts.identity,
    ...(opts.metadata ? { metadata: opts.metadata } : {}),
    video: {
      room: opts.room,
      roomJoin: true,
      canPublish: opts.canPublish,
      canSubscribe: true,
      canPublishData: true,
      canPublishSources: opts.canPublish ? ["camera", "microphone", "screen_share", "screen_share_audio"] : [],
    },
  };
  const token = await signJwtHS256(payload, apiSecret);
  return { token, wsUrl };
}
