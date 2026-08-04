import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import type {
  ChatMessage,
  DetectedRunner,
  DiscoverResult,
  DownloadJob,
  DownloadSettings,
  HardwareProfile,
  HealthStatus,
  LauncherInfo,
  LocalInventoryItem,
  RunnerSettings,
  ScanResult,
  SystemSpecs,
  TokenPrediction,
} from "../types";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function httpFetch(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  if (isTauri()) {
    return tauriFetch(input, init);
  }
  return globalThis.fetch(input, init);
}

async function apiGet<T>(path: string): Promise<T> {
  const response = await httpFetch(`${API_BASE}${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const response = await httpFetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function logFrontend(level: string, message: string, context?: Record<string, unknown>): Promise<void> {
  try {
    await apiPost("/api/log/frontend", { level, message, context });
  } catch {
    // ignore logging errors
  }
}

async function apiPut<T>(path: string, body?: unknown): Promise<T> {
  const response = await httpFetch(`${API_BASE}${path}`, {
    method: "PUT",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function apiDelete(path: string): Promise<void> {
  const response = await httpFetch(`${API_BASE}${path}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }
}

export async function getHealth(): Promise<HealthStatus> {
  return apiGet<HealthStatus>("/api/health");
}

export async function getHardwareProfiles(): Promise<HardwareProfile[]> {
  return apiGet<HardwareProfile[]>("/api/hardware/profiles");
}

export async function getActiveProfile(): Promise<HardwareProfile> {
  return apiGet<HardwareProfile>("/api/hardware/active");
}

export async function setActiveProfile(
  profileId: number,
): Promise<HardwareProfile> {
  return apiPost<HardwareProfile>(`/api/hardware/active/${profileId}`);
}

export interface CreateProfilePayload {
  name: string;
  os: string;
  cpu_name?: string;
  gpu_name?: string;
  ram_type?: string;
  total_ram_gb: number;
  total_vram_gb?: number;
  is_unified_memory?: boolean;
  memory_bandwidth_gbps?: number;
  vram_bandwidth_gbps?: number;
  gpu_compute_fp16_tflops?: number;
}

export async function createHardwareProfile(
  payload: CreateProfilePayload,
): Promise<HardwareProfile> {
  return apiPost<HardwareProfile>("/api/hardware/profiles", payload);
}

export async function deleteHardwareProfile(profileId: number): Promise<void> {
  await apiDelete(`/api/hardware/profiles/${profileId}`);
}

export async function getSystemSpecs(): Promise<SystemSpecs> {
  return apiGet<SystemSpecs>("/api/hardware/system");
}

export async function scanInventory(paths: string[]): Promise<ScanResult> {
  return apiPost<ScanResult>("/api/inventory/scan", { paths });
}

export async function getInventory(): Promise<LocalInventoryItem[]> {
  return apiGet<LocalInventoryItem[]>("/api/inventory");
}

export async function getInventoryPrediction(
  itemId: number,
): Promise<{ inventory_item_id: number; filename: string; prediction: TokenPrediction }> {
  return apiGet(`/api/inventory/${itemId}/prediction`);
}

export async function getLauncherInfo(itemId: number): Promise<LauncherInfo> {
  return apiGet<LauncherInfo>(`/api/inventory/${itemId}/launch`);
}

export async function setPreferredRunner(
  itemId: number,
  runner: string,
): Promise<LocalInventoryItem> {
  return apiPost<LocalInventoryItem>(`/api/inventory/${itemId}/runner`, {
    runner,
  });
}

export async function getDetectedRunners(): Promise<DetectedRunner[]> {
  const response = await apiGet<{ runners: DetectedRunner[] }>(
    "/api/runners/detected",
  );
  return response.runners;
}

export async function updateRunnerSettings(
  runnerId: string,
  settings: Partial<RunnerSettings>,
): Promise<DetectedRunner> {
  return apiPut<DetectedRunner>(`/api/runners/settings/${runnerId}`, settings);
}

