import axios from "axios";
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
} from "../types";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

export async function getHealth(): Promise<HealthStatus> {
  const response = await api.get<HealthStatus>("/api/health");
  return response.data;
}

export async function getHardwareProfiles(): Promise<HardwareProfile[]> {
  const response = await api.get<HardwareProfile[]>("/api/hardware/profiles");
  return response.data;
}

export async function getActiveProfile(): Promise<HardwareProfile> {
  const response = await api.get<HardwareProfile>("/api/hardware/active");
  return response.data;
}

export async function setActiveProfile(
  profileId: number,
): Promise<HardwareProfile> {
  const response = await api.post<HardwareProfile>(
    `/api/hardware/active/${profileId}`,
  );
  return response.data;
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
}


export async function createHardwareProfile(
  payload: CreateProfilePayload,
): Promise<HardwareProfile> {
  const response = await api.post<HardwareProfile>(
    "/api/hardware/profiles",
    payload,
  );
  return response.data;
}


export async function deleteHardwareProfile(profileId: number): Promise<void> {
  await api.delete(`/api/hardware/profiles/${profileId}`);
}


export async function getSystemSpecs(): Promise<SystemSpecs> {
  const response = await api.get<SystemSpecs>("/api/hardware/system");
  return response.data;
}

export async function scanInventory(paths: string[]): Promise<ScanResult> {
  const response = await api.post<ScanResult>("/api/inventory/scan", {
    paths,
  });
  return response.data;
}

export async function getInventory(): Promise<LocalInventoryItem[]> {
  const response = await api.get<LocalInventoryItem[]>("/api/inventory");
  return response.data;
}

export async function getLauncherInfo(itemId: number): Promise<LauncherInfo> {
  const response = await api.get<LauncherInfo>(
    `/api/inventory/${itemId}/launch`,
  );
  return response.data;
}

export async function setPreferredRunner(
  itemId: number,
  runner: string,
): Promise<LocalInventoryItem> {
  const response = await api.post<LocalInventoryItem>(
    `/api/inventory/${itemId}/runner`,
    { runner },
  );
  return response.data;
}

export async function getDetectedRunners(): Promise<DetectedRunner[]> {
  const response = await api.get<{ runners: DetectedRunner[] }>("/api/runners/detected");
  return response.data.runners;
}

export async function updateRunnerSettings(
  runnerId: string,
  settings: Partial<RunnerSettings>,
): Promise<DetectedRunner> {
  const response = await api.put<DetectedRunner>(
    `/api/runners/settings/${runnerId}`,
    settings,
  );
  return response.data;
}

export async function importToOllama(
  inventoryItemId: number,
  modelName?: string,
): Promise<{ imported: boolean; runner: string; model: string }> {
  const params = new URLSearchParams();
  if (modelName) params.set("model_name", modelName);
  const response = await api.post<{ imported: boolean; runner: string; model: string }>(
    `/api/runners/import-ollama/${inventoryItemId}?${params.toString()}`,
  );
  return response.data;
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
  const response = await api.get<DiscoverResult>(
    `/api/discover/search?${params.toString()}`,
  );
  return response.data;
}

export async function startDownloadJob(
  url: string,
  filename: string,
  destination?: string,
  runnerTarget?: string,
  sourceFamilyId?: string,
): Promise<DownloadJob> {
  const response = await api.post<DownloadJob>("/api/download/jobs", {
    url,
    filename,
    destination,
    runner_target: runnerTarget,
    source_family_id: sourceFamilyId,
  });
  return response.data;
}

export async function getDownloadJobs(): Promise<DownloadJob[]> {
  const response = await api.get<{ jobs: DownloadJob[] }>("/api/download/jobs");
  return response.data.jobs;
}

export async function getDownloadJob(jobId: string): Promise<DownloadJob> {
  const response = await api.get<DownloadJob>(`/api/download/jobs/${jobId}`);
  return response.data;
}

export async function cancelDownloadJob(jobId: string): Promise<DownloadJob> {
  const response = await api.post<DownloadJob>(`/api/download/jobs/${jobId}/cancel`);
  return response.data;
}

export async function deleteDownloadJob(jobId: string): Promise<void> {
  await api.delete(`/api/download/jobs/${jobId}`);
}


export async function getDownloadSettings(): Promise<DownloadSettings> {
  const response = await api.get<DownloadSettings>("/api/download/settings");
  return response.data;
}


export async function updateDownloadSettings(
  bandwidthCapMbps: number | null,
): Promise<DownloadSettings> {
  const response = await api.put<DownloadSettings>("/api/download/settings", {
    bandwidth_cap_mbps: bandwidthCapMbps,
  });
  return response.data;
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

  fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
