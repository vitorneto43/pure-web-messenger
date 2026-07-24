import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { listMyEcosystems, type Ecosystem } from "@/lib/ecosystems";

interface EcosystemContextValue {
  ecosystems: Ecosystem[];
  currentEcosystemId: string | null;
  setCurrentEcosystemId: (id: string | null) => void;
  loading: boolean;
  refresh: () => Promise<void>;
}

const Ctx = createContext<EcosystemContextValue>({
  ecosystems: [],
  currentEcosystemId: null,
  setCurrentEcosystemId: () => {},
  loading: true,
  refresh: async () => {},
});

const STORAGE_KEY = "wavechat:currentEcosystemId";

export function EcosystemProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [ecosystems, setEcosystems] = useState<Ecosystem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentEcosystemId, setCurrentEcosystemIdState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(STORAGE_KEY);
  });

  const refresh = async () => {
    if (!user) {
      setEcosystems([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const list = await listMyEcosystems();
      setEcosystems(list);
    } catch (e) {
      console.warn("listMyEcosystems failed", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, [user?.id]);

  const setCurrentEcosystemId = (id: string | null) => {
    setCurrentEcosystemIdState(id);
    if (typeof window !== "undefined") {
      if (id) window.localStorage.setItem(STORAGE_KEY, id);
      else window.localStorage.removeItem(STORAGE_KEY);
    }
  };

  return (
    <Ctx.Provider value={{ ecosystems, currentEcosystemId, setCurrentEcosystemId, loading, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export function useEcosystems() {
  return useContext(Ctx);
}
