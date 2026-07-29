import { useEffect, useState } from "react";
import { getHealth } from "./api/client";
import type { HealthStatus } from "./types";
import {
  Activity,
  Archive,
  Cpu,
  Globe,
  HardDrive,
  Server,
} from "lucide-react";
import Discover from "./views/Discover";
import HardwareProfiles from "./views/HardwareProfiles";
import LocalLibrary from "./views/LocalLibrary";

function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<
    "dashboard" | "hardware" | "library" | "discover"
  >("dashboard");

  useEffect(() => {
    let cancelled = false;

    async function checkHealth() {
      try {
        setLoading(true);
        setError(null);
        const status = await getHealth();
        if (!cancelled) setHealth(status);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Backend unreachable");
          setHealth(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    checkHealth();

    const interval = setInterval(checkHealth, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const navLinks: Array<{ id: typeof view; label: string }> = [
    { id: "dashboard", label: "Dashboard" },
    { id: "discover", label: "Discover" },
    { id: "library", label: "Library" },
    { id: "hardware", label: "Hardware" },
  ];

  const nav = (
    <nav className="border-b border-gray-800 bg-gray-900 px-8 py-4">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <div className="flex items-center gap-3">
          <Cpu className="w-6 h-6 text-blue-400" />
          <span className="text-lg font-bold">AI Model Browser</span>
        </div>
        <div className="flex gap-4">
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
        </div>
      </div>
    </nav>
  );

  if (view === "hardware") {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100">
        {nav}
        <HardwareProfiles />
      </div>
    );
  }

  if (view === "library") {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100">
        {nav}
        <LocalLibrary />
      </div>
    );
  }

  if (view === "discover") {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100">
        {nav}
        <Discover />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      {nav}

      <main className="mx-auto max-w-7xl p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-gray-400 mt-1">
            Discover, benchmark, and manage local AI models.
          </p>
        </header>

        <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Server className="w-5 h-5 text-purple-400" />
                Backend Status
              </h2>
              <Activity
                className={`w-5 h-5 ${
                  health?.status === "ok"
                    ? "text-green-400"
                    : error
                      ? "text-red-400"
                      : "text-yellow-400"
                }`}
              />
            </div>

            {loading && !health && !error ? (
              <p className="text-gray-400">Checking backend health...</p>
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
                <p className="text-sm text-gray-400">
                  Service: {health.service}
                </p>
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
                <Globe className="w-5 h-5 text-blue-400" />
                Discover Models
              </h2>
              <Activity className="w-5 h-5 text-blue-400" />
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
                <HardDrive className="w-5 h-5 text-blue-400" />
                Hardware Profiles
              </h2>
              <Activity className="w-5 h-5 text-blue-400" />
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
                <Archive className="w-5 h-5 text-purple-400" />
                Local Library
              </h2>
              <Activity className="w-5 h-5 text-purple-400" />
            </div>
            <p className="text-gray-400">
              Scan folders and manage local GGUF, Safetensors, ONNX, and MLX
              files.
            </p>
          </button>
        </section>
      </main>
    </div>
  );
}

export default App;
