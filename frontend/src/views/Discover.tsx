
import { useEffect, useMemo, useState } from "react";
import { discoverUrl, logFrontend, searchModels, startDownloadJob } from "../api/client";
import type { DiscoverResult, ModelFamily, ModelFile } from "../types";
import ModelAuthorIcon from "../components/ModelAuthorIcon";
import {
  AlertCircle,
  ArrowUpDown,
  Calendar,
  Check,
  Copy,
  Download,
  ExternalLink,
  Gauge,
  Globe,
  Heart,
  Link2,
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

const DOWNLOAD_TARGETS = [
  { id: "default", label: "Default folder" },
  { id: "lm_studio", label: "LM Studio folder" },
  { id: "ollama", label: "Ollama import" },
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

const FAMILY_SORT_OPTIONS = [
  { id: "default", label: "Default" },
  { id: "downloads", label: "Downloads" },
  { id: "likes", label: "Likes" },
  { id: "name", label: "Name" },
  { id: "params", label: "Parameters" },
  { id: "date", label: "Newest" },
];

const FILE_SORT_OPTIONS = [
  { id: "default", label: "Default" },
  { id: "size", label: "Size" },
  { id: "tokens", label: "Est. tok/s" },
  { id: "quant", label: "Quantization" },
  { id: "name", label: "Name" },
];

type DiscoverMode = "popular" | "trending" | "search" | "url";

const MODES: { id: DiscoverMode; label: string; icon: typeof Zap }[] = [
  { id: "popular", label: "Popular", icon: Zap },
  { id: "trending", label: "Trending", icon: TrendingUp },
  { id: "search", label: "Search", icon: Search },
  { id: "url", label: "Import URL", icon: Link2 },
];

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(2)} ${units[i]}`;
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  try {
    const date = new Date(iso);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return null;
  }
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

function PredictionBadge({ file }: { file: ModelFile }) {
  const prediction = file.prediction;
  if (!prediction) return null;

  const { generation_tok_s, prefill_tok_s, using_default_specs } = prediction;
  const tooltip = prefill_tok_s
    ? `Estimated on active profile\nGeneration: ~${generation_tok_s} tok/s\nPrefill: ~${prefill_tok_s} tok/s\nBottleneck: ${prediction.bottleneck}`
    : `Estimated on active profile\nGeneration: ~${generation_tok_s} tok/s\nParameter count unknown; prefill estimate unavailable`;

  return (
    <span
      title={tooltip}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${
        using_default_specs
          ? "border-gray-600 bg-gray-800 text-gray-400"
          : "border-blue-700 bg-blue-900/30 text-blue-300"
      }`}
    >
      <Gauge className="w-3 h-3" />
      ~{generation_tok_s} tok/s
      {using_default_specs && (
        <span className="text-[10px] opacity-70">(est.)</span>
      )}
    </span>
  );
}

