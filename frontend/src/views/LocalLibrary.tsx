import { useEffect, useMemo, useState } from "react";
import {
  getInventory,
  getLauncherInfo,
  scanInventory,
} from "../api/client";
import type { LauncherInfo, LocalInventoryItem, ScanResult } from "../types";
import {
  AlertCircle,
  Archive,
  Check,
  Copy,
  Eye,
  ExternalLink,
  FolderOpen,
  HardDrive,
  Loader2,
  Play,
  RefreshCw,
  Search,
  Terminal,
  X,
} from "lucide-react";

const CAPABILITY_FILTERS = ["All", "LLM", "Vision", "Coding"];

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(2)} ${units[i]}`;
}

export default function LocalLibrary() {
  const [items, setItems] = useState<LocalInventoryItem[]>([]);
  const [paths, setPaths] = useState("");
  const [loading, setLoading] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [launcherItem, setLauncherItem] = useState<LocalInventoryItem | null>(
    null,
  );
  const [launcherInfo, setLauncherInfo] = useState<LauncherInfo | null>(null);
  const [launcherLoading, setLauncherLoading] = useState(false);
  const [copiedRunner, setCopiedRunner] = useState<string | null>(null);

  async function loadInventory() {
    try {
      setError(null);
      const data = await getInventory();
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load inventory");
    }
  }

  useEffect(() => {
    loadInventory();
  }, []);

  async function handleScan(event: React.FormEvent) {
    event.preventDefault();
    const pathList = paths
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (pathList.length === 0) {
      setError("Enter at least one folder path");
      return;
    }

    setLoading(true);
    setError(null);
    setScanResult(null);
    try {
      const result = await scanInventory(pathList);
      setScanResult(result);
      await loadInventory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setLoading(false);
    }
  }

  async function openLauncher(item: LocalInventoryItem) {
    setLauncherItem(item);
    setLauncherLoading(true);
    setCopiedRunner(null);
    try {
      const info = await getLauncherInfo(item.id);
      setLauncherInfo(info);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load launcher info");
      setLauncherItem(null);
    } finally {
      setLauncherLoading(false);
    }
  }

  function copyCommand(command: string, runnerId: string) {
    navigator.clipboard.writeText(command).then(() => {
      setCopiedRunner(runnerId);
      setTimeout(() => setCopiedRunner(null), 2000);
    });
  }

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        !search ||
        item.filename.toLowerCase().includes(search.toLowerCase()) ||
        item.detected_format.toLowerCase().includes(search.toLowerCase());
      const matchesFilter =
        filter === "All" ||
        (item.detected_capability ?? "LLM")
          .split(",")
          .map((c) => c.trim())
          .includes(filter);
      return matchesSearch && matchesFilter;
    });
  }, [items, search, filter]);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Archive className="w-8 h-8 text-purple-400" />
          Local Library
        </h1>
        <p className="text-gray-400 mt-1">
          Scan folders on disk for local model files and auto-tag them by
          capability.
        </p>
      </header>

      <section className="mb-8 rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-blue-400" />
          Scan Folders
        </h2>
        <form onSubmit={handleScan} className="flex flex-col gap-3 md:flex-row">
          <input
            type="text"
            value={paths}
            onChange={(e) => setPaths(e.target.value)}
            placeholder="/path/to/models, /another/folder"
            className="flex-1 rounded-lg border border-gray-600 bg-gray-900 px-4 py-2 text-sm text-white placeholder:text-gray-500 focus:border-blue-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {loading ? "Scanning..." : "Scan"}
          </button>
        </form>
        <p className="mt-2 text-xs text-gray-500">
          Separate multiple paths with commas. Supports .gguf, .safetensors,
          .bin, .onnx, .mlx, .exl2.
        </p>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-900/30 p-3 text-red-200">
            <AlertCircle className="mt-0.5 w-4 h-4" />
            {error}
          </div>
        )}

        {scanResult && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-green-900/30 p-3 text-green-200">
            <Check className="mt-0.5 w-4 h-4" />
            Scanned {scanResult.scanned} path(s), discovered{" "}
            {scanResult.discovered} file(s), inserted {scanResult.inserted} new
            file(s).
            {scanResult.errors.length > 0 && (
              <ul className="mt-2 list-disc pl-5 text-sm">
                {scanResult.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-sm">
        <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h2 className="text-lg font-semibold">Scanned Models ({filteredItems.length})</h2>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search files..."
                className="rounded-lg border border-gray-600 bg-gray-900 pl-9 pr-4 py-2 text-sm text-white placeholder:text-gray-500 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="flex gap-2">
              {CAPABILITY_FILTERS.map((cap) => (
                <button
                  key={cap}
                  onClick={() => setFilter(cap)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    filter === cap
                      ? "bg-blue-600 text-white"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
                >
                  {cap}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-600 p-12 text-center">
            <HardDrive className="mb-3 w-10 h-10 text-gray-600" />
            <p className="text-gray-400">No model files found yet.</p>
            <p className="text-sm text-gray-500">Scan a folder to populate your library.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-2 py-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{item.filename}</p>
                  <p className="truncate text-sm text-gray-500">
                    {item.local_path}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-gray-700 px-2.5 py-1 text-xs font-medium">
                    {item.detected_format}
                  </span>
                  {(item.detected_capability ?? "LLM")
                    .split(",")
                    .map((cap) => cap.trim())
                    .map((cap) => (
                      <span
                        key={cap}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                          cap === "Vision"
                            ? "bg-purple-900/40 text-purple-300"
                            : cap === "Coding"
                              ? "bg-orange-900/40 text-orange-300"
                              : "bg-green-900/40 text-green-300"
                        }`}
                      >
                        {cap === "Vision" && <Eye className="w-3 h-3" />}
                        {cap === "Coding" && <X className="w-3 h-3" />}
                        {cap}
                      </span>
                    ))}
                  <span className="text-sm text-gray-400">
                    {formatBytes(item.size_bytes)}
                  </span>
                  <button
                    onClick={() => openLauncher(item)}
                    className="rounded-lg border border-gray-600 p-2 text-gray-400 hover:text-white hover:border-gray-500"
                    title="Launch with external runner"
                  >
                    <Play className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {launcherItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Terminal className="w-5 h-5 text-blue-400" />
                Launch Model
              </h2>
              <button
                onClick={() => {
                  setLauncherItem(null);
                  setLauncherInfo(null);
                }}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {launcherLoading ? (
              <p className="text-gray-400">Loading runner commands...</p>
            ) : launcherInfo ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-400">
                  <span className="font-medium text-white">{launcherInfo.filename}</span>
                </p>
                <div className="rounded-lg bg-gray-900 p-3 text-xs text-gray-400 break-all">
                  {launcherInfo.local_path}
                </div>

                <div className="space-y-2">
                  {launcherInfo.runners.map((runner) => (
                    <div
                      key={runner.id}
                      className="rounded-lg border border-gray-700 bg-gray-900 p-3"
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span className="font-medium">{runner.name}</span>
                        <button
                          onClick={() => copyCommand(runner.command, runner.id)}
                          className="inline-flex items-center gap-1 rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-500"
                        >
                          {copiedRunner === runner.id ? (
                            <>
                              <Check className="w-3 h-3" /> Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" /> Copy command
                            </>
                          )}
                        </button>
                      </div>
                      <code className="block break-all text-xs text-gray-400">
                        {runner.command}
                      </code>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-gray-400">No runner info available.</p>
            )}

            <a
              href={launcherItem.local_path}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300"
            >
              <ExternalLink className="w-4 h-4" />
              Reveal in Finder (local path)
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
