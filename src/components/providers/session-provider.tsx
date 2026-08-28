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
      .then((res) => res.json())
      .then((json) => {
        if (!active) return;
        setHasPersona(Boolean(json.hasPersona));
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
