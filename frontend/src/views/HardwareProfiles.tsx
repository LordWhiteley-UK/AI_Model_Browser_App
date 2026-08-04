import { useEffect, useMemo, useState } from "react";
import {
  createHardwareProfile,
  deleteHardwareProfile,
  getActiveProfile,
  getHardwareProfiles,
  getSystemSpecs,
  setActiveProfile,
} from "../api/client";
import type { CreateProfilePayload } from "../api/client";
import type { HardwareProfile, SystemSpecs } from "../types";
import {
  Check,
  Cpu,
  HardDrive,
  Monitor,
  Plus,
  Settings,
  Trash2,
} from "lucide-react";

const OS_OPTIONS = ["macOS", "Windows 11", "Windows 10", "Linux"];

const CPU_OPTIONS = [
  "Apple M1",
  "Apple M1 Pro",
  "Apple M1 Max",
  "Apple M2",
  "Apple M2 Pro",
  "Apple M2 Max",
  "Apple M3",
  "Apple M3 Pro",
  "Apple M3 Max",
  "Apple M4",
  "Apple M4 Pro",
  "Apple M4 Max",
  "Intel Core i5-13600K",
  "Intel Core i7-14700K",
  "Intel Core i9-14900K",
  "AMD Ryzen 5 7600X",
  "AMD Ryzen 7 7800X3D",
  "AMD Ryzen 9 7950X",
  "AMD Ryzen 9 9950X",
  "Other",
];

const GPU_OPTIONS = [
  "None / Integrated",
  "Apple GPU",
  "NVIDIA RTX 3060 (12 GB)",
  "NVIDIA RTX 4060 (8 GB)",
  "NVIDIA RTX 4070 (12 GB)",
  "NVIDIA RTX 4080 (16 GB)",
  "NVIDIA RTX 4090 (24 GB)",
  "NVIDIA RTX 5070 (12 GB)",
  "NVIDIA RTX 5080 (16 GB)",
  "NVIDIA RTX 5090 (24 GB)",
  "AMD RX 7900 XT (20 GB)",
  "AMD RX 7900 XTX (24 GB)",
  "Other",
];

const RAM_OPTIONS = ["DDR4", "DDR5", "LPDDR5", "LPDDR5X", "HBM", "Unified"];