export default function Discover({
  initialMode,
  initialQuery,
}: {
  initialMode?: "url" | "search";
  initialQuery?: string;
}) {
  const [mode, setMode] = useState<DiscoverMode>(initialMode ?? "popular");
  const [query, setQuery] = useState(initialQuery ?? "");
  const [urlInput, setUrlInput] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [activeFormat, setActiveFormat] = useState("All");
  const [result, setResult] = useState<DiscoverResult | null>(null);
  const [urlResult, setUrlResult] = useState<
    Awaited<ReturnType<typeof discoverUrl>> | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(
    new Set(),
  );
  const [expandedUrlFiles, setExpandedUrlFiles] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadResult, setDownloadResult] = useState<string | null>(null);
  const [downloadTarget, setDownloadTarget] = useState("default");
  const [familySort, setFamilySort] = useState("default");
  const [fileSort, setFileSort] = useState("default");

  function setModeAndClear(newMode: DiscoverMode) {
    setMode(newMode);
    if (newMode !== "search") setQuery("");
    if (newMode !== "url") setUrlInput("");
    setUrlResult(null);
    setExpandedUrlFiles(false);
  }

  async function performSearch() {
    setLoading(true);
    setError(null);
    try {
      if (mode === "url") {
        if (!urlInput.trim()) {
          setUrlResult(null);
          setLoading(false);
          return;
        }
        const data = await discoverUrl(urlInput.trim());
        setUrlResult(data);
        setExpandedUrlFiles(true);
        setLoading(false);
        return;
      }

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
      const message = err instanceof Error ? err.message : "Search failed";
      setError(message);
      setResult(null);
      setUrlResult(null);
      setExpandedFamilies(new Set());
      setExpandedUrlFiles(false);
      logFrontend("error", "Discover search failed", {
        mode,
        query,
        activeFilter,
        activeFormat,
        error: message,
      });
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    if (mode === "url") {
      setResult(null);
      setExpandedFamilies(new Set());
      return;
    }
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

  function toggleUrlFiles() {
    setExpandedUrlFiles((prev) => !prev);
  }

  async function handleDownload(
    url: string,
    filename: string,
    familyId: string,
  ) {
    const id = `${familyId}/${filename}`;
    setDownloadingId(id);
    setDownloadResult(null);
    try {
      const job = await startDownloadJob(
        url,
        filename,
        undefined,
        downloadTarget === "default" ? undefined : downloadTarget,
        familyId,
      );
      let message = `Queued ${job.filename}. Track progress in the Downloads page.`;
      if (downloadTarget === "lm_studio") {
        message += " It will be moved to the LM Studio folder on completion.";
      } else if (downloadTarget === "ollama") {
        message += " It will be imported into Ollama on completion.";
      }
      setDownloadResult(message);
      setTimeout(() => setDownloadResult(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloadingId(null);
    }
  }

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url);
  }

  const families = useMemo(() => {
    const list = (result?.families ?? []).map((family) => ({ ...family }));
    switch (familySort) {
      case "downloads":
        list.sort((a, b) => b.downloads - a.downloads);
        break;
      case "likes":
        list.sort((a, b) => b.likes - a.likes);
        break;
      case "name":
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "params":
        list.sort((a, b) => {
          const ap = a.params_billions ?? -1;
          const bp = b.params_billions ?? -1;
          return bp - ap;
        });
        break;
      case "date":
        list.sort((a, b) => {
          const ad = a.created_at ? new Date(a.created_at).getTime() : 0;
          const bd = b.created_at ? new Date(b.created_at).getTime() : 0;
          return bd - ad;
        });
        break;
      default:
        break;
    }
    return list;
  }, [result?.families, familySort]);

  function sortFiles(files: ModelFile[]): ModelFile[] {
    const sorted = [...files];
    switch (fileSort) {
      case "size":
        sorted.sort((a, b) => b.size_bytes - a.size_bytes);
        break;
      case "tokens":
        sorted.sort((a, b) => {
          const at = a.prediction?.generation_tok_s ?? -1;
          const bt = b.prediction?.generation_tok_s ?? -1;
          return bt - at;
        });
        break;
      case "quant":
        sorted.sort((a, b) => {
          const aq = a.quant_bits ?? -1;
          const bq = b.quant_bits ?? -1;
          return bq - aq;
        });
        break;
      case "name":
        sorted.sort((a, b) => a.filename.localeCompare(b.filename));
        break;
      default:
        break;
    }
    return sorted;
  }

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
          {mode === "url" ? (
            <>
              <div className="relative flex-1">
                <Link2 className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && performSearch()}
                  placeholder="https://huggingface.co/owner/repo or link to a file"
                  className="w-full rounded-lg border border-gray-600 bg-gray-900 pl-9 pr-4 py-2 text-sm text-white placeholder:text-gray-500 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <button
                onClick={performSearch}
                disabled={loading || !urlInput.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Link2 className="w-4 h-4" />
                )}
                {loading ? "Importing..." : "Import"}
              </button>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>

        {mode !== "url" && (
          <>
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

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-sm text-gray-400">
                <ArrowUpDown className="w-4 h-4" />
                <span>Sort families:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {FAMILY_SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setFamilySort(opt.id)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      familySort === opt.id
                        ? "bg-cyan-600 text-white"
                        : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-sm text-gray-400">
                <ArrowUpDown className="w-4 h-4" />
                <span>Sort files:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {FILE_SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setFileSort(opt.id)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      fileSort === opt.id
                        ? "bg-orange-600 text-white"
                        : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-400">Download to:{" "}</span>
          {DOWNLOAD_TARGETS.map((target) => (
            <button
              key={target.id}
              onClick={() => setDownloadTarget(target.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                downloadTarget === target.id
                  ? "bg-orange-600 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              {target.label}
            </button>
          ))}
        </div>

        {result && mode !== "url" && (
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-gray-400">
            <span>
              Active profile:{" "}
              <strong className="text-white">{result.active_profile.name}</strong>
            </span>
            <span>·</span>
            <span>{result.count} result(s)</span>
            {(result.active_profile.memory_bandwidth_gbps ||
              result.active_profile.vram_bandwidth_gbps) && (
              <span className="text-xs text-gray-500">
                (
                {result.active_profile.vram_bandwidth_gbps
                  ? `${result.active_profile.vram_bandwidth_gbps} GB/s VRAM`
                  : `${result.active_profile.memory_bandwidth_gbps} GB/s memory`}
                {result.active_profile.gpu_compute_fp16_tflops
                  ? ` · ${result.active_profile.gpu_compute_fp16_tflops} FP16 TFLOPS`
                  : ""}
                )
              </span>
            )}
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-lg bg-red-900/30 p-3 text-red-200">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 w-4 h-4 shrink-0" />
              <div className="min-w-0">
                <p className="font-medium">Search failed</p>
                <p className="text-sm break-words">{error}</p>
              </div>
            </div>
            <button
              onClick={performSearch}
              disabled={loading}
              className="mt-3 inline-flex items-center gap-1 rounded bg-red-800 px-3 py-1 text-xs font-medium hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Search className="w-3 h-3" />
              )}
              Retry
            </button>
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
        {mode === "url" && urlResult && (
          <div className="rounded-xl border border-gray-700 bg-gray-800 p-6">
            <div
              className="mb-4 flex cursor-pointer items-center justify-between"
              onClick={toggleUrlFiles}
            >
              <div>
                <h3 className="text-lg font-semibold text-white">{urlResult.repo_id}</h3>
                <p className="text-sm text-gray-400">{urlResult.files.length} file(s) found</p>
              </div>
              <span className="text-sm text-blue-400">{expandedUrlFiles ? "Collapse" : "Expand"}</span>
            </div>

            {expandedUrlFiles && (
              <div className="space-y-3">
                {urlResult.files.map((file) => {
                  const id = `${urlResult.family_id}/${file.filename}`;
                  return (
                    <div
                      key={file.filename}
                      className="flex items-center justify-between rounded-lg border border-gray-700 bg-gray-900 p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">
                          {file.filename}
                        </p>
                        <p className="text-xs text-gray-400">
                          {file.format}
                          {file.quant_method ? ` · ${file.quant_method}` : ""} ·{" "}
                          {formatBytes(file.size_bytes)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => copyUrl(file.download_url)}
                          className="rounded p-2 text-gray-400 hover:bg-gray-800 hover:text-white"
                          title="Copy URL"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() =>
                            handleDownload(
                              file.download_url,
                              file.filename,
                              urlResult.family_id,
                            )
                          }
                          disabled={downloadingId === id}
                          className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                        >
                          {downloadingId === id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Download className="h-3.5 w-3.5" />
                          )}
                          {downloadingId === id ? "Queuing…" : "Download"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {mode === "url" && !urlResult && !loading && !error && (
          <div className="rounded-lg border border-dashed border-gray-600 p-12 text-center text-gray-400">
            <Link2 className="mx-auto mb-3 w-10 h-10 text-gray-600" />
            <p>Paste a Hugging Face model URL and click Import to list downloadable files.</p>
          </div>
        )}

        {families.length === 0 && !loading && !error && mode !== "url" && (
          <div className="rounded-lg border border-dashed border-gray-600 p-12 text-center text-gray-400">
            {mode === "popular" ? (
              <Zap className="mx-auto mb-3 w-10 h-10 text-gray-600" />
            ) : mode === "trending" ? (
              <TrendingUp className="mx-auto mb-3 w-10 h-10 text-gray-600" />
            ) : (
              <Search className="mx-auto mb-3 w-10 h-10 text-gray-600" />
            )}
            <p className="font-medium">
              {mode === "popular"
                ? "No models matched your filters."
                : mode === "trending"
                  ? "No trending models matched your filters."
                  : "No models found for this search."}
            </p>
            <p className="mt-2 text-sm">
              {activeFilter !== "All" || activeFormat !== "All"
                ? `Try switching ${activeFilter !== "All" ? `capability from “${activeFilter}”` : ""}${activeFilter !== "All" && activeFormat !== "All" ? " and " : ""}${activeFormat !== "All" ? `format from “${activeFormat}” to “All formats”` : ""}.`
                : mode === "search"
                  ? "Try a different keyword or model name."
                  : "Quantized formats like GGUF often live in separate repos. Try “All formats” or use Search."}
            </p>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p>Searching Hugging Face…</p>
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
            sortFiles={sortFiles}
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
  sortFiles,
}: {
  family: ModelFamily;
  expanded: boolean;
  onToggle: () => void;
  onDownload: (url: string, filename: string, familyId: string) => void;
  onCopyUrl: (url: string) => void;
  downloadingId: string | null;
  sortFiles: (files: ModelFile[]) => ModelFile[];
}) {
  const bestCompat = useMemo(() => {
    const statuses = family.files.map((f) => f.compatibility.status);
    if (statuses.includes("green")) return "green";
    if (statuses.includes("yellow")) return "yellow";
    return "red";
  }, [family.files]);

  const sortedFiles = useMemo(() => sortFiles(family.files), [family.files, sortFiles]);

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
          <div className="flex items-center gap-4 text-sm text-gray-400 shrink-0">
            {family.created_at && (
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {formatDate(family.created_at)}
              </span>
            )}
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
              {sortedFiles.map((file, idx) => {
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <CompatibilityBadge
                        status={file.compatibility.status}
                        label={file.compatibility.label}
                      />
                      <PredictionBadge file={file} />
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
