import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { api, SandboxExpiredError, type FrankenguardApi } from "./api.js";
import type { StateResponse } from "../../shared/types.js";

// The state store: one screen, one store. It owns the sandbox
// lifecycle (create on first load, offer a fresh one on 401), the
// current server state, and every mutation, refetching state after
// each one so the page never shows a verdict the server did not
// produce. No client-side caching beyond the last fetched state;
// the server is always re-asked after a write.

export type StoreStatus = "loading" | "ready" | "expired" | "error";

export interface Store {
  status: StoreStatus;
  state: StateResponse | null;
  error: string | null;
  refresh: () => Promise<void>;
  startFreshSandbox: () => Promise<void>;
  reset: () => Promise<void>;
  runAgent: FrankenguardApi["runAgent"];
  submitProposal: FrankenguardApi["submitProposal"];
  getProposal: FrankenguardApi["getProposal"];
  updateCaps: FrankenguardApi["updateCaps"];
  addRecipient: FrankenguardApi["addRecipient"];
  removeRecipient: FrankenguardApi["removeRecipient"];
  setFrozen: FrankenguardApi["setFrozen"];
  listAudit: FrankenguardApi["listAudit"];
  verifyAudit: FrankenguardApi["verifyAudit"];
}

const StoreContext = createContext<Store | null>(null);

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore must be used inside <StoreProvider>");
  return store;
}

export function StoreProvider({ client, children }: { client?: FrankenguardApi; children: ReactNode }) {
  const apiClient = useMemo(() => client ?? api, [client]);
  const [status, setStatus] = useState<StoreStatus>("loading");
  const [state, setState] = useState<StateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const fresh = await apiClient.getState();
      if (!mounted.current) return;
      setState(fresh);
      setStatus("ready");
      setError(null);
    } catch (err) {
      if (!mounted.current) return;
      if (err instanceof SandboxExpiredError) {
        setStatus("expired");
        setError(null);
      } else {
        setStatus("error");
        setError(err instanceof Error ? err.message : "could not load state");
      }
    }
  }, [apiClient]);

  const startFreshSandbox = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      await apiClient.createSandbox();
      await refresh();
    } catch (err) {
      if (!mounted.current) return;
      setStatus("error");
      setError(err instanceof Error ? err.message : "could not create a sandbox");
    }
  }, [apiClient, refresh]);

  // First load: ask for state. A fresh visitor has no cookie, so the
  // server answers 401 and the store creates a sandbox itself rather
  // than showing an error for a first visit.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const fresh = await apiClient.getState();
        if (cancelled) return;
        setState(fresh);
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        if (err instanceof SandboxExpiredError) {
          try {
            await apiClient.createSandbox();
            const fresh = await apiClient.getState();
            if (cancelled) return;
            setState(fresh);
            setStatus("ready");
          } catch (inner) {
            if (cancelled) return;
            setStatus("error");
            setError(inner instanceof Error ? inner.message : "could not create a sandbox");
          }
        } else {
          setStatus("error");
          setError(err instanceof Error ? err.message : "could not load state");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiClient]);

  const afterMutation = useCallback(
    async <T,>(call: () => Promise<T>): Promise<T> => {
      const result = await call();
      await refresh();
      return result;
    },
    [refresh],
  );

  // Read-only passthroughs stay stable across state changes, so
  // panels that load in an effect (the audit timeline) do not
  // refetch every time the store object is recreated. Only the
  // audit head count and the filters should retrigger a load.
  const getProposal = useCallback((id: string) => apiClient.getProposal(id), [apiClient]);
  const listAudit = useCallback(
    (query: Parameters<FrankenguardApi["listAudit"]>[0]) => apiClient.listAudit(query),
    [apiClient],
  );
  const verifyAudit = useCallback(() => apiClient.verifyAudit(), [apiClient]);

  const store = useMemo<Store>(
    () => ({
      status,
      state,
      error,
      refresh,
      startFreshSandbox,
      reset: async () => {
        await apiClient.resetSandbox();
        await refresh();
      },
      runAgent: (body) => afterMutation(() => apiClient.runAgent(body)),
      submitProposal: (body) => afterMutation(() => apiClient.submitProposal(body)),
      getProposal,
      updateCaps: (body) => afterMutation(() => apiClient.updateCaps(body)),
      addRecipient: (body) => afterMutation(() => apiClient.addRecipient(body)),
      removeRecipient: (body) => afterMutation(() => apiClient.removeRecipient(body)),
      setFrozen: (body) => afterMutation(() => apiClient.setFrozen(body)),
      listAudit,
      verifyAudit,
    }),
    [status, state, error, refresh, startFreshSandbox, apiClient, afterMutation, getProposal, listAudit, verifyAudit],
  );

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}
