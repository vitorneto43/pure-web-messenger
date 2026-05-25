import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { startRingtone, stopRingtone, startRingback, stopRingback } from "@/lib/ringtone";
import { sendCallPush } from "@/lib/push.functions";
import {
  isNativeApp,
  showNativeIncomingCall,
  endNativeCall,
  stopNativeRinging,
  configureNativeCallAudio,
  resetNativeCallAudio,
  initNativeCallListeners,
  registerNativePush,
} from "@/integrations/native-call";
import { saveNativeToken, sendNativeCallCancelPush, sendNativeCallPush } from "@/lib/native-push.functions";
import { useServerFn } from "@tanstack/react-start";

type Kind = "audio" | "video";
type Status = "ringing" | "accepted" | "declined" | "missed" | "ended" | "cancelled";

export interface CallInfo {
  id: string;
  conversationId: string;
  callerId: string;
  calleeId: string;
  kind: Kind;
  status: Status;
  isCaller: boolean;
  peerProfile?: {
    id: string;
    display_name: string;
    avatar_url: string | null;
  };
}

interface CallContextValue {
  active: CallInfo | null;
  incoming: CallInfo | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  micOn: boolean;
  camOn: boolean;
  connecting: boolean;
  startCall: (params: {
    conversationId: string;
    calleeId: string;
    kind: Kind;
    peerProfile?: CallInfo["peerProfile"];
  }) => Promise<void>;
  acceptIncoming: () => Promise<void>;
  declineIncoming: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleMic: () => void;
  toggleCam: () => void;
}

const CallContext = createContext<CallContextValue | null>(null);

// Enhanced ICE servers — STUN + free public TURN (openrelay.metered.ca).
// TURN is REQUIRED for calls between users on symmetric NATs (most mobile
// carriers in Brazil). Without TURN, the WebRTC PeerConnection silently
// stalls in "checking"/"disconnected" and audio never flows.
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },
  // Free public TURN — Open Relay Project (metered.ca)
  { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
];

// Call timeout constants
const CALL_RING_TIMEOUT = 45_000; // 45 seconds
const CALL_CONNECTION_TIMEOUT = 30_000; // 30 seconds for WebRTC connection

