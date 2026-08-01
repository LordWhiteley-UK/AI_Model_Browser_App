import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  BookOpen,
  Command,
  Download,
  Globe,
  HardDrive,
  Info,
  LayoutDashboard,
  Link2,
  MessageSquare,
  ScrollText,
  Search,
  Server,
  Settings2,
  X,
} from "lucide-react";

type ViewId =
  | "dashboard"
  | "discover"
  | "downloads"
  | "library"
  | "hardware"
  | "runners"
  | "chat"
  | "manual"
  | "about"
  | "settings";

interface Action {
  id: ViewId | "logs" | "discover-url" | "discover-search";
  title: string;
  subtitle: string;
  icon: typeof Command;
  section: string;
}

const ACTIONS: Action[] = [
  {
    id: "dashboard",
    title: "Dashboard",
    subtitle: "Go to the home dashboard",
    icon: LayoutDashboard,
    section: "Navigation",
  },
  {
    id: "discover",
    title: "Discover Models",
    subtitle: "Search Hugging Face models",
    icon: Globe,
    section: "Navigation",
  },
  {
    id: "downloads",
    title: "Downloads",
    subtitle: "Track model downloads",
    icon: Download,
    section: "Navigation",
  },
  {
    id: "library",
    title: "Local Library",
    subtitle: "Manage downloaded models",
    icon: Archive,
    section: "Navigation",
  },
  {
    id: "hardware",
    title: "Hardware Profiles",
    subtitle: "Configure target machines",
    icon: HardDrive,
    section: "Navigation",
  },
  {
    id: "runners",
    title: "Runner Settings",
    subtitle: "Detect and configure runners",
    icon: Server,
    section: "Navigation",
  },
  {
    id: "chat",
    title: "Test Chat",
    subtitle: "Prompt a local model",
    icon: MessageSquare,
    section: "Navigation",
  },
  {
    id: "manual",
    title: "User Manual",
    subtitle: "Open the in-app help",
    icon: BookOpen,
    section: "Navigation",
  },
  {
    id: "settings",
    title: "Settings",
    subtitle: "App preferences and paths",
    icon: Settings2,
    section: "Navigation",
  },
  {
    id: "about",
    title: "About",
    subtitle: "Version, credits, and license",
    icon: Info,
    section: "Navigation",
  },
  {
    id: "logs",
    title: "Backend Logs",
    subtitle: "Open the backend log viewer",
    icon: ScrollText,
    section: "Actions",
  },
  {
    id: "discover-url",
    title: "Import Model from URL",
    subtitle: "Paste a Hugging Face model link",
    icon: Link2,
    section: "Actions",
  },
  {
    id: "discover-search",
    title: "Search Models",
    subtitle: "Open the Discover search tab",
    icon: Search,
    section: "Actions",
  },
];

function scoreMatch(query: string, target: string): number {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (t === q) return 1000;
  if (t.startsWith(q)) return 500;
  if (t.includes(q)) return 250;

  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length ? 100 : 0;
}

function filterActions(query: string): Action[] {
  const trimmed = query.trim();
  if (!trimmed) return ACTIONS;
  return ACTIONS.map((action) => {
    const text = `${action.title} ${action.subtitle} ${action.id}`;
    return { action, score: scoreMatch(trimmed, text) };
  })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.action);
}

export default function CommandPalette({
  open,
  onClose,
  onNavigate,
  onShowLogs,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (view: ViewId, discoverMode?: "url" | "search") => void;
  onShowLogs: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => filterActions(query), [query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelected((prev) => Math.min(prev + 1, filtered.length - 1));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelected((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const action = filtered[selected];
        if (action) runAction(action);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, filtered, selected, onClose]);

  useEffect(() => {
    const selectedItem = listRef.current?.children[selected] as
      | HTMLElement
      | undefined;
    selectedItem?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  function runAction(action: Action) {
    if (action.id === "logs") {
      onShowLogs();
    } else if (action.id === "discover-url") {
      onNavigate("discover", "url");
    } else if (action.id === "discover-search") {
      onNavigate("discover", "search");
    } else {
      onNavigate(action.id as ViewId);
    }
    onClose();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-24"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex w-full max-w-2xl flex-col rounded-xl border border-gray-700 bg-gray-900 shadow-2xl">
        <div className="flex items-center gap-3 border-b border-gray-800 px-4 py-3">
          <Command className="h-5 w-5 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands and views…"
            className="flex-1 bg-transparent text-base text-white placeholder:text-gray-500 focus:outline-none"
          />
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          ref={listRef}
          className="max-h-[60vh] overflow-y-auto p-2"
          role="listbox"
        >
          {filtered.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-gray-400">
              No matching commands.
            </div>
          )}

          {filtered.map((action, index) => {
            const Icon = action.icon;
            const isSelected = index === selected;
            return (
              <button
                key={action.id}
                role="option"
                aria-selected={isSelected}
                onClick={() => runAction(action)}
                onMouseEnter={() => setSelected(index)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                  isSelected
                    ? "bg-blue-600 text-white"
                    : "text-gray-300 hover:bg-gray-800"
                }`}
              >
                <Icon
                  className={`h-5 w-5 shrink-0 ${
                    isSelected ? "text-white" : "text-gray-400"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{action.title}</p>
                  <p
                    className={`text-xs ${
                      isSelected ? "text-blue-100" : "text-gray-500"
                    }`}
                  >
                    {action.subtitle}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-xs ${
                    isSelected ? "text-blue-100" : "text-gray-600"
                  }`}
                >
                  {action.section}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between border-t border-gray-800 px-4 py-2 text-xs text-gray-500">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="rounded bg-gray-800 px-1.5 py-0.5">↑</kbd>{" "}
              <kbd className="rounded bg-gray-800 px-1.5 py-0.5">↓</kbd> to
              navigate
            </span>
            <span>
              <kbd className="rounded bg-gray-800 px-1.5 py-0.5">↵</kbd> to
              select
            </span>
          </div>
          <span>
            <kbd className="rounded bg-gray-800 px-1.5 py-0.5">esc</kbd> to
            close
          </span>
        </div>
      </div>
    </div>
  );
}

export type { ViewId };
