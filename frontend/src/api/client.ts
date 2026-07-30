import axios from "axios";
import type {
  DiscoverResult,
  DownloadResult,
  HardwareProfile,
  HealthStatus,
  LauncherInfo,
  LocalInventoryItem,
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

export async function searchModels(
  query: string,
  capability?: string,
  limit = 20,
  sort?: "downloads" | "trendingScore",
): Promise<DiscoverResult> {
  const params = new URLSearchParams();
  params.set("query", query);
  if (capability) params.set("capability", capability);
  if (sort) params.set("sort", sort);
  params.set("limit", String(limit));
  const response = await api.get<DiscoverResult>(
    `/api/discover/search?${params.toString()}`,
  );
  return response.data;
}

export async function downloadModelFile(
  url: string,
  filename: string,
): Promise<DownloadResult> {
  const response = await api.post<DownloadResult>("/api/download", {
    url,
    filename,
  });
  return response.data;
}