export function CallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [active, setActive] = useState<CallInfo | null>(null);
  const [incoming, setIncoming] = useState<CallInfo | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [connecting, setConnecting] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const signalChanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const activeRef = useRef<CallInfo | null>(null);
  const incomingRef = useRef<CallInfo | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteSetRef = useRef(false);
  const startedAtRef = useRef<number | null>(null);
  const callMsgInsertedRef = useRef<Set<string>>(new Set());
  const nativeCleanupRef = useRef<(() => void) | null>(null);
  const nativeTokenSavedRef = useRef(false);
  const processedNativeActionsRef = useRef<Set<string>>(new Set());
  
  // FIX: Add timeout tracking for connection establishment
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const ringTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const sendNativeCallPushFn = useServerFn(sendNativeCallPush);
  const sendNativeCallCancelPushFn = useServerFn(sendNativeCallCancelPush);

  async function insertCallMessage(
    callId: string,
    conversationId: string,
    senderId: string,
    kind: Kind,
    outcome: "missed" | "cancelled" | "declined" | "completed",
    durationSec: number,
  ) {
    if (callMsgInsertedRef.current.has(callId)) return;
    callMsgInsertedRef.current.add(callId);
    try {
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: senderId,
        content: `[[CALL:${kind}:${outcome}:${Math.max(0, Math.floor(durationSec))}]]`,
      });
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    incomingRef.current = incoming;
  }, [incoming]);

  // Initialize native call listeners and push registration when in native app
  useEffect(() => {
    if (!isNativeApp() || !user) return;

    // Register FCM token
    if (!nativeTokenSavedRef.current) {
      registerNativePush(async (token, platform) => {
        await saveNativeToken({ data: { token, platform } });
        nativeTokenSavedRef.current = true;
      }).catch(console.error);
    }

    // Setup native call listeners
    initNativeCallListeners({
      onAccept: (callId, extra) => {
        window.dispatchEvent(
          new CustomEvent('wavechat-call-action', {
            detail: { action: 'accept', callId, extra },
          }),
        );
      },
      onDecline: (callId) => {
        window.dispatchEvent(
          new CustomEvent('wavechat-call-action', {
            detail: { action: 'decline', callId },
          }),
        );
      },
      onEnd: (callId) => {
        window.dispatchEvent(
          new CustomEvent('wavechat-call-action', {
            detail: { action: 'end', callId },
          }),
        );
      },
      onTimeout: (callId) => {
        window.dispatchEvent(
          new CustomEvent('wavechat-call-action', {
            detail: { action: 'timeout', callId },
          }),
        );
      },
    }).then((cleanupFn) => {
      nativeCleanupRef.current = cleanupFn;
    }).catch(console.error);

    return () => {
      if (nativeCleanupRef.current) {
        nativeCleanupRef.current();
        nativeCleanupRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const cleanup = useCallback(() => {
    // FIX: Clear all timeouts to prevent lingering effects
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }

    stopRingtone();
    stopRingback();
    
    // FIX: Reset native audio properly before cleanup
    if (isNativeApp()) void resetNativeCallAudio();
    
    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.onconnectionstatechange = null;
      try {
        pcRef.current.close();
      } catch {
        /* ignore */
      }
      pcRef.current = null;
    }
    
    if (signalChanRef.current) {
      supabase.removeChannel(signalChanRef.current);
      signalChanRef.current = null;
    }
    
    // FIX: Properly stop all tracks before clearing stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => {
        t.stop();
        t.enabled = false;
      });
      localStreamRef.current = null;
    }
    
    setLocalStream(null);
    setRemoteStream(null);
    setConnecting(false);
    setMicOn(true);
    setCamOn(true);
    pendingCandidatesRef.current = [];
    remoteSetRef.current = false;
  }, []);

  const loadIncomingCall = useCallback(async (callId: string) => {
    const { data: row } = await supabase
      .from("calls")
      .select("id, conversation_id, caller_id, callee_id, kind, status")
      .eq("id", callId)
      .single();
    if (!row || row.callee_id !== user?.id || row.status !== "ringing") return null;

    const { data: prof } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .eq("id", row.caller_id)
      .single();

    const incomingInfo: CallInfo = {
      id: row.id,
      conversationId: row.conversation_id,
      callerId: row.caller_id,
      calleeId: row.callee_id,
      kind: row.kind as Kind,
      status: "ringing",
      isCaller: false,
      peerProfile: prof
        ? { id: prof.id, display_name: prof.display_name, avatar_url: prof.avatar_url }
        : undefined,
    };
    setIncoming(incomingInfo);
    return incomingInfo;
  }, [user?.id]);

  const setupSignaling = useCallback(
    (callId: string, isCaller: boolean, kind: Kind) => {
      const channel = supabase.channel(`call:${callId}`, {
        config: { broadcast: { self: false, ack: false } },
      });

      const drainCandidates = async () => {
        if (!pcRef.current || !remoteSetRef.current) return;
        const queued = pendingCandidatesRef.current.splice(0);
        for (const c of queued) {
          try {
            await pcRef.current.addIceCandidate(c);
          } catch {
            /* ignore */
          }
        }
      };

      channel.on("broadcast", { event: "offer" }, async ({ payload }) => {
        if (!pcRef.current || isCaller) return;
        try {
          await pcRef.current.setRemoteDescription(payload.sdp);
          remoteSetRef.current = true;
          const answer = await pcRef.current.createAnswer();
          await pcRef.current.setLocalDescription(answer);
          await channel.send({
            type: "broadcast",
            event: "answer",
            payload: { sdp: pcRef.current.localDescription },
          });
          await drainCandidates();
        } catch (e: any) {
          toast.error("Falha ao conectar: " + e.message);
        }
      });

      channel.on("broadcast", { event: "answer" }, async ({ payload }) => {
        if (!pcRef.current || !isCaller) return;
        try {
          stopRingback();
          await pcRef.current.setRemoteDescription(payload.sdp);
          remoteSetRef.current = true;
          await drainCandidates();
        } catch {
          /* ignore */
        }
      });

      channel.on("broadcast", { event: "candidate" }, async ({ payload }) => {
        if (!pcRef.current) return;
        if (!remoteSetRef.current) {
          pendingCandidatesRef.current.push(payload.candidate);
          return;
        }
        try {
          await pcRef.current.addIceCandidate(payload.candidate);
        } catch {
          /* ignore */
        }
      });

      // When callee is ready, ask caller to send offer
      channel.on("broadcast", { event: "ready" }, async () => {
        if (!isCaller || !pcRef.current) return;
        try {
          stopRingback();
          const offer = await pcRef.current.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: kind === "video",
          });
          await pcRef.current.setLocalDescription(offer);
          await channel.send({
            type: "broadcast",
            event: "offer",
            payload: { sdp: pcRef.current.localDescription },
          });
        } catch (e: any) {
          toast.error("Falha ao iniciar: " + e.message);
        }
      });

      channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED" && !isCaller) {
          // callee tells caller it's ready
          await channel.send({ type: "broadcast", event: "ready", payload: {} });
        }
      });

      signalChanRef.current = channel;
    },
    []
  );

  const createPeerConnection = useCallback(
    async (kind: Kind, isCaller: boolean) => {
      const pc = new RTCPeerConnection({
        iceServers: ICE_SERVERS,
        iceCandidatePoolSize: 4,
        bundlePolicy: "max-bundle",
        rtcpMuxPolicy: "require",
      });
      pcRef.current = pc;

      if (isNativeApp()) await configureNativeCallAudio();

      // FIX: Improved audio constraints for better quality and echo cancellation
      // - echoCancellation: true - removes echo
      // - noiseSuppression: true - removes background noise
      // - autoGainControl: true - normalizes volume
      // - channelCount: 1 - mono audio (better for calls)
      // - sampleRate: 48000 - high quality
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: { ideal: 48000 },
          sampleSize: { ideal: 16 },
        },
        video: kind === "video" ? { 
          width: { ideal: 1280 }, 
          height: { ideal: 720 },
          facingMode: "user" // FIX: Explicitly set front camera
        } : false,
      });
      
      localStreamRef.current = stream;
      setLocalStream(stream);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      const remote = new MediaStream();
      setRemoteStream(remote);

      pc.ontrack = (e) => {
        e.streams[0].getTracks().forEach((t) => {
          if (!remote.getTracks().find((x) => x.id === t.id)) remote.addTrack(t);
        });
        setRemoteStream(new MediaStream(remote.getTracks()));
      };

      pc.onicecandidate = (e) => {
        if (e.candidate && signalChanRef.current) {
          signalChanRef.current.send({
            type: "broadcast",
            event: "candidate",
            payload: { candidate: e.candidate.toJSON() },
          });
        }
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === "connected") {
          // FIX: Clear connection timeout when connected
          if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
            connectionTimeoutRef.current = null;
          }
          
          stopRingback();
          stopRingtone();
          setConnecting(false);
          
          // Re-apply MODE_IN_COMMUNICATION + earpiece routing now that the
          // WebView audio output is live. Without this, the OS often resets
          // to MODE_NORMAL when playback begins, disabling hardware AEC →
          // the remote mic captures the speaker and the caller hears themselves.
          if (isNativeApp()) {
            void configureNativeCallAudio();
            setTimeout(() => { void configureNativeCallAudio(); }, 600);
          }
        }
        if (state === "failed" || state === "disconnected") {
          toast.error("Chamada desconectada");
          void endCallInternal("ended");
        }
      };

      // FIX: Add connection timeout to prevent hanging connections
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
      connectionTimeoutRef.current = setTimeout(() => {
        if (pc.connectionState === "connecting" || pc.connectionState === "new") {
          toast.error("Timeout na conexão");
          void endCallInternal("ended");
        }
      }, CALL_CONNECTION_TIMEOUT);

      return pc;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const endCallInternal = useCallback(
    async (status: Status) => {
      const current = activeRef.current;
      const startedAt = startedAtRef.current;
      startedAtRef.current = null;
      cleanup();
      if (current && isNativeApp()) void endNativeCall(current.id);
      setActive(null);
      if (current) {
        await supabase
          .from("calls")
          .update({ status, ended_at: new Date().toISOString() })
          .eq("id", current.id)
          .in("status", ["ringing", "accepted"]);

        if (current.isCaller && current.status === "ringing") {
          void sendNativeCallCancelPushFn({
            data: { callId: current.id, calleeId: current.calleeId },
          }).catch((e) => console.error("sendNativeCallCancelPush failed", e));
        }

        if (current.isCaller) {
          const duration = startedAt ? (Date.now() - startedAt) / 1000 : 0;
          const outcome: "missed" | "cancelled" | "completed" =
            status === "missed"
              ? "missed"
              : startedAt
                ? "completed"
                : "cancelled";
          void insertCallMessage(
            current.id,
            current.conversationId,
            current.callerId,
            current.kind,
            outcome,
            duration,
          );
        }
      }
    },
    [cleanup, sendNativeCallCancelPushFn]
  );

  const startCall = useCallback<CallContextValue["startCall"]>(
    async ({ conversationId, calleeId, kind, peerProfile }) => {
      if (!user) return;
      if (activeRef.current) {
        toast.error("Você já está em uma chamada");
        return;
      }
      setConnecting(true);
      try {
        const { data, error } = await supabase
          .from("calls")
          .insert({
            conversation_id: conversationId,
            caller_id: user.id,
            callee_id: calleeId,
            kind,
            status: "ringing",
          })
          .select()
          .single();

        if (error || !data) throw error || new Error("Failed to create call");

        const callInfo: CallInfo = {
          id: data.id,
          conversationId,
          callerId: user.id,
          calleeId,
          kind,
          status: "ringing",
          isCaller: true,
          peerProfile,
        };
        setActive(callInfo);
        activeRef.current = callInfo;

        await createPeerConnection(kind, true);
        setupSignaling(data.id, true, kind);

        startRingback();

        const callerName = user.user_metadata?.display_name || "Alguém";
        void sendCallPush({
          data: {
            callId: data.id,
            calleeId,
            conversationId,
            kind,
            callerName,
          },
        }).catch((e) => console.error("sendCallPush failed", e));

        // Also send native FCM push for the Capacitor app (if callee has native token)
        void sendNativeCallPushFn({
          data: {
            callId: data.id,
            calleeId,
            conversationId,
            kind,
            callerName,
          },
        }).catch((e) => console.error("sendNativeCallPush failed", e));

        // FIX: Track ring timeout to auto-cancel if not answered
        if (ringTimeoutRef.current) {
          clearTimeout(ringTimeoutRef.current);
        }
        ringTimeoutRef.current = setTimeout(() => {
          const cur = activeRef.current;
          if (cur && cur.id === data.id && cur.status === "ringing") {
            toast.info("Sem resposta");
            void endCallInternal("missed");
          }
        }, CALL_RING_TIMEOUT);
      } catch (e: any) {
        toast.error("Não foi possível iniciar a chamada: " + e.message);
        cleanup();
        setActive(null);
      }
    },
    [user, createPeerConnection, setupSignaling, endCallInternal, cleanup, sendNativeCallPushFn]
  );

  const acceptIncomingCall = useCallback(async (call: CallInfo) => {
    if (activeRef.current?.id === call.id) return;
    stopRingtone();
    stopRingback();
    if (isNativeApp()) await stopNativeRinging(call.id);
    setConnecting(true);
    try {
      await supabase
        .from("calls")
        .update({ status: "accepted", started_at: new Date().toISOString() })
        .eq("id", call.id);

      const info: CallInfo = { ...call, status: "accepted" };
      setActive(info);
      activeRef.current = info;
      setIncoming(null);

      await createPeerConnection(call.kind, false);
      setupSignaling(call.id, false, call.kind);
    } catch (e: any) {
      toast.error("Falha ao atender: " + e.message);
      cleanup();
      setActive(null);
      setIncoming(null);
    }
  }, [incoming, createPeerConnection, setupSignaling, cleanup]);

  const acceptIncoming = useCallback(async () => {
    if (!incomingRef.current) return;
    await acceptIncomingCall(incomingRef.current);
  }, [acceptIncomingCall]);

  const declineIncomingCall = useCallback(async (call: CallInfo) => {
    stopRingtone();
    stopRingback();
    if (isNativeApp()) await endNativeCall(call.id);
    await supabase
      .from("calls")
      .update({ status: "declined", ended_at: new Date().toISOString() })
      .eq("id", call.id);
    setIncoming(null);
  }, []);

  const declineIncoming = useCallback(async () => {
    if (!incomingRef.current) return;
    await declineIncomingCall(incomingRef.current);
  }, [declineIncomingCall]);

  const endCall = useCallback(async () => {
    const current = activeRef.current;
    await endCallInternal(current?.isCaller && current.status === "ringing" ? "cancelled" : "ended");
  }, [endCallInternal]);

  const toggleMic = useCallback(() => {
    const s = localStreamRef.current;
    if (!s) return;
    s.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
    setMicOn(s.getAudioTracks()[0]?.enabled ?? true);
  }, []);

  const toggleCam = useCallback(() => {
    const s = localStreamRef.current;
    if (!s) return;
    s.getVideoTracks().forEach((t) => (t.enabled = !t.enabled));
    setCamOn(s.getVideoTracks()[0]?.enabled ?? true);
  }, []);

  // Global listener for incoming calls and remote cancellation
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`calls-inbox-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "calls",
          filter: `callee_id=eq.${user.id}`,
        },
        async (payload) => {
          const row = payload.new as any;
          if (row.status !== "ringing") return;
          if (activeRef.current) {
            // auto-decline if already busy
            await supabase
              .from("calls")
              .update({ status: "declined", ended_at: new Date().toISOString() })
              .eq("id", row.id);
            return;
          }
          const { data: prof } = await supabase
            .from("profiles")
            .select("id, display_name, avatar_url")
            .eq("id", row.caller_id)
            .single();
          const incomingInfo: CallInfo = {
            id: row.id,
            conversationId: row.conversation_id,
            callerId: row.caller_id,
            calleeId: row.callee_id,
            kind: row.kind,
            status: "ringing",
            isCaller: false,
            peerProfile: prof
              ? {
                  id: prof.id,
                  display_name: prof.display_name,
                  avatar_url: prof.avatar_url,
                }
              : undefined,
          };
          setIncoming(incomingInfo);

          // Show native incoming call UI when in Capacitor app
          if (isNativeApp()) {
            void showNativeIncomingCall({
              callId: row.id,
              callerName: prof?.display_name || "Alguém",
              hasVideo: row.kind === "video",
              extra: {
                conversationId: row.conversation_id,
                kind: row.kind,
                callerId: row.caller_id,
              },
            });
          }

          if (!isNativeApp()) startRingtone();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "calls",
        },
        (payload) => {
          const row = payload.new as any;
          // Caller side: callee accepted -> mark active accepted
          if (
            activeRef.current &&
            activeRef.current.id === row.id &&
            activeRef.current.isCaller &&
            row.status === "accepted"
          ) {
            stopRingback();
            startedAtRef.current = Date.now();
            setActive({ ...activeRef.current, status: "accepted" });
          }
          // Caller side: callee declined / ended
          if (
            activeRef.current &&
            activeRef.current.id === row.id &&
            ["declined", "ended", "cancelled", "missed"].includes(row.status)
          ) {
            if (row.status === "declined") toast.info("Chamada recusada");
            const current = activeRef.current;
            const startedAt = startedAtRef.current;
            startedAtRef.current = null;
            if (current.isCaller) {
              const duration = startedAt ? (Date.now() - startedAt) / 1000 : 0;
              const outcome =
                row.status === "declined"
                  ? "declined"
                  : row.status === "missed"
                    ? "missed"
                    : startedAt
                      ? "completed"
                      : "cancelled";
              void insertCallMessage(
                current.id,
                current.conversationId,
                current.callerId,
                current.kind,
                outcome as "missed" | "cancelled" | "declined" | "completed",
                duration,
              );
            }
            cleanup();
            setActive(null);
          }
          // Callee side incoming was cancelled by caller
          setIncoming((curr) => {
            if (curr && curr.id === row.id && row.status !== "ringing") {
              stopRingtone();
              if (isNativeApp()) void endNativeCall(row.id);
              return null;
            }
            return curr;
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Listen for native call actions (from Capacitor plugin or push)
  useEffect(() => {
    if (!isNativeApp()) return;
    const runAction = async (detail: { action?: string; callId?: string }) => {
      if (!detail.callId) return;
      const actionKey = `${detail.action ?? 'open'}:${detail.callId}`;
      if (processedNativeActionsRef.current.has(actionKey)) return;
      processedNativeActionsRef.current.add(actionKey);
      if (isNativeApp()) {
        if (detail.action === 'accept') void stopNativeRinging(detail.callId);
        else void endNativeCall(detail.callId);
      }
      const call = incomingRef.current?.id === detail.callId
        ? incomingRef.current
        : await loadIncomingCall(detail.callId);
      if (detail.action === 'accept') {
        if (call) await acceptIncomingCall(call);
      } else if (detail.action === 'decline') {
        if (call) await declineIncomingCall(call);
      } else if (detail.action === 'end') {
        await endCall();
      } else if (detail.action === 'timeout') {
        if (call) await declineIncomingCall(call);
      } else if (detail.action === 'open') {
        if (call && !isNativeApp()) startRingtone();
      }
    };

    const actionHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        action: string;
        callId: string;
        extra?: Record<string, string>;
      };
      void runAction(detail);
    };

    const intentHandler = (e: Event) => {
      const event = e as CustomEvent & { action?: string; callId?: string };
      void runAction(event.detail ?? { action: event.action, callId: event.callId });
    };

    const pushHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { callId?: string };
      void runAction({ action: 'open', callId: detail?.callId });
    };

    window.addEventListener('wavechat-call-action', actionHandler);
    window.addEventListener('wavechat-android-intent', intentHandler);
    window.addEventListener('wavechat-native-call', pushHandler);

    try {
      const pending = localStorage.getItem('wavechat_pending_call_intent');
      if (pending) {
        localStorage.removeItem('wavechat_pending_call_intent');
        void runAction(JSON.parse(pending));
      }
    } catch {
      /* ignore */
    }

    return () => {
      window.removeEventListener('wavechat-call-action', actionHandler);
      window.removeEventListener('wavechat-android-intent', intentHandler);
      window.removeEventListener('wavechat-native-call', pushHandler);
    };
  }, [acceptIncomingCall, declineIncomingCall, endCall, loadIncomingCall]);

  return (
    <CallContext.Provider
      value={{
        active,
        incoming,
        localStream,
        remoteStream,
        micOn,
        camOn,
        connecting,
        startCall,
        acceptIncoming,
        declineIncoming,
        endCall,
        toggleMic,
        toggleCam,
      }}
    >
      {children}
    </CallContext.Provider>
  );
}

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCall must be used within CallProvider");
  return ctx;
}
