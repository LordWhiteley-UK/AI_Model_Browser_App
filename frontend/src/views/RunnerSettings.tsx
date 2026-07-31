import { useEffect, useState } from "react";
import {
  getDetectedRunners,
  updateRunnerSettings,
} from "../api/client";
import type { DetectedRunner } from "../types";
import {
  AlertCircle,
  Check,
  FolderOpen,
  Save,
  Settings,
  Terminal,
  Wrench,
} from "lucide-react";

const RUNNER_DESCRIPTIONS: Record<string, string> = {
  ollama: "Ollama imports GGUF files into its content-addressable model store via a Modelfile.",
  lm_studio:
    "LM Studio uses a plain folder of publisher/repo/filename.gguf files. Downloads can be placed there automatically.",
  llama_cpp:
    "llama.cpp takes a direct file path, so any shared folder works with zero integration.",
};

export default function RunnerSettings() {
  const [runners, setRunners] = useState<DetectedRunner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { binary_path: string; model_path: string }>>({});

  async function loadRunners() {
    try {
      setError(null);
      const data = await getDetectedRunners();
      setRunners(data);
      const initialDrafts: Record<string, { binary_path: string; model_path: string }> = {};
      for (const r of data) {
        initialDrafts[r.id] = {
          binary_path: r.binary_path || "",
          model_path: r.default_model_path || "",
        };
      }
      setDrafts(initialDrafts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load runners");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRunners();
  }, []);

  function updateDraft(
    runnerId: string,
    field: "binary_path" | "model_path",
    value: string,
  ) {
    setDrafts((prev) => ({
      ...prev,
      [runnerId]: { ...prev[runnerId], [field]: value },
    }));
  }

  async function handleSave(runnerId: string) {
    setSuccess(null);
    setError(null);
    try {
      const draft = drafts[runnerId];
      await updateRunnerSettings(runnerId, {
        binary_path: draft.binary_path || null,
        model_path: draft.model_path || null,
      });
      setSuccess(`Saved ${runnerId} settings`);
      setTimeout(() => setSuccess(null), 3000);
      await loadRunners();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Settings className="w-8 h-8 text-blue-400" />
          Runner Settings
        </h1>
        <p className="text-gray-400 mt-1">
          Detect installed model runners and configure where each one stores its
          models.
        </p>
      </header>

      {error && (
        <div className="mb-6 flex items-start gap-2 rounded-lg bg-red-900/30 p-3 text-red-200">
          <AlertCircle className="mt-0.5 w-4 h-4" />
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 flex items-start gap-2 rounded-lg bg-green-900/30 p-3 text-green-200">
          <Check className="mt-0.5 w-4 h-4" />
          {success}
        </div>
      )}

      {loading ? (
        <p className="text-gray-400">Scanning for installed runners...</p>
      ) : (
        <div className="space-y-4">
          {runners.map((runner) => (
            <div
              key={runner.id}
              className="rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-sm"
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Wrench className="w-6 h-6 text-purple-400" />
                  <div>
                    <h2 className="text-lg font-semibold">{runner.name}</h2>
                    <p className="text-sm text-gray-400">
                      {RUNNER_DESCRIPTIONS[runner.id] || ""}
                    </p>
                  </div>
                </div>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                    runner.detected
                      ? "bg-green-900/40 text-green-300"
                      : "bg-gray-700 text-gray-300"
                  }`}
                >
                  {runner.detected ? (
                    <>
                      <Check className="w-3 h-3" /> Detected
                    </>
                  ) : (
                    "Not detected"
                  )}
                </span>
              </div>

              {runner.version && (
                <p className="mb-4 text-sm text-gray-400">
                  Version: <span className="text-white">{runner.version}</span>
                </p>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-300">
                    <Terminal className="inline w-4 h-4 mr-1" />
                    Binary path
                  </label>
                  <input
                    type="text"
                    value={drafts[runner.id]?.binary_path || ""}
                    onChange={(e) =>
                      updateDraft(runner.id, "binary_path", e.target.value)
                    }
                    placeholder={runner.detected ? runner.binary_path || "" : "/path/to/binary"}
                    className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-blue-500 focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Override the detected binary path, or set one manually.
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-300">
                    <FolderOpen className="inline w-4 h-4 mr-1" />
                    Model folder
                  </label>
                  <input
                    type="text"
                    value={drafts[runner.id]?.model_path || ""}
                    onChange={(e) =>
                      updateDraft(runner.id, "model_path", e.target.value)
                    }
                    placeholder={
                      runner.default_model_path || "/path/to/models"
                    }
                    className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-blue-500 focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Where downloaded models should be placed for this runner.
                  </p>
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => handleSave(runner.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
                >
                  <Save className="w-4 h-4" />
                  Save
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
