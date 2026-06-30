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
import { createCallToken } from "@/lib/calls.functions";

type Kind = "audio" | "video";
type Status = "ringing" | "accepted" | "declined" | "missed" | "ended" | "cancelled";

/**
 * Triggers the browser/OS media permission prompt inside a user gesture
 * (Accept / Call button click). LiveKit's auto-publish path can swallow
 * NotAllowedError silently in some Android WebViews — by asking first we
 * surface a clear toast and we also "warm up" the audio device so the
 * subsequent publish succeeds. The tracks are stopped immediately because
 * LiveKit will request its own.
 */
async function ensureMediaPermission(kind: Kind): Promise<boolean> {
  try {
    if (!navigator?.mediaDevices?.getUserMedia) {
      toast.error("Este navegador não suporta áudio/vídeo");
      return false;
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: kind === "video",
    });
    stream.getTracks().forEach((t) => t.stop());
    return true;
  } catch (e: any) {
    const name = e?.name || "Error";
    console.error("[call] getUserMedia failed", name, e);
    if (name === "NotAllowedError" || name === "SecurityError") {
      toast.error("Permissão de microfone negada. Libere nas configurações.");
    } else if (name === "NotFoundError" || name === "OverconstrainedError") {
      toast.error("Microfone não encontrado neste dispositivo.");
    } else if (name === "NotReadableError") {
      toast.error("Microfone em uso por outro app.");
    } else {
      toast.error("Falha ao acessar o microfone: " + (e?.message ?? name));
    }
    return false;
  }
}


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

export interface LiveKitCallSession {
  token: string;
  serverUrl: string;
  callId: string;
}

interface CallContextValue {
  active: CallInfo | null;
  incoming: CallInfo | null;
  /** LiveKit session details when call has been accepted. */
  livekit: LiveKitCallSession | null;
  micOn: boolean;
  camOn: boolean;
  connecting: boolean;
  /** Reported by CallScreen via setMediaState — used so the hook tracks toggles centrally. */
  setMediaState: (state: { micOn?: boolean; camOn?: boolean }) => void;
  startCall: (params: {
    conversationId: string;
    calleeId: string;
    kind: Kind;
    peerProfile?: CallInfo["peerProfile"];
  }) => Promise<void>;
  acceptIncoming: () => Promise<void>;
  declineIncoming: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleMicRequest: () => void;
  toggleCamRequest: () => void;
  /** Counter that increments when user clicks the toggle; CallScreen subscribes. */
  micToggleSignal: number;
  camToggleSignal: number;
}

const CallContext = createContext<CallContextValue | null>(null);

// Call timeout: how long the callee's phone rings without answer
const CALL_RING_TIMEOUT = 45_000;

