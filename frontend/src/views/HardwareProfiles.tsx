import { useEffect, useState } from "react";
import {
  getActiveProfile,
  getHardwareProfiles,
  getSystemSpecs,
  setActiveProfile,
} from "../api/client";
import type { HardwareProfile, SystemSpecs } from "../types";
import {
  Check,
  Cpu,
  HardDrive,
  Monitor,
  Settings,
} from "lucide-react";

export default function HardwareProfiles() {
  const [profiles, setProfiles] = useState<HardwareProfile[]>([]);
  const [active, setActive] = useState<HardwareProfile | null>(null);
  const [specs, setSpecs] = useState<SystemSpecs | null>(null);
  const [loading, setLoading] = useState(true);
  const [switchingId, setSwitchingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to switch profile");
    } finally {
      setSwitchingId(null);
    }
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
          Select the profile that matches the machine you want to evaluate models
          against.
        </p>
      </header>

      {error && (
        <div className="mb-6 rounded-lg bg-red-900/30 p-4 text-red-200">{error}</div>
      )}

      <main className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-semibold mb-2">Saved Profiles</h2>
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
                  </div>
                  {profile.is_active && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-900/40 px-3 py-1 text-sm font-medium text-blue-300">
                      <Check className="w-4 h-4" /> Active
                    </span>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  <div className="rounded-lg bg-gray-900/50 p-3">
                    <p className="text-gray-400">System RAM</p>
                    <p className="text-lg font-semibold">
                      {profile.total_ram_gb} GB
                    </p>
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
                  </div>
                </div>

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
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}
