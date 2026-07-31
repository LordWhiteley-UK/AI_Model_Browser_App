import { useEffect, useRef, useState } from "react";
import type { BackendLog } from "../types";

async function loadTauriListen() {
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    try {
      const mod = await import("@tauri-apps/api/event");
      return mod.listen;
    } catch {
      return null;
    }
  }
  return null;
}

export function useBackendLogs(limit = 500) {
  const [logs, setLogs] = useState<BackendLog[]>([]);
  const bufferRef = useRef<BackendLog[]>([]);
  const flushTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const flush = () => {
      if (bufferRef.current.length === 0) return;
      setLogs((prev) => {
        const merged = [...prev, ...bufferRef.current];
        bufferRef.current = [];
        return merged.slice(-limit);
      });
    };

    const scheduleFlush = () => {
      if (flushTimerRef.current !== null) return;
      flushTimerRef.current = window.setTimeout(() => {
        flushTimerRef.current = null;
        flush();
      }, 100);
    };

    loadTauriListen().then((listen) => {
      if (!listen) return;
      listen<string | { stream?: string; text?: string }>(
        "backend-log",
        (event) => {
          const payload =
            typeof event.payload === "string"
              ? ({ stream: "stdout", text: event.payload } as const)
              : event.payload;
          const stream = payload.stream === "stderr" ? "stderr" : "stdout";
          bufferRef.current.push({
            stream,
            text: String(payload.text ?? ""),
            receivedAt: Date.now(),
          });
          scheduleFlush();
        },
      ).then((cleanup) => {
        unlisten = cleanup;
      });
    });

    return () => {
      unlisten?.();
      if (flushTimerRef.current !== null) {
        window.clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      flush();
    };
  }, [limit]);

  const clear = () => setLogs([]);

  return { logs, clear };
}
