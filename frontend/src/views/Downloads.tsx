import { useEffect, useState } from "react";
import {
  cancelDownloadJob,
  deleteDownloadJob,
  getDownloadJobs,
} from "../api/client";
import type { DownloadJob } from "../types";
import {
  AlertCircle,
  Check,
  Clock,
  Download,
  ExternalLink,
  FolderOpen,
  Loader2,
  Pause,
  Trash2,
  X,
} from "lucide-react";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(2)} ${units[i]}`;
}

function formatSpeed(bps: number | null): string | null {
  if (!bps) return null;
  return `${formatBytes(bps)}/s`;
}

function statusBadge(status: DownloadJob["status"]) {
  const styles: Record<string, string> = {
    pending: "bg-gray-700 text-gray-300",
    queued: "bg-gray-700 text-gray-300",
    running: "bg-blue-900/40 text-blue-300",
    completed: "bg-green-900/40 text-green-300",
    failed: "bg-red-900/40 text-red-300",
    cancelled: "bg-yellow-900/40 text-yellow-300",
  };

  const icons: Record<string, React.ReactNode> = {
    pending: <Clock className="w-3 h-3" />,
    queued: <Clock className="w-3 h-3" />,
    running: <Loader2 className="w-3 h-3 animate-spin" />,
    completed: <Check className="w-3 h-3" />,
    failed: <AlertCircle className="w-3 h-3" />,
    cancelled: <Pause className="w-3 h-3" />,
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {icons[status]}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function Downloads() {
  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadJobs() {
    try {
      const data = await getDownloadJobs();
      setJobs(data.sort((a, b) => b.created_at - a.created_at));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load downloads");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadJobs();
    const interval = setInterval(loadJobs, 1000);
    return () => clearInterval(interval);
  }, []);

  async function handleCancel(jobId: string) {
    try {
      await cancelDownloadJob(jobId);
      await loadJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel download");
    }
  }

  async function clearCompleted() {
    const completed = jobs.filter((j) => j.status === "completed");
    try {
      await Promise.all(completed.map((j) => deleteDownloadJob(j.id)));
      await loadJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear completed downloads");
    }
  }

  const completedCount = jobs.filter((j) => j.status === "completed").length;
  const activeCount = jobs.filter((j) =>
    ["pending", "queued", "running"].includes(j.status),
  ).length;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Download className="w-8 h-8 text-blue-400" />
          Downloads
        </h1>
        <p className="text-gray-400 mt-1">
          Track queued and active model downloads.
        </p>
      </header>

      <section className="mb-6 rounded-xl border border-gray-700 bg-gray-800 p-4 shadow-sm flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-400">Active:</span>
          <span className="font-medium text-white">{activeCount}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-400">Completed:</span>
          <span className="font-medium text-green-400">{completedCount}</span>
        </div>
        {completedCount > 0 && (
          <button
            onClick={clearCompleted}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-gray-600 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
          >
            <Trash2 className="w-4 h-4" />
            Clear completed
          </button>
        )}
      </section>

      {error && (
        <div className="mb-6 flex items-start gap-2 rounded-lg bg-red-900/30 p-3 text-red-200">
          <AlertCircle className="mt-0.5 w-4 h-4" />
          {error}
        </div>
      )}

      <section className="rounded-xl border border-gray-700 bg-gray-800 shadow-sm overflow-hidden">
        {loading && jobs.length === 0 ? (
          <div className="flex items-center justify-center p-12 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            Loading downloads...
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-gray-400">
            <Download className="mb-3 w-10 h-10 text-gray-600" />
            <p>No downloads yet.</p>
            <p className="text-sm text-gray-500">
              Queue a model file from the Discover page.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {jobs.map((job) => (
              <div key={job.id} className="p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{job.filename}</p>
                      {statusBadge(job.status)}
                    </div>
                    <p className="mt-1 text-xs text-gray-500 truncate">
                      {job.url}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-400">
                      <span>
                        {formatBytes(job.progress_bytes)}
                        {job.total_bytes ? ` / ${formatBytes(job.total_bytes)}` : ""}
                      </span>
                      {job.speed_bps && (
                        <span>{formatSpeed(job.speed_bps)}</span>
                      )}
                      {job.eta_formatted && job.status === "running" && (
                        <span>ETA {job.eta_formatted}</span>
                      )}
                      {job.error_message && (
                        <span className="text-red-400">{job.error_message}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {job.status === "running" && (
                      <button
                        onClick={() => handleCancel(job.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-600 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                        Cancel
                      </button>
                    )}
                    {job.status === "completed" && job.local_path && (
                      <>
                        <a
                          href={`file://${job.local_path}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-600 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
                        >
                          <FolderOpen className="w-4 h-4" />
                          Reveal
                        </a>
                        <a
                          href={job.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-600 p-2 text-gray-400 hover:text-white hover:border-gray-500"
                          title="Open source"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </>
                    )}
                  </div>
                </div>

                {job.total_bytes && (
                  <div className="mt-3 h-2 w-full rounded-full bg-gray-700 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        job.status === "failed"
                          ? "bg-red-500"
                          : job.status === "completed"
                            ? "bg-green-500"
                            : "bg-blue-500"
                      }`}
                      style={{ width: `${Math.min(job.percent, 100)}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
