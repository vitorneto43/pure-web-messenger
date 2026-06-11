import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { recordDeviceInfo } from "@/lib/device-tracking";
import { installNativeOAuthListener } from "@/lib/native-google-auth";
import { recordAppInstallOnce, recordAppFirstOpenOnce, recordAppLogin } from "@/lib/app-events";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  loading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // app_install: dispara uma vez por dispositivo nativo (independe de login)
    recordAppInstallOnce();
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setLoading(false);
      if (event === "SIGNED_IN" && s?.user) {
        recordAppFirstOpenOnce(s.user.id);
        recordAppLogin(s.user.id);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
      if (data.session?.user) recordAppFirstOpenOnce(data.session.user.id);
    });
    let removeNative: (() => void) | null = null;
    installNativeOAuthListener().then((fn) => {
      removeNative = fn;
    });
    return () => {
      sub.subscription.unsubscribe();
      removeNative?.();
    };
  }, []);

  // Heartbeat: update last_seen every 60s while session is active
  useEffect(() => {
    if (!session?.user) return;
    const ping = async () => {
      try {
        await supabase
          .from("profiles")
          .update({ last_seen: new Date().toISOString() })
          .eq("id", session.user.id);
      } catch (e) {
        console.warn("last_seen heartbeat failed", e);
      }
    };
    void ping();
    void recordDeviceInfo(session.user.id);
    const id = setInterval(() => { void ping(); }, 60_000);
    return () => clearInterval(id);
  }, [session?.user?.id]);

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
