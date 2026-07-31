import { useEffect, useMemo, useRef, useState } from "react";
import { getHealth } from "./api/client";
import { useBackendLogs } from "./hooks/useBackendLogs";
import type { BackendLog, HealthStatus } from "./types";
import {
  Activity,
  Archive,
  Cpu,
  Download,
  Globe,
  HardDrive,
  Loader2,
  MessageSquare,
  ScrollText,
  Server,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import Chat from "./views/Chat";
import Discover from "./views/Discover";
import Downloads from "./views/Downloads";
import HardwareProfiles from "./views/HardwareProfiles";
import LocalLibrary from "./views/LocalLibrary";
import RunnerSettings from "./views/RunnerSettings";

const MAX_STARTUP_WAIT_MS = 60_000;
const HEALTH_RETRY_MS = 1_500;

function formatLogTime(ts: number) {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function LogEntry({ log }: { log: BackendLog }) {
  return (
    <div
      className={`font-mono text-xs ${
        log.stream === "stderr" ? "text-red-300" : "text-gray-300"
      }`}
    >
      <span className="text-gray-500">{formatLogTime(log.receivedAt)}</span>{" "}
      <span className={log.stream === "stderr" ? "text-red-400" : "text-blue-400"}>
        [{log.stream}]
      </span>{" "}
      {log.text}
    </div>
  );
}

function StartupOverlay({
  logs,
  onContinue,
}: {
  logs: BackendLog[];
  onContinue: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-950 p-8 text-gray-100">
      <div className="mb-6 flex items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
        <div>
          <h1 className="text-xl font-semibold">Starting AI Model Browser</h1>
          <p className="text-sm text-gray-400">Waiting for the backend sidecar to come online…</p>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="mb-6 h-64 w-full max-w-3xl overflow-y-auto rounded-lg border border-gray-800 bg-black/50 p-4"
      >
        {logs.length === 0 ? (
          <p className="text-sm text-gray-500">Backend logs will appear here.</p>
        ) : (
          logs.map((log, i) => <LogEntry key={i} log={log} />)
        )}
      </div>

      <button
        onClick={onContinue}
        className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700"
      >
        Continue anyway
      </button>
    </div>
  );
}

function LogsPanel({ logs, onClear, onClose }: { logs: BackendLog[]; onClear: () => void; onClose: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
      <div className="flex h-[80vh] w-full max-w-4xl flex-col rounded-xl border border-gray-700 bg-gray-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <ScrollText className="h-5 w-5 text-blue-400" />
            Backend Logs
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={onClear}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-800"
            >
              <Trash2 className="h-4 w-4" />
              Clear
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
          {logs.length === 0 ? (
            <p className="text-sm text-gray-500">No backend logs captured yet.</p>
          ) : (
            logs.map((log, i) => <LogEntry key={i} log={log} />)
          )}
        </div>
      </div>
    </div>
  );
}

function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [forceContinue, setForceContinue] = useState(false);
  const [view, setView] = useState<
    | "dashboard"
    | "hardware"
    | "library"
    | "discover"
    | "downloads"
    | "runners"
    | "chat"
  >("dashboard");
  const startTimeRef = useRef(Date.now());
  const { logs, clear } = useBackendLogs(500);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | null = null;

    async function checkHealth() {
      try {
        const status = await getHealth();
        if (!cancelled) {
          setHealth(status);
          setError(null);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Backend unreachable");
          setHealth(null);
          const elapsed = Date.now() - startTimeRef.current;
          if (elapsed < MAX_STARTUP_WAIT_MS) {
            timeoutId = window.setTimeout(checkHealth, HEALTH_RETRY_MS);
          } else {
            setLoading(false);
          }
        }
      }
    }

    checkHealth();

    return () => {
      cancelled = true;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, []);

  const healthy = health?.status === "ok";
  const showStartup = loading && !forceContinue && !healthy;

  const latestLogs = useMemo(() => logs.slice(-20), [logs]);

  const navLinks: Array<{ id: typeof view; label: string }> = [
    { id: "dashboard", label: "Dashboard" },
    { id: "discover", label: "Discover" },
    { id: "downloads", label: "Downloads" },
    { id: "library", label: "Library" },
    { id: "hardware", label: "Hardware" },
    { id: "runners", label: "Runners" },
    { id: "chat", label: "Chat" },
  ];

  const nav = (
    <nav className="border-b border-gray-800 bg-gray-900 px-8 py-4">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <div className="flex items-center gap-3">
          <Cpu className="h-6 w-6 text-blue-400" />
          <span className="text-lg font-bold">AI Model Browser</span>
        </div>
        <div className="flex items-center gap-4">
          {navLinks.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className={`text-sm font-medium ${
                view === id ? "text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
          <button
            onClick={() => setShowLogs(true)}
            className="flex items-center gap-1 rounded-lg border border-gray-700 px-2.5 py-1 text-xs font-medium text-gray-300 hover:bg-gray-800"
          >
            <ScrollText className="h-3.5 w-3.5" />
            Logs
          </button>
        </div>
      </div>
    </nav>
  );

  if (showStartup) {
    return <StartupOverlay logs={latestLogs} onContinue={() => setForceContinue(true)} />;
  }

  if (view === "hardware") {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100">
        {nav}
        <HardwareProfiles />
        {showLogs && <LogsPanel logs={logs} onClear={clear} onClose={() => setShowLogs(false)} />}
      </div>
    );
  }

  if (view === "library") {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100">
        {nav}
        <LocalLibrary />
        {showLogs && <LogsPanel logs={logs} onClear={clear} onClose={() => setShowLogs(false)} />}
      </div>
    );
  }

  if (view === "discover") {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100">
        {nav}
        <Discover />
        {showLogs && <LogsPanel logs={logs} onClear={clear} onClose={() => setShowLogs(false)} />}
      </div>
    );
  }

  if (view === "downloads") {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100">
        {nav}
        <Downloads />
        {showLogs && <LogsPanel logs={logs} onClear={clear} onClose={() => setShowLogs(false)} />}
      </div>
    );
  }

  if (view === "runners") {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100">
        {nav}
        <RunnerSettings />
        {showLogs && <LogsPanel logs={logs} onClear={clear} onClose={() => setShowLogs(false)} />}
      </div>
    );
  }

  if (view === "chat") {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100">
        {nav}
        <Chat />
        {showLogs && <LogsPanel logs={logs} onClear={clear} onClose={() => setShowLogs(false)} />}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      {nav}

      <main className="mx-auto max-w-7xl p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="mt-1 text-gray-400">
            Discover, benchmark, and manage local AI models.
          </p>
        </header>

        <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Server className="h-5 w-5 text-purple-400" />
                Backend Status
              </h2>
              <Activity
                className={`h-5 w-5 ${
                  health?.status === "ok"
                    ? "text-green-400"
                    : error
                      ? "text-red-400"
                      : "text-yellow-400"
                }`}
              />
            </div>

            {loading ? (
              <div className="flex items-center gap-2 text-gray-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking backend health…
              </div>
            ) : error ? (
              <div className="rounded-lg bg-red-900/30 p-4 text-red-200">
                <p className="font-medium">Unable to reach backend</p>
                <p className="mt-1 text-sm">{error}</p>
              </div>
            ) : health ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-2.5 w-2.5 rounded-full bg-green-400" />
                  <span className="font-medium capitalize">{health.status}</span>
                </div>
                <p className="text-sm text-gray-400">Service: {health.service}</p>
                <p className="text-sm text-gray-400">Version: {health.version}</p>
              </div>
            ) : null}
          </div>

          <button
            onClick={() => setView("discover")}
            className="rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-sm text-left hover:bg-gray-800/80 transition-colors"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Globe className="h-5 w-5 text-blue-400" />
                Discover Models
              </h2>
              <Activity className="h-5 w-5 text-blue-400" />
            </div>
            <p className="text-gray-400">
              Search Hugging Face and see compatibility with your active profile.
            </p>
          </button>

          <button
            onClick={() => setView("hardware")}
            className="rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-sm text-left hover:bg-gray-800/80 transition-colors"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <HardDrive className="h-5 w-5 text-blue-400" />
                Hardware Profiles
              </h2>
              <Activity className="h-5 w-5 text-blue-400" />
            </div>
            <p className="text-gray-400">
              Manage and switch between target machine configurations.
            </p>
          </button>

          <button
            onClick={() => setView("library")}
            className="rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-sm text-left hover:bg-gray-800/80 transition-colors"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Archive className="h-5 w-5 text-purple-400" />
                Local Library
              </h2>
              <Activity className="h-5 w-5 text-purple-400" />
            </div>
            <p className="text-gray-400">
              Scan folders and manage local GGUF, Safetensors, ONNX, and MLX files.
            </p>
          </button>

          <button
            onClick={() => setView("downloads")}
            className="rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-sm text-left hover:bg-gray-800/80 transition-colors"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Download className="h-5 w-5 text-blue-400" />
                Downloads
              </h2>
              <Activity className="h-5 w-5 text-blue-400" />
            </div>
            <p className="text-gray-400">
              Track queued and active model downloads with progress and ETA.
            </p>
          </button>

          <button
            onClick={() => setView("runners")}
            className="rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-sm text-left hover:bg-gray-800/80 transition-colors"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Settings className="h-5 w-5 text-purple-400" />
                Runner Settings
              </h2>
              <Activity className="h-5 w-5 text-purple-400" />
            </div>
            <p className="text-gray-400">
              Detect installed runners and configure shared model folders.
            </p>
          </button>

          <button
            onClick={() => setView("chat")}
            className="rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-sm text-left hover:bg-gray-800/80 transition-colors"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-blue-400" />
                Test Chat
              </h2>
              <Activity className="h-5 w-5 text-blue-400" />
            </div>
            <p className="text-gray-400">
              Prompt a loaded model through Ollama, llama.cpp, or LM Studio.
            </p>
          </button>
        </section>
      </main>

      {showLogs && <LogsPanel logs={logs} onClear={clear} onClose={() => setShowLogs(false)} />}
    </div>
  );
}

export default App;