export async function importToOllama(
  inventoryItemId: number,
  modelName?: string,
): Promise<{ imported: boolean; runner: string; model: string }> {
  const params = new URLSearchParams();
  if (modelName) params.set("model_name", modelName);
  return apiPost<{ imported: boolean; runner: string; model: string }>(
    `/api/runners/import-ollama/${inventoryItemId}?${params.toString()}`,
  );
}

export interface UrlDiscoveryResult {
  repo_id: string;
  family_id: string;
  files: Array<{
    filename: string;
    format: string;
    quant_method?: string;
    size_bytes: number;
    download_url: string;
    estimated_vram_mb?: number;
  }>;
}

export async function searchModels(
  query: string,
  capability?: string,
  format?: string,
  limit = 20,
  sort?: "downloads" | "trendingScore",
): Promise<DiscoverResult> {
  const params = new URLSearchParams();
  params.set("query", query);
  if (capability) params.set("capability", capability);
  if (format) params.set("format", format);
  if (sort) params.set("sort", sort);
  params.set("limit", String(limit));
  return apiGet<DiscoverResult>(`/api/discover/search?${params.toString()}`);
}

export async function discoverUrl(url: string): Promise<UrlDiscoveryResult> {
  return apiPost<UrlDiscoveryResult>("/api/discover/url", { url });
}

export async function startDownloadJob(
  url: string,
  filename: string,
  destination?: string,
  runnerTarget?: string,
  sourceFamilyId?: string,
): Promise<DownloadJob> {
  return apiPost<DownloadJob>("/api/download/jobs", {
    url,
    filename,
    destination,
    runner_target: runnerTarget,
    source_family_id: sourceFamilyId,
  });
}

export async function getDownloadJobs(): Promise<DownloadJob[]> {
  const response = await apiGet<{ jobs: DownloadJob[] }>("/api/download/jobs");
  return response.jobs;
}

export async function getDownloadJob(jobId: string): Promise<DownloadJob> {
  return apiGet<DownloadJob>(`/api/download/jobs/${jobId}`);
}

export async function cancelDownloadJob(jobId: string): Promise<DownloadJob> {
  return apiPost<DownloadJob>(`/api/download/jobs/${jobId}/cancel`);
}

export async function deleteDownloadJob(jobId: string): Promise<void> {
  await apiDelete(`/api/download/jobs/${jobId}`);
}

export async function getDownloadSettings(): Promise<DownloadSettings> {
  return apiGet<DownloadSettings>("/api/download/settings");
}

export async function updateDownloadSettings(
  bandwidthCapMbps: number | null,
): Promise<DownloadSettings> {
  return apiPut<DownloadSettings>("/api/download/settings", {
    bandwidth_cap_mbps: bandwidthCapMbps,
  });
}

export async function getSettings(): Promise<Record<string, string | null>> {
  return apiGet<Record<string, string | null>>("/api/settings");
}

export async function updateSetting(
  key: string,
  value: string | null,
): Promise<{ key: string; value: string | null }> {
  return apiPut<{ key: string; value: string | null }>(`/api/settings/${key}`, {
    value,
  });
}

export function streamChat(
  inventoryItemId: number,
  runner: string,
  prompt: string,
  onMessage: (messages: ChatMessage[]) => void,
  onError: (error: string) => void,
  onDone: () => void,
): AbortController {
  const controller = new AbortController();
  const responseContent: string[] = [];

  httpFetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({
      inventory_item_id: inventoryItemId,
      runner,
      prompt,
    }),
    signal: controller.signal,
  }).then(async (response) => {
    if (!response.ok || !response.body) {
      const text = await response.text();
      onError(text || `HTTP ${response.status}`);
      onDone();
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const data = line.replace(/^data: /, "").trim();
        if (!data) continue;
        try {
          const parsed = JSON.parse(data);
          if (parsed.chunk) {
            responseContent.push(parsed.chunk);
            onMessage([
              { role: "user", content: prompt },
              { role: "assistant", content: responseContent.join("") },
            ]);
          } else if (parsed.error) {
            onError(parsed.error);
          } else if (parsed.done) {
            onDone();
          }
        } catch {
          // Ignore malformed SSE lines.
        }
      }
    }

    onDone();
  });

  return controller;
}
