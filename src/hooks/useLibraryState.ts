import { useCallback, useEffect, useRef, useState } from "react";
import { getState, getSystemInfo, getTemplates, listRunning, getRecoveryNotice } from "../services/tauri";
import type { AppState, SystemInfo, BottleTemplate, RunningInfo } from "../services/tauri";
import { errorMessage } from "../services/errors";

export function useLibraryState() {
  const [state, setState] = useState<AppState | null>(null);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [templates, setTemplates] = useState<BottleTemplate[]>([]);
  const [runningInfo, setRunningInfo] = useState<RunningInfo[]>([]);
  const [recoveryNotice, setRecoveryNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const generation = useRef(0);
  const pending = useRef(0);
  const initialized = useRef(false);

  const refresh = useCallback(async (full: boolean) => {
    const request = ++generation.current;
    pending.current += 1;
    setIsSyncing(true);
    try {
      const [nextState, running, metadata] = await Promise.all([
        getState(),
        listRunning(),
        full || !initialized.current
          ? Promise.all([getSystemInfo(), getTemplates(), getRecoveryNotice()])
          : Promise.resolve(null),
      ]);
      if (request !== generation.current) return;
      setState(nextState);
      setRunningInfo(running);
      if (metadata) {
        setSystemInfo(metadata[0]);
        setTemplates(metadata[1]);
        if (!initialized.current) setRecoveryNotice(metadata[2]);
        initialized.current = true;
      }
      setError(null);
    } catch (cause) {
      if (request === generation.current) setError(errorMessage(cause, "Could not load your library."));
      throw cause;
    } finally {
      pending.current -= 1;
      if (request === generation.current) setIsSyncing(false);
    }
  }, []);

  const refreshState = useCallback(() => refresh(true), [refresh]);
  const pollDynamicState = useCallback(() => refresh(false), [refresh]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Start external IPC and expose its pending state.
    void refreshState().catch(() => {}); // error is rendered; retain the last good data
    const timer = setInterval(() => {
      if (pending.current === 0) void pollDynamicState().catch(() => {});
    }, 3500);
    return () => {
      clearInterval(timer);
      generation.current += 1;
    };
  }, [refreshState, pollDynamicState]);

  return { state, systemInfo, templates, runningInfo, recoveryNotice, setRecoveryNotice,
    error, isSyncing, refreshState, pollDynamicState };
}