export function CallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [active, setActive] = useState<CallInfo | null>(null);
  const [incoming, setIncoming] = useState<CallInfo | null>(null);
  const [livekit, setLivekit] = useState<LiveKitCallSession | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [micToggleSignal, setMicToggleSignal] = useState(0);
  const [camToggleSignal, setCamToggleSignal] = useState(0);

  const activeRef = useRef<CallInfo | null>(null);
  const incomingRef = useRef<CallInfo | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const callMsgInsertedRef = useRef<Set<string>>(new Set());
  const nativeCleanupRef = useRef<(() => void) | null>(null);
  const nativeTokenSavedRef = useRef(false);
  const processedNativeActionsRef = useRef<Set<string>>(new Set());
  const ringTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchCallToken = useServerFn(createCallToken);
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

  // Native call listeners + push registration
  useEffect(() => {
    if (!isNativeApp() || !user) return;

    if (!nativeTokenSavedRef.current) {
      registerNativePush(async (token, platform) => {
        await saveNativeToken({ data: { token, platform } });
        nativeTokenSavedRef.current = true;
      }).catch(console.error);
    }

    initNativeCallListeners({
      onAccept: (callId, extra) => {
        window.dispatchEvent(new CustomEvent('wavechat-call-action', { detail: { action: 'accept', callId, extra } }));
      },
      onDecline: (callId) => {
        window.dispatchEvent(new CustomEvent('wavechat-call-action', { detail: { action: 'decline', callId } }));
      },
      onEnd: (callId) => {
        window.dispatchEvent(new CustomEvent('wavechat-call-action', { detail: { action: 'end', callId } }));
      },
      onTimeout: (callId) => {
        window.dispatchEvent(new CustomEvent('wavechat-call-action', { detail: { action: 'timeout', callId } }));
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
    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }
    stopRingtone();
    stopRingback();
    if (isNativeApp()) void resetNativeCallAudio();
    setLivekit(null);
    setConnecting(false);
    setMicOn(true);
    setCamOn(true);
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

  /** Fetch LiveKit token for the call and hand it to CallScreen. */
  const connectLiveKit = useCallback(async (callId: string, kind: Kind) => {
    try {
      const res = await fetchCallToken({ data: { callId } });
      if (isNativeApp()) await configureNativeCallAudio();
      setLivekit({ token: res.token, serverUrl: res.wsUrl, callId });
      setCamOn(kind === "video");
      setMicOn(true);
      setConnecting(false);
    } catch (e: any) {
      toast.error("Falha ao conectar áudio/vídeo: " + (e?.message ?? "erro"));
      // bail: end the call
      void endCallInternalRef.current?.("ended");
    }
  }, [fetchCallToken]);

  const endCallInternalRef = useRef<((status: Status) => Promise<void>) | null>(null);

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
    [cleanup, sendNativeCallCancelPushFn],
  );

  useEffect(() => {
    endCallInternalRef.current = endCallInternal;
  }, [endCallInternal]);

  const startCall = useCallback<CallContextValue["startCall"]>(
    async ({ conversationId, calleeId, kind, peerProfile }) => {
      if (!user) return;
      if (activeRef.current) {
        toast.error("Você já está em uma chamada");
        return;
      }
      // Trigger permission prompt synchronously with the call button click.
      const ok = await ensureMediaPermission(kind);
      if (!ok) return;
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

        startRingback();

        const callerName = user.user_metadata?.display_name || "Alguém";
        void sendCallPush({
          data: { callId: data.id, calleeId, conversationId, kind, callerName },
        }).catch((e) => console.error("sendCallPush failed", e));
        void sendNativeCallPushFn({
          data: { callId: data.id, calleeId, conversationId, kind, callerName },
        }).catch((e) => console.error("sendNativeCallPush failed", e));

        if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
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
    [user, cleanup, endCallInternal, sendNativeCallPushFn],
  );

  const acceptIncomingCall = useCallback(async (call: CallInfo) => {
    if (activeRef.current?.id === call.id) return;
    stopRingtone();
    stopRingback();
    if (isNativeApp()) await stopNativeRinging(call.id);
    setConnecting(true);
    // Ask for mic/cam permission INSIDE the accept gesture. If we wait until
    // LiveKit auto-publishes the prompt may be dismissed silently on some
    // Android WebViews and the user ends up in a call with no audio.
    const ok = await ensureMediaPermission(call.kind);
    if (!ok) {
      setConnecting(false);
      await supabase
        .from("calls")
        .update({ status: "declined", ended_at: new Date().toISOString() })
        .eq("id", call.id);
      setIncoming(null);
      return;
    }
    try {
      await supabase
        .from("calls")
        .update({
          status: "accepted",
          started_at: new Date().toISOString(),
          seen_at: new Date().toISOString(),
        })
        .eq("id", call.id);

      const info: CallInfo = { ...call, status: "accepted" };
      setActive(info);
      activeRef.current = info;
      setIncoming(null);
      startedAtRef.current = Date.now();

      await connectLiveKit(call.id, call.kind);

    } catch (e: any) {
      toast.error("Falha ao atender: " + e.message);
      cleanup();
      setActive(null);
      setIncoming(null);
    }
  }, [connectLiveKit, cleanup]);

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
      .update({
        status: "declined",
        ended_at: new Date().toISOString(),
        seen_at: new Date().toISOString(),
      })
      .eq("id", call.id);
    setIncoming(null);
  }, []);

  const declineIncoming = useCallback(async () => {
    if (!incomingRef.current) return;
    await declineIncomingCall(incomingRef.current);
  }, [declineIncomingCall]);

  const endCall = useCallback(async () => {
    const current = activeRef.current;
    await endCallInternal(
      current?.isCaller && current.status === "ringing" ? "cancelled" : "ended",
    );
  }, [endCallInternal]);

  const setMediaState = useCallback((state: { micOn?: boolean; camOn?: boolean }) => {
    if (typeof state.micOn === "boolean") setMicOn(state.micOn);
    if (typeof state.camOn === "boolean") setCamOn(state.camOn);
  }, []);

  const toggleMicRequest = useCallback(() => setMicToggleSignal((n) => n + 1), []);
  const toggleCamRequest = useCallback(() => setCamToggleSignal((n) => n + 1), []);

  // Global listener for incoming calls and remote status updates
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
              ? { id: prof.id, display_name: prof.display_name, avatar_url: prof.avatar_url }
              : undefined,
          };
          setIncoming(incomingInfo);

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
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "calls" },
        (payload) => {
          const row = payload.new as any;
          // Caller side: callee accepted -> connect LiveKit
          if (
            activeRef.current &&
            activeRef.current.id === row.id &&
            activeRef.current.isCaller &&
            row.status === "accepted" &&
            !livekit
          ) {
            stopRingback();
            startedAtRef.current = Date.now();
            const info = { ...activeRef.current, status: "accepted" as const };
            setActive(info);
            activeRef.current = info;
            void connectLiveKit(row.id, info.kind);
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
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Native call action handlers (FCM / IncomingCallKit)
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
      const detail = (e as CustomEvent).detail as { action: string; callId: string; extra?: Record<string, string> };
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
        livekit,
        micOn,
        camOn,
        connecting,
        setMediaState,
        startCall,
        acceptIncoming,
        declineIncoming,
        endCall,
        toggleMicRequest,
        toggleCamRequest,
        micToggleSignal,
        camToggleSignal,
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
