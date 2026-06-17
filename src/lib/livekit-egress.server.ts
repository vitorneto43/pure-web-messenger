// Server-only helpers to start/stop LiveKit RoomCompositeEgress via REST API.
// Uses HS256 JWT (same signing as livekit-token.server) — no Node-only deps.

import { createLiveKitToken } from "./livekit-token.server";

function envBase(): string {
  const ws = process.env.LIVEKIT_WS_URL;
  if (!ws) throw new Error("LIVEKIT_WS_URL not configured");
  // ws(s)://host -> https://host
  return ws.replace(/^ws/, "http").replace(/\/+$/, "");
}

async function adminToken(): Promise<string> {
  // For LiveKit Egress REST, we need a JWT signed with API key/secret and roomRecord grant.
  // We reuse createLiveKitToken for HMAC plumbing but with empty room (recordOnly).
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!apiKey || !apiSecret) throw new Error("LiveKit credentials not configured");
  const enc = new TextEncoder();
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: apiKey,
    sub: "egress-admin",
    iat: now,
    nbf: now,
    exp: now + 600,
    video: { roomRecord: true, roomAdmin: true, room: "" },
  };
  const header = { alg: "HS256", typ: "JWT" };
  const b64 = (u: Uint8Array) => {
    let s = "";
    for (const b of u) s += String.fromCharCode(b);
    return btoa(s).replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  };
  const h = b64(enc.encode(JSON.stringify(header)));
  const p = b64(enc.encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(apiSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`${h}.${p}`));
  return `${h}.${p}.${b64(new Uint8Array(sig))}`;
}

// Touch createLiveKitToken so the bundler keeps the import path warm if we ever
// need a one-off identity token alongside egress.
export const _keep = createLiveKitToken;

export interface RecordingConfig {
  enabled: boolean;
  reason?: string;
}

export function recordingConfig(): RecordingConfig {
  const has =
    !!process.env.LIVEKIT_API_KEY &&
    !!process.env.LIVEKIT_API_SECRET &&
    !!process.env.LIVEKIT_WS_URL &&
    !!process.env.LIVEKIT_EGRESS_S3_BUCKET &&
    !!process.env.LIVEKIT_EGRESS_S3_ACCESS_KEY &&
    !!process.env.LIVEKIT_EGRESS_S3_SECRET &&
    !!process.env.LIVEKIT_EGRESS_S3_ENDPOINT;
  return {
    enabled: has,
    reason: has ? undefined : "Configure LIVEKIT_EGRESS_S3_* para habilitar gravação.",
  };
}

export interface StartEgressResult {
  egressId: string;
  storagePath: string;
  fileUrl: string;
}

export async function startRoomCompositeEgress(opts: {
  room: string;
  hostId: string;
  liveId: string;
}): Promise<StartEgressResult> {
  const cfg = recordingConfig();
  if (!cfg.enabled) throw new Error(cfg.reason ?? "Gravação indisponível");
  const token = await adminToken();
  const storagePath = `${opts.hostId}/${opts.liveId}-${Date.now()}.mp4`;
  const body = {
    room_name: opts.room,
    layout: "speaker",
    audio_only: false,
    file: {
      filepath: storagePath,
      s3: {
        access_key: process.env.LIVEKIT_EGRESS_S3_ACCESS_KEY,
        secret: process.env.LIVEKIT_EGRESS_S3_SECRET,
        region: process.env.LIVEKIT_EGRESS_S3_REGION ?? "us-east-1",
        bucket: process.env.LIVEKIT_EGRESS_S3_BUCKET,
        endpoint: process.env.LIVEKIT_EGRESS_S3_ENDPOINT,
        force_path_style: true,
      },
    },
  };
  const r = await fetch(`${envBase()}/twirp/livekit.Egress/StartRoomCompositeEgress`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`LiveKit egress falhou: ${r.status} ${t.slice(0, 200)}`);
  }
  const j = (await r.json()) as { egress_id?: string };
  if (!j.egress_id) throw new Error("LiveKit não retornou egress_id");
  const publicBase = process.env.LIVEKIT_EGRESS_S3_PUBLIC_BASE ?? "";
  const fileUrl = publicBase ? `${publicBase.replace(/\/+$/, "")}/${storagePath}` : "";
  return { egressId: j.egress_id, storagePath, fileUrl };
}

export async function stopEgress(egressId: string): Promise<void> {
  const token = await adminToken();
  const r = await fetch(`${envBase()}/twirp/livekit.Egress/StopEgress`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ egress_id: egressId }),
  });
  if (!r.ok && r.status !== 404) {
    const t = await r.text();
    throw new Error(`Stop egress falhou: ${r.status} ${t.slice(0, 200)}`);
  }
}