export default function HardwareProfiles() {
  const [profiles, setProfiles] = useState<HardwareProfile[]>([]);
  const [active, setActive] = useState<HardwareProfile | null>(null);
  const [specs, setSpecs] = useState<SystemSpecs | null>(null);
  const [loading, setLoading] = useState(true);
  const [switchingId, setSwitchingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState<CreateProfilePayload>({
    name: "",
    os: "Windows 11",
    cpu_name: CPU_OPTIONS[0],
    gpu_name: GPU_OPTIONS[1],
    ram_type: RAM_OPTIONS[1],
    total_ram_gb: 32,
    total_vram_gb: 8,
    is_unified_memory: false,
    memory_bandwidth_gbps: undefined,
    vram_bandwidth_gbps: undefined,
    gpu_compute_fp16_tflops: undefined,
  });
  const [cpuOther, setCpuOther] = useState("");
  const [gpuOther, setGpuOther] = useState("");

  async function refresh() {
    try {
      setError(null);
      const [profileList, current, detected] = await Promise.all([
        getHardwareProfiles(),
        getActiveProfile(),
        getSystemSpecs(),
      ]);
      setProfiles(profileList);
      setActive(current);
      setSpecs(detected);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profiles");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleActivate(profileId: number) {
    setSwitchingId(profileId);
    try {
      const updated = await setActiveProfile(profileId);
      setActive(updated);
      setProfiles((prev) =>
        prev.map((p) => ({ ...p, is_active: p.id === profileId })),
      );
      setSuccess("Active profile switched.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to switch profile");
    } finally {
      setSwitchingId(null);
    }
  }

  async function handleDelete(profileId: number) {
    setDeletingId(profileId);
    try {
      await deleteHardwareProfile(profileId);
      setProfiles((prev) => prev.filter((p) => p.id !== profileId));
      setSuccess("Profile deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete profile");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const cpu = form.cpu_name === "Other" ? cpuOther : form.cpu_name;
    const gpu = form.gpu_name === "Other" ? gpuOther : form.gpu_name;
    if (!cpu || !gpu) {
      setError("Please enter a CPU and GPU name.");
      return;
    }

    try {
      const created = await createHardwareProfile({
        ...form,
        cpu_name: cpu,
        gpu_name: gpu,
      });
      setProfiles((prev) => [...prev, created]);
      setShowForm(false);
      setSuccess(`Profile "${created.name}" created.`);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create profile");
    }
  }

  function resetForm() {
    setForm({
      name: "",
      os: "Windows 11",
      cpu_name: CPU_OPTIONS[0],
      gpu_name: GPU_OPTIONS[1],
      ram_type: RAM_OPTIONS[1],
      total_ram_gb: 32,
      total_vram_gb: 8,
      is_unified_memory: false,
      memory_bandwidth_gbps: undefined,
      vram_bandwidth_gbps: undefined,
      gpu_compute_fp16_tflops: undefined,
    });
    setCpuOther("");
    setGpuOther("");
  }

  const gpuVramHint = useMemo(() => {
    const match = form.gpu_name?.match(/\((\d+)\s*GB\)/);
    return match ? Number(match[1]) : undefined;
  }, [form.gpu_name]);

  function updateForm<K extends keyof CreateProfilePayload>(
    key: K,
    value: CreateProfilePayload[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  if (loading) {
    return (
      <div className="p-8 text-gray-400">Loading hardware profiles...</div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Settings className="w-8 h-8 text-blue-400" />
          Hardware Profiles
        </h1>
        <p className="text-gray-400 mt-1">
          Select, create, or delete profiles that match the machines you want to
          evaluate models against.
        </p>
      </header>

      {error && (
        <div className="mb-6 rounded-lg bg-red-900/30 p-4 text-red-200">{error}</div>
      )}
      {success && (
        <div className="mb-6 rounded-lg bg-green-900/30 p-4 text-green-200">
          {success}
        </div>
      )}

      <main className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Saved Profiles</h2>
            <button
              onClick={() => setShowForm((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
            >
              <Plus className="w-4 h-4" />
              {showForm ? "Cancel" : "Add Profile"}
            </button>
          </div>

          {showForm && (
            <form
              onSubmit={handleCreate}
              className="rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-sm space-y-4"
            >
              <h3 className="text-lg font-semibold">Create New Profile</h3>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-gray-400">
                    Profile name
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => updateForm("name", e.target.value)}
                    placeholder="e.g. My Gaming PC"
                    className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm text-gray-400">OS</label>
                  <select
                    value={form.os}
                    onChange={(e) => updateForm("os", e.target.value)}
                    className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                  >
                    {OS_OPTIONS.map((os) => (
                      <option key={os} value={os}>
                        {os}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm text-gray-400">CPU</label>
                  <select
                    value={form.cpu_name}
                    onChange={(e) => updateForm("cpu_name", e.target.value)}
                    className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                  >
                    {CPU_OPTIONS.map((cpu) => (
                      <option key={cpu} value={cpu}>
                        {cpu}
                      </option>
                    ))}
                  </select>
                  {form.cpu_name === "Other" && (
                    <input
                      type="text"
                      value={cpuOther}
                      onChange={(e) => setCpuOther(e.target.value)}
                      placeholder="Enter CPU name"
                      className="mt-2 w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                    />
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-sm text-gray-400">GPU</label>
                  <select
                    value={form.gpu_name}
                    onChange={(e) => {
                      updateForm("gpu_name", e.target.value);
                      const vram = e.target.value.match(/\((\d+)\s*GB\)/);
                      if (vram) {
                        updateForm("total_vram_gb", Number(vram[1]));
                      }
                    }}
                    className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                  >
                    {GPU_OPTIONS.map((gpu) => (
                      <option key={gpu} value={gpu}>
                        {gpu}
                      </option>
                    ))}
                  </select>
                  {form.gpu_name === "Other" && (
                    <input
                      type="text"
                      value={gpuOther}
                      onChange={(e) => setGpuOther(e.target.value)}
                      placeholder="Enter GPU name"
                      className="mt-2 w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                    />
                  )}
                  {gpuVramHint && gpuVramHint !== form.total_vram_gb && (
                    <p className="mt-1 text-xs text-gray-500">
                      Suggested VRAM: {gpuVramHint} GB
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-sm text-gray-400">
                    RAM type
                  </label>
                  <select
                    value={form.ram_type}
                    onChange={(e) => updateForm("ram_type", e.target.value)}
                    className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                  >
                    {RAM_OPTIONS.map((ram) => (
                      <option key={ram} value={ram}>
                        {ram}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm text-gray-400">
                    RAM (GB)
                  </label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    required
                    value={form.total_ram_gb}
                    onChange={(e) =>
                      updateForm("total_ram_gb", Number(e.target.value))
                    }
                    className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm text-gray-400">
                    VRAM (GB)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    required
                    disabled={form.is_unified_memory}
                    value={form.total_vram_gb}
                    onChange={(e) =>
                      updateForm("total_vram_gb", Number(e.target.value))
                    }
                    className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none disabled:opacity-50"
                  />
                </div>

                <div className="flex items-center gap-2 md:col-span-2">
                  <input
                    id="unified"
                    type="checkbox"
                    checked={form.is_unified_memory}
                    onChange={(e) => {
                      updateForm("is_unified_memory", e.target.checked);
                      if (e.target.checked) {
                        updateForm("total_vram_gb", 0);
                      }
                    }}
                    className="h-4 w-4 rounded border-gray-600 bg-gray-900 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="unified" className="text-sm text-gray-300">
                    Unified memory (Apple Silicon / shared memory)
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-gray-600 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
                >
                  Create Profile
                </button>
              </div>
            </form>
          )}

          {profiles.length === 0 ? (
            <p className="text-gray-400">No hardware profiles found.</p>
          ) : (
            profiles.map((profile) => (
              <div
                key={profile.id}
                className={`rounded-xl border p-6 shadow-sm transition-colors ${
                  profile.is_active
                    ? "border-blue-500 bg-gray-800"
                    : "border-gray-700 bg-gray-800/60 hover:bg-gray-800"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">{profile.name}</h3>
                    <p className="text-sm text-gray-400 mt-1">
                      {profile.os} ·{" "}
                      {profile.is_unified_memory
                        ? "Unified Memory"
                        : "Discrete GPU + System RAM"}
                    </p>
                    {(profile.cpu_name || profile.gpu_name || profile.ram_type) && (
                      <p className="text-sm text-gray-500 mt-1">
                        {[profile.cpu_name, profile.gpu_name, profile.ram_type]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {profile.is_active && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-900/40 px-3 py-1 text-sm font-medium text-blue-300">
                        <Check className="w-4 h-4" /> Active
                      </span>
                    )}
                    {!profile.is_active && (
                      <button
                        onClick={() => handleDelete(profile.id)}
                        disabled={deletingId === profile.id}
                        className="rounded-lg border border-gray-600 p-2 text-gray-400 hover:bg-red-900/30 hover:text-red-300 hover:border-red-700 disabled:opacity-50"
                        title="Delete profile"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  <div className="rounded-lg bg-gray-900/50 p-3">
                    <p className="text-gray-400">System RAM</p>
                    <p className="text-lg font-semibold">
                      {profile.total_ram_gb} GB
                    </p>
                    {profile.ram_type && (
                      <p className="text-xs text-gray-500">{profile.ram_type}</p>
                    )}
                  </div>
                  <div className="rounded-lg bg-gray-900/50 p-3">
                    <p className="text-gray-400">
                      {profile.is_unified_memory ? "GPU Shared RAM" : "VRAM"}
                    </p>
                    <p className="text-lg font-semibold">
                      {profile.total_vram_gb > 0
                        ? `${profile.total_vram_gb} GB`
                        : "Shared"}
                    </p>
                    {profile.gpu_name && !profile.is_unified_memory && (
                      <p className="text-xs text-gray-500">{profile.gpu_name}</p>
                    )}
                  </div>
                </div>

                {(profile.memory_bandwidth_gbps ||
                  profile.vram_bandwidth_gbps ||
                  profile.gpu_compute_fp16_tflops) && (
                  <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                    {profile.memory_bandwidth_gbps && (
                      <div className="rounded bg-gray-900/30 p-2">
                        <span className="text-gray-500">Memory BW</span>
                        <br />
                        <span className="font-medium">{profile.memory_bandwidth_gbps} GB/s</span>
                      </div>
                    )}
                    {profile.vram_bandwidth_gbps && (
                      <div className="rounded bg-gray-900/30 p-2">
                        <span className="text-gray-500">VRAM BW</span>
                        <br />
                        <span className="font-medium">{profile.vram_bandwidth_gbps} GB/s</span>
                      </div>
                    )}
                    {profile.gpu_compute_fp16_tflops && (
                      <div className="rounded bg-gray-900/30 p-2">
                        <span className="text-gray-500">FP16 Compute</span>
                        <br />
                        <span className="font-medium">{profile.gpu_compute_fp16_tflops} TFLOPS</span>
                      </div>
                    )}
                  </div>
                )}

                {!profile.is_active && (
                  <button
                    onClick={() => handleActivate(profile.id)}
                    disabled={switchingId === profile.id}
                    className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                  >
                    {switchingId === profile.id
                      ? "Activating..."
                      : "Activate Profile"}
                  </button>
                )}
              </div>
            ))
          )}
        </section>

        <aside className="space-y-4">
          <div className="rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-sm">
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <Monitor className="w-5 h-5 text-green-400" />
              Detected System
            </h2>
            {specs ? (
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 flex items-center gap-2">
                    <Cpu className="w-4 h-4" /> OS
                  </span>
                  <span className="font-medium">{specs.os}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 flex items-center gap-2">
                    <Cpu className="w-4 h-4" /> CPU
                  </span>
                  <span className="font-medium text-right">{specs.cpu_name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 flex items-center gap-2">
                    <HardDrive className="w-4 h-4" /> RAM
                  </span>
                  <span className="font-medium">{specs.total_ram_gb} GB</span>
                </div>
                {specs.gpu_name && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 flex items-center gap-2">
                      <Monitor className="w-4 h-4" /> GPU
                    </span>
                    <span className="font-medium text-right">{specs.gpu_name}</span>
                  </div>
                )}
                {!specs.is_unified_memory && specs.total_vram_gb > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 flex items-center gap-2">
                      <HardDrive className="w-4 h-4" /> VRAM
                    </span>
                    <span className="font-medium">{specs.total_vram_gb} GB</span>
                  </div>
                )}
                {(specs.memory_bandwidth_gbps ||
                  specs.vram_bandwidth_gbps ||
                  specs.gpu_compute_fp16_tflops) && (
                  <div className="mt-3 rounded-lg bg-gray-900/50 p-3 text-xs space-y-1">
                    <p className="text-gray-400 font-medium">Estimated throughput specs</p>
                    {specs.memory_bandwidth_gbps && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Memory bandwidth</span>
                        <span>{specs.memory_bandwidth_gbps} GB/s</span>
                      </div>
                    )}
                    {specs.vram_bandwidth_gbps && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">VRAM bandwidth</span>
                        <span>{specs.vram_bandwidth_gbps} GB/s</span>
                      </div>
                    )}
                    {specs.gpu_compute_fp16_tflops && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">FP16 compute</span>
                        <span>{specs.gpu_compute_fp16_tflops} TFLOPS</span>
                      </div>
                    )}
                  </div>
                )}
                <div className="mt-4 rounded-lg bg-gray-900/50 p-3 text-xs text-gray-400">
                  {specs.is_unified_memory
                    ? "Unified memory architecture detected."
                    : "Discrete GPU + system RAM detected."}
                </div>
              </div>
            ) : (
              <p className="text-gray-400">System specs unavailable.</p>
            )}
          </div>

          {active && (
            <div className="rounded-xl border border-blue-500/50 bg-blue-900/20 p-6 shadow-sm">
              <h2 className="text-lg font-semibold mb-2">Active Profile</h2>
              <p className="font-medium">{active.name}</p>
              <p className="text-sm text-gray-400 mt-1">
                {active.total_ram_gb} GB RAM
                {active.total_vram_gb > 0
                  ? ` · ${active.total_vram_gb} GB VRAM`
                  : " · Unified"}
              </p>
              {(active.memory_bandwidth_gbps ||
                active.vram_bandwidth_gbps ||
                active.gpu_compute_fp16_tflops) && (
                <p className="text-xs text-gray-500 mt-2">
                  {active.vram_bandwidth_gbps
                    ? `${active.vram_bandwidth_gbps} GB/s VRAM`
                    : active.memory_bandwidth_gbps
                      ? `${active.memory_bandwidth_gbps} GB/s memory`
                      : ""}
                  {active.gpu_compute_fp16_tflops
                    ? ` · ${active.gpu_compute_fp16_tflops} TFLOPS`
                    : ""}
                </p>
              )}
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}
