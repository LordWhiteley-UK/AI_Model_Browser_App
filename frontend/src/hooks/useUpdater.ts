import { useEffect, useState } from "react";
import { check } from "@tauri-apps/plugin-updater";

export interface UpdateState {
  available: boolean;
  version?: string;
  date?: string;
  body?: string;
  error?: string;
  checking: boolean;
}

export function useUpdater() {
  const [state, setState] = useState<UpdateState>({ checking: true, available: false });

  useEffect(() => {
    let cancelled = false;

    async function runCheck() {
      try {
        const update = await check();
        if (cancelled) return;
        if (update) {
          setState({
            checking: false,
            available: true,
            version: update.version,
            date: update.date,
            body: update.body,
          });
        } else {
          setState({ checking: false, available: false });
        }
      } catch (err) {
        if (cancelled) return;
        setState({
          checking: false,
          available: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    runCheck();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
