import { useEffect, useMemo, useState } from "react";
import { downloadModelFile, searchModels } from "../api/client";
import type { DiscoverResult, ModelFamily } from "../types";
import ModelAuthorIcon from "../components/ModelAuthorIcon";
import {
  AlertCircle,
  Check,
  Copy,
  Download,
  ExternalLink,
  Globe,
  Heart,
  Loader2,
  Search,
  TrendingUp,
  Zap,
} from "lucide-react";

const CAPABILITY_FILTERS = [
  "All",
  "LLM",
  "Vision",
  "Tool Use",
  "Reasoning",
  "Coding",
  "Embedding",
  "Audio",
  "Multimodal",
];
const FORMAT_FILTERS = [
  "All",
  "GGUF",
  "Safetensors",
  "MLX",
  "Pickled",
  "ONNX",
  "EXL2",
];

type DiscoverMode = "popular" | "trending" | "search";

const MODES: { id: DiscoverMode; label: string; icon: typeof Zap }[] = [
  { id: "popular", label: "Popular", icon: Zap },
  { id: "trending", label: "Trending", icon: TrendingUp },
  { id: "search", label: "Search", icon: Search },
];

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(2)} ${units[i]}`;
}

function CompatibilityBadge({
  status,
  label,
}: {
  status: "green" | "yellow" | "red";
  label: string;
}) {
  const styles = {
    green: "bg-green-900/40 text-green-300 border-green-700",
    yellow: "bg-yellow-900/40 text-yellow-300 border-yellow-700",
    red: "bg-red-900/40 text-red-300 border-red-700",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${styles[status]}`}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          status === "green"
            ? "bg-green-400"
            : status === "yellow"
              ? "bg-yellow-400"
              : "bg-red-400"
        }`}
      />
      {label}
    </span>
  );
}

export default function Discover() {
  const [mode, setMode] = useState<DiscoverMode>("popular");
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [activeFormat, setActiveFormat] = useState("All");
  const [result, setResult] = useState<DiscoverResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(
    new Set(),
  );
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadResult, setDownloadResult] = useState<string | null>(null);

  function setModeAndClear(newMode: DiscoverMode) {
    setMode(newMode);
    if (newMode !== "search") setQuery("");
  }

  async function performSearch() {
    setLoading(true);
    setError(null);
    try {
      const capabilityFilter =
        activeFilter === "All" ? undefined : activeFilter;
      const formatFilter = activeFormat === "All" ? undefined : activeFormat;
      let data: DiscoverResult;
      if (mode === "popular") {
        data = await searchModels(
          "",
          capabilityFilter,
          formatFilter,
          20,
          "downloads",
        );
      } else if (mode === "trending") {
        data = await searchModels(
          "",
          capabilityFilter,
          formatFilter,
          20,
          "trendingScore",
        );
      } else {
        data = await searchModels(
          query.trim(),
          capabilityFilter,
          formatFilter,
          20,
        );
      }
      setResult(data);
      setExpandedFamilies(new Set(data.families.slice(0, 3).map((f) => f.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    performSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, activeFilter, activeFormat]);

  function toggleFamily(id: string) {
    setExpandedFamilies((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleDownload(url: string, filename: string, familyId: string) {
    const id = `${familyId}/${filename}`;
    setDownloadingId(id);
    setDownloadResult(null);
    try {
      const res = await downloadModelFile(url, filename);
      setDownloadResult(`Saved ${res.filename} (${formatBytes(res.size_bytes)})`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloadingId(null);
    }
  }

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url);
  }

  const families = result?.families ?? [];

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Globe className="w-8 h-8 text-blue-400" />
          Discover Models
        </h1>
        <p className="text-gray-400 mt-1">
          Search Hugging Face for quantized model files and see how they fit your
          active hardware profile.
        </p>
      </header>

      <section className="mb-6 rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap gap-2">
          {MODES.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setModeAndClear(tab.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium capitalize ${
                  mode === tab.id
                    ? "bg-blue-600 text-white"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && mode === "search" && performSearch()
              }
              placeholder={
                mode === "search"
                  ? "Search Hugging Face (e.g. llama, qwen, mistral)"
                  : "Switch to Search to type a query"
              }
              disabled={mode !== "search"}
              className="w-full rounded-lg border border-gray-600 bg-gray-900 pl-9 pr-4 py-2 text-sm text-white placeholder:text-gray-500 focus:border-blue-500 focus:outline-none disabled:opacity-50"
            />
          </div>
          <button
            onClick={performSearch}
            disabled={loading || mode !== "search"}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            {loading ? "Searching..." : "Search"}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {CAPABILITY_FILTERS.map((cap) => (
            <button
              key={cap}
              onClick={() => setActiveFilter(cap)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                activeFilter === cap
                  ? "bg-blue-600 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              {cap}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {FORMAT_FILTERS.map((fmt) => (
            <button
              key={fmt}
              onClick={() => setActiveFormat(fmt)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                activeFormat === fmt
                  ? "bg-purple-600 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              {fmt === "All" ? "All formats" : fmt}
            </button>
          ))}
        </div>

        {result && (
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-gray-400">
            <span>
              Active profile:{" "}
              <strong className="text-white">{result.active_profile.name}</strong>
            </span>
            <span>·</span>
            <span>{result.count} result(s)</span>
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-900/30 p-3 text-red-200">
            <AlertCircle className="mt-0.5 w-4 h-4" />
            {error}
          </div>
        )}

        {downloadResult && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-green-900/30 p-3 text-green-200">
            <Check className="mt-0.5 w-4 h-4" />
            {downloadResult}
          </div>
        )}
      </section>

      <section className="space-y-4">
        {families.length === 0 && !loading && !error && (
          <div className="rounded-lg border border-dashed border-gray-600 p-12 text-center text-gray-400">
            {mode === "popular" ? (
              <Zap className="mx-auto mb-3 w-10 h-10 text-gray-600" />
            ) : mode === "trending" ? (
              <TrendingUp className="mx-auto mb-3 w-10 h-10 text-gray-600" />
            ) : (
              <Search className="mx-auto mb-3 w-10 h-10 text-gray-600" />
            )}
            <p>
              {mode === "popular"
                ? "Showing the most popular Hugging Face model families by downloads."
                : mode === "trending"
                  ? "Showing the top trending Hugging Face model families right now."
                  : "Type a query above and press Enter to search Hugging Face."}
            </p>
          </div>
        )}

        {families.map((family) => (
          <FamilyCard
            key={family.id}
            family={family}
            expanded={expandedFamilies.has(family.id)}
            onToggle={() => toggleFamily(family.id)}
            onDownload={handleDownload}
            onCopyUrl={copyUrl}
            downloadingId={downloadingId}
          />
        ))}
      </section>
    </div>
  );
}

function FamilyCard({
  family,
  expanded,
  onToggle,
  onDownload,
  onCopyUrl,
  downloadingId,
}: {
  family: ModelFamily;
  expanded: boolean;
  onToggle: () => void;
  onDownload: (url: string, filename: string, familyId: string) => void;
  onCopyUrl: (url: string) => void;
  downloadingId: string | null;
}) {
  const bestCompat = useMemo(() => {
    const statuses = family.files.map((f) => f.compatibility.status);
    if (statuses.includes("green")) return "green";
    if (statuses.includes("yellow")) return "yellow";
    return "red";
  }, [family.files]);

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800 shadow-sm overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-6 text-left hover:bg-gray-800/80 transition-colors"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold truncate">{family.name}</h3>
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  bestCompat === "green"
                    ? "bg-green-400"
                    : bestCompat === "yellow"
                      ? "bg-yellow-400"
                      : "bg-red-400"
                }`}
              />
            </div>
            <p className="text-sm text-gray-400 mt-1 flex items-center gap-1.5">
              <ModelAuthorIcon author={family.author} />
              <span>{family.author}</span>
              <span>·</span>
              <span>{family.capabilities}</span>
            </p>
            {family.description && (
              <p className="mt-2 text-sm text-gray-300 line-clamp-2">
                {family.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <span className="flex items-center gap-1">
              <Download className="w-4 h-4" />
              {family.downloads.toLocaleString()}
            </span>
            <span className="flex items-center gap-1">
              <Heart className="w-4 h-4" />
              {family.likes.toLocaleString()}
            </span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-700">
          {family.files.length === 0 ? (
            <p className="p-6 text-sm text-gray-500">
              No supported model files found in this repository.
            </p>
          ) : (
            <ul className="divide-y divide-gray-700">
              {family.files.map((file, idx) => {
                const id = `${family.id}/${file.filename}`;
                const isDownloading = downloadingId === id;
                return (
                  <li
                    key={idx}
                    className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{file.filename}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-400">
                        <span className="rounded bg-gray-700 px-1.5 py-0.5">
                          {file.format}
                        </span>
                        {file.quant_method && (
                          <span className="rounded bg-gray-700 px-1.5 py-0.5">
                            {file.quant_method}
                          </span>
                        )}
                        <span>{formatBytes(file.size_bytes)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <CompatibilityBadge
                        status={file.compatibility.status}
                        label={file.compatibility.label}
                      />
                      <button
                        onClick={() => onDownload(file.download_url, file.filename, family.id)}
                        disabled={isDownloading}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-600 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white disabled:opacity-50"
                        title="Download file"
                      >
                        {isDownloading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                        {isDownloading ? "Downloading..." : "Download"}
                      </button>
                      <button
                        onClick={() => onCopyUrl(file.download_url)}
                        className="rounded-lg border border-gray-600 p-2 text-gray-400 hover:text-white hover:border-gray-500"
                        title="Copy download URL"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <a
                        href={file.download_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg border border-gray-600 p-2 text-gray-400 hover:text-white hover:border-gray-500"
                        title="Open on Hugging Face"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
