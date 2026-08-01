import { useEffect, useState } from "react";
import { getSettings, updateSetting } from "../api/client";
import { Save, Settings2, Moon, FolderOpen, Key, Terminal } from "lucide-react";

type SettingKey =
  | "download_dir"
  | "ollama_path"
  | "lm_studio_path"
  | "huggingface_token"
  | "theme";

interface SettingField {
  key: SettingKey;
  label: string;
  description: string;
  type: "text" | "password" | "select";
  icon: typeof FolderOpen;
  options?: { value: string; label: string }[];
}

const FIELDS: SettingField[] = [
  {
    key: "download_dir",
    label: "Default download folder",
    description: "Folder where downloaded model files are saved by default.",
    type: "text",
    icon: FolderOpen,
  },
  {
    key: "ollama_path",
    label: "Ollama executable or endpoint",
    description: "Path to the ollama binary, e.g. /usr/local/bin/ollama.",
    type: "text",
    icon: Terminal,
  },
  {
    key: "lm_studio_path",
    label: "LM Studio models folder",
    description: "Folder where LM Studio stores its models.",
    type: "text",
    icon: FolderOpen,
  },
  {
    key: "huggingface_token",
    label: "Hugging Face token",
    description: "Optional access token for higher Hugging Face rate limits.",
    type: "password",
    icon: Key,
  },
  {
    key: "theme",
    label: "Theme",
    description: "Choose the app colour scheme.",
    type: "select",
    icon: Moon,
    options: [
      { value: "dark", label: "Dark" },
      { value: "light", label: "Light" },
      { value: "system", label: "System" },
    ],
  },
];

export default function Settings() {
  const [values, setValues] = useState<Record<string, string | undefined>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSettings()
      .then((data) => {
        const next: Record<string, string | undefined> = {};
        for (const field of FIELDS) {
          next[field.key] = data[field.key] ?? "";
        }
        setValues(next);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(key: SettingKey, value: string | undefined) {
    setSaving((prev) => ({ ...prev, [key]: true }));
    setSaved((prev) => ({ ...prev, [key]: false }));
    try {
      await updateSetting(key, value || null);
      setSaved((prev) => ({ ...prev, [key]: true }));
      setTimeout(() => setSaved((prev) => ({ ...prev, [key]: false })), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save setting");
    } finally {
      setSaving((prev) => ({ ...prev, [key]: false }));
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400">
        Loading settings…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-8 text-gray-100">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 flex items-center gap-3">
          <Settings2 className="h-7 w-7 text-blue-400" />
          <div>
            <h1 className="text-2xl font-bold">Settings</h1>
            <p className="text-sm text-gray-400">Configure downloads, runners, and app preferences.</p>
          </div>
        </header>

        {error && (
          <div className="mb-6 rounded-lg border border-red-700 bg-red-900/30 p-4 text-red-200">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {FIELDS.map((field) => {
            const Icon = field.icon;
            const value = values[field.key] ?? "";
            return (
              <div
                key={field.key}
                className="rounded-xl border border-gray-800 bg-gray-800/50 p-5"
              >
                <div className="mb-3 flex items-center gap-2">
                  <Icon className="h-4 w-4 text-gray-400" />
                  <label
                    htmlFor={field.key}
                    className="text-sm font-medium text-white"
                  >
                    {field.label}
                  </label>
                </div>
                <p className="mb-3 text-xs text-gray-400">{field.description}</p>

                {field.type === "select" ? (
                  <select
                    id={field.key}
                    value={value}
                    onChange={(e) => {
                      const next = e.target.value;
                      setValues((prev) => ({ ...prev, [field.key]: next }));
                      handleSave(field.key, next);
                    }}
                    className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                  >
                    {field.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="flex gap-2">
                    <input
                      id={field.key}
                      type={field.type}
                      value={value}
                      placeholder={field.type === "password" ? "••••••••" : undefined}
                      onChange={(e) =>
                        setValues((prev) => ({
                          ...prev,
                          [field.key]: e.target.value,
                        }))
                      }
                      className="min-w-0 flex-1 rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-blue-500 focus:outline-none"
                    />
                    <button
                      onClick={() => handleSave(field.key, value)}
                      disabled={saving[field.key]}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${
                        saved[field.key]
                          ? "bg-green-600 text-white"
                          : "bg-blue-600 text-white hover:bg-blue-500"
                      } disabled:opacity-50`}
                    >
                      {saving[field.key] ? (
                        "Saving…"
                      ) : saved[field.key] ? (
                        "Saved"
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          Save
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
