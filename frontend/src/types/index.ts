export interface HealthStatus {
  status: "ok" | "error";
  service: string;
  version: string;
}

export interface HardwareProfile {
  id: number;
  name: string;
  is_active: boolean;
  os: string;
  cpu_name: string | null;
  gpu_name: string | null;
  ram_type: string | null;
  total_ram_gb: number;
  total_vram_gb: number;
  is_unified_memory: boolean;
  created_at: string;
}

export interface SystemSpecs {
  os: string;
  cpu_name: string;
  total_ram_gb: number;
  total_vram_gb: number;
  gpu_name: string | null;
  is_unified_memory: boolean;
  detected: boolean;
}

export interface LocalInventoryItem {
  id: number;
  family_id: string | null;
  local_path: string;
  filename: string;
  detected_format: string;
  detected_capability: string | null;
  size_bytes: number;
  added_at: string;
}

export interface ScanResult {
  scanned: number;
  discovered: number;
  inserted: number;
  errors: string[];
}

export interface CompatibilityScore {
  status: "green" | "yellow" | "red";
  label: string;
  required_memory_gb: number;
  available_memory_gb: number;
}

export interface ModelFile {
  filename: string;
  format: string;
  quant_method: string | null;
  size_bytes: number;
  download_url: string;
  estimated_vram_mb: number | null;
  compatibility: CompatibilityScore;
}

export interface ModelFamily {
  id: string;
  name: string;
  author: string;
  architecture: string | null;
  params_billions: number | null;
  context_length: number | null;
  capabilities: string;
  description?: string | null;
  downloads: number;
  likes: number;
  created_at: string | null;
  files: ModelFile[];
}

export interface DiscoverResult {
  query: string;
  capability: string | null;
  format: string | null;
  sort?: "downloads" | "trendingScore";
  count: number;
  active_profile: Pick<
    HardwareProfile,
    "id" | "name" | "total_ram_gb" | "total_vram_gb" | "is_unified_memory"
  >;
  families: ModelFamily[];
}

export interface DownloadResult {
  url: string;
  local_path: string;
  filename: string;
  size_bytes: number;
  resumed: boolean;
  total_bytes: number | null;
}

export interface RunnerOption {
  id: string;
  name: string;
  runner: string;
  runner_name: string;
  local_path: string;
  command: string;
}

export interface LauncherInfo {
  local_path: string;
  filename: string;
  runners: RunnerOption[];
}
