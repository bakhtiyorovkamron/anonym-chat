"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

type SessionValue = {
  ready: boolean;
  hasPersona: boolean;
};

const SessionContext = createContext<SessionValue>({ ready: false, hasPersona: false });

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [hasPersona, setHasPersona] = useState(false);

  useEffect(() => {
    let active = true;

    fetch("/api/auth/anonymous", { method: "POST" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Session request failed: ${res.status}`);
        return res.json().catch(() => ({}));
      })
      .then((json) => {
        if (!active) return;
        setHasPersona(Boolean(json?.hasPersona));
      })
      .catch((error) => {
        console.error("[session]", error);
      })
      .finally(() => {
        if (active) setReady(true);
      });

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(() => ({ ready, hasPersona }), [ready, hasPersona]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}
