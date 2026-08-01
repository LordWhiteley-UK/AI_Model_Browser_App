import { useUpdater } from "../hooks/useUpdater";
import { Download, X } from "lucide-react";
import { useState } from "react";

export default function UpdateNotification() {
  const update = useUpdater();
  const [dismissed, setDismissed] = useState(false);

  if (update.checking || !update.available || dismissed) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border border-blue-700 bg-blue-900/90 p-4 text-white shadow-lg">
      <div className="flex items-start gap-3">
        <Download className="mt-0.5 h-5 w-5 text-blue-300" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold">Update available</h3>
          <p className="mt-1 text-xs text-blue-100">
            AI Model Browser {update.version} is ready to download.
          </p>
          {update.body && (
            <p className="mt-1 max-h-24 overflow-y-auto text-xs text-blue-200">
              {update.body}
            </p>
          )}
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="rounded p-1 text-blue-200 hover:bg-blue-800"
          aria-label="Dismiss update notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
