import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  ChevronRight,
  Cpu,
  Download,
  Globe,
  HardDrive,
  MessageSquare,
  ScrollText,
  Search,
  Settings,
  Trash2,
} from "lucide-react";

interface Section {
  id: string;
  title: string;
  icon: typeof BookOpen;
  content: React.ReactNode;
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 mt-4 text-lg font-medium text-gray-200">{children}</h3>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 text-sm leading-relaxed text-gray-300">{children}</p>;
}

function Ul({ children }: { children: React.ReactNode }) {
  return <ul className="mb-3 list-disc space-y-1 pl-5 text-sm text-gray-300">{children}</ul>;
}

function Li({ children }: { children: React.ReactNode }) {
  return <li>{children}</li>;
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 rounded-lg border border-blue-800 bg-blue-900/20 p-3 text-sm text-blue-100">
      {children}
    </div>
  );
}

const SECTIONS: Section[] = [
  {
    id: "overview",
    title: "Overview",
    icon: BookOpen,
    content: (
      <>
        <P>
          AI Model Browser is a desktop app for discovering, downloading, and running local AI
          models on your own hardware. It bundles a Python FastAPI backend (the sidecar) with a
          React frontend inside a Tauri v2 shell.
        </P>
        <P>
          The app works with models from Hugging Face, popular runners such as Ollama and LM
          Studio, and supports hardware-profile matching so you can see whether a model will fit
          your GPU, RAM, and CPU before downloading anything.
        </P>
        <Note>
          The backend runs automatically when the app starts. If you ever need to inspect it, open
          the Logs panel from the top navigation.
        </Note>
      </>
    ),
  },
  {
    id: "dashboard",
    title: "Dashboard",
    icon: HardDrive,
    content: (
      <>
        <P>
          The Dashboard is the home screen. It shows a grid of cards that jump to each major
          section of the app:
        </P>
        <Ul>
          <Li>
            <strong>Backend Status</strong> — Shows whether the bundled backend sidecar is online.
          </Li>
          <Li>
            <strong>Discover Models</strong> — Search Hugging Face for downloadable models.
          </Li>
          <Li>
            <strong>Hardware Profiles</strong> — Create and pick the hardware profile used for
            compatibility checks.
          </Li>
          <Li>
            <strong>Local Library</strong> — Browse and launch models already on disk.
          </Li>
          <Li>
            <strong>Downloads</strong> — Track active and completed download jobs.
          </Li>
          <Li>
            <strong>Runner Settings</strong> — Configure detected runners and default paths.
          </Li>
          <Li>
            <strong>Test Chat</strong> — Send a prompt to a local model through a runner.
          </Li>
        </Ul>
      </>
    ),
  },
  {
    id: "discover",
    title: "Discover Models",
    icon: Globe,
    content: (
      <>
        <P>
          Discover lets you search Hugging Face for model families and individual downloadable
          files. Use the tabs to switch between:
        </P>
        <Ul>
          <Li>
            <strong>Popular</strong> — Most-downloaded model families.
          </Li>
          <Li>
            <strong>Trending</strong> — Currently trending model families.
          </Li>
          <Li>
            <strong>Search</strong> — Type a query (for example <em>llama</em>, <em>qwen</em>, or{" "}
            <em>mistral</em>) and press Enter.
          </Li>
        </Ul>
        <H3>Filters</H3>
        <Ul>
          <Li>
            <strong>Capability</strong> — LLM, Vision, Tool Use, Reasoning, Coding, Embedding,
            Audio, Multimodal.
          </Li>
          <Li>
            <strong>Format</strong> — GGUF, Safetensors, MLX, Pickled, ONNX, EXL2, or All formats.
          </Li>
        </Ul>
        <P>
          Each result shows the author, capabilities, a short description, and a compatibility badge
          for your active hardware profile. Expand a family to see individual files, their sizes, and
          download buttons.
        </P>
        <H3>Download targets</H3>
        <Ul>
          <Li>
            <strong>Default folder</strong> — Saves to the app&apos;s default downloads location.
          </Li>
          <Li>
            <strong>LM Studio folder</strong> — Moves the file into the LM Studio models folder after
            completion.
          </Li>
          <Li>
            <strong>Ollama import</strong> — Converts and imports the model into Ollama after
            completion.
          </Li>
        </Ul>
      </>
    ),
  },
  {
    id: "downloads",
    title: "Downloads",
    icon: Download,
    content: (
      <>
        <P>
          The Downloads page tracks every file you queue from Discover. For each job you can see:
        </P>
        <Ul>
          <Li>File name, total size, and downloaded bytes.</Li>
          <Li>Progress percentage and current status (queued, downloading, completed, failed).</Li>
          <Li>Whether the download was resumed from a previous partial file.</Li>
        </Ul>
        <H3>Bandwidth limiting</H3>
        <P>
          Set a global bandwidth cap in MB/s. The download engine uses a token bucket to keep the
          average throughput under the cap. Enter <strong>0</strong> or leave the field empty for
          unlimited speed.
        </P>
        <H3>Resume support</H3>
        <P>
          The downloader stores partial files on disk and issues HTTP Range requests when a server
          supports them. If you restart the app, an interrupted download can pick up where it left
          off.
        </P>
        <P>
          Use the <strong>Cancel</strong> button to stop a running job, or the{" "}
          <strong>Delete</strong> button to remove a completed or failed job from the list.
        </P>
      </>
    ),
  },
  {
    id: "library",
    title: "Local Library",
    icon: Search,
    content: (
      <>
        <P>
          The Local Library lists AI model files already on your Mac. To populate the library,
          select one or more folders and run a scan.
        </P>
        <H3>Scanning</H3>
        <Ul>
          <Li>Click Add folders and choose directories containing model files.</Li>
          <Li>
            The scanner looks for common formats such as GGUF, Safetensors, Pickled (.bin/.pt), MLX,
            ONNX, and EXL2.
          </Li>
          <Li>Each discovered file is grouped by model family when possible.</Li>
        </Ul>
        <H3>Launching and runners</H3>
        <P>
          Select an item to see which runners can launch it. If you prefer a specific runner for a
          file, set it with the runner dropdown. Use the Launch button to start the runner with the
          selected file.
        </P>
        <P>
          The Import to Ollama option converts a GGUF file into an Ollama model so you can chat with
          it through the Ollama CLI or the in-app Test Chat.
        </P>
      </>
    ),
  },
  {
    id: "hardware",
    title: "Hardware Profiles",
    icon: Cpu,
    content: (
      <>
        <P>
          A hardware profile describes the machine you want to run models on. The active profile is
          used by Discover to colour-code compatibility badges.
        </P>
        <H3>Creating a profile</H3>
        <Ul>
          <Li>Click Create profile and give it a name.</Li>
          <Li>
            Enter RAM, VRAM (or check Unified memory for Apple Silicon), CPU, GPU, and operating
            system.
          </Li>
          <Li>Save and then select it as the active profile.</Li>
        </Ul>
        <H3>Auto-detected specs</H3>
        <P>
          The app can read your current machine&apos;s RAM and basic CPU/GPU info. Use that as a
          starting point, then edit the profile to match a different target machine if needed.
        </P>
      </>
    ),
  },
  {
    id: "runners",
    title: "Runner Settings",
    icon: Settings,
    content: (
      <>
        <P>
          Runners are external programs that load and execute model files. The Runner Settings page
          detects installed runners on your system.
        </P>
        <Ul>
          <Li>
            <strong>Ollama</strong> — API server usually running on <code>http://localhost:11434</code>.
          </Li>
          <Li>
            <strong>LM Studio</strong> — Local server mode, usually on{" "}
            <code>http://localhost:1234</code>.
          </Li>
          <Li>
            <strong>llama.cpp / other OpenAI-compatible runners</strong> — Any server exposing{" "}
            <code>/v1/chat/completions</code>.
          </Li>
        </Ul>
        <P>
          For each runner you can edit the executable or endpoint path, default arguments, and
          whether it should be used by default.
        </P>
        <Note>
          The app only detects runners that are installed and reachable. Install Ollama or LM Studio
          separately if they do not appear in the list.
        </Note>
      </>
    ),
  },
  {
    id: "chat",
    title: "Test Chat",
    icon: MessageSquare,
    content: (
      <>
        <P>
          Test Chat lets you send a prompt to a model through one of the configured runners. It is
          useful for quickly verifying that a downloaded or imported model works.
        </P>
        <H3>Using Test Chat</H3>
        <Ul>
          <Li>Choose a model from your Local Library.</Li>
          <Li>Pick the runner you want to use (Ollama, LM Studio, etc.).</Li>
          <Li>Type a prompt and press Enter or click Send.</Li>
          <Li>The response streams in token-by-token using Server-Sent Events.</Li>
        </Ul>
        <P>
          If the runner returns an error, the error text appears in the chat area. Check the Runner
          Settings and Logs panels if a model fails to load.
        </P>
      </>
    ),
  },
  {
    id: "logs",
    title: "Logs Panel",
    icon: ScrollText,
    content: (
      <>
        <P>
          The Logs button in the top navigation opens a live view of backend sidecar output. It is
          helpful when:
        </P>
        <Ul>
          <Li>The startup overlay stays visible longer than expected.</Li>
          <Li>A download, scan, or chat request fails.</Li>
          <Li>You want to confirm the backend is listening on the expected port.</Li>
        </Ul>
        <P>
          Logs include both stdout and stderr lines. Use the Clear button to reset the displayed
          buffer, or close the panel with the X button.
        </P>
        <Note>
          The bundled backend listens on <code>127.0.0.1:8000</code> by default. If another process
          is already using that port, the sidecar may fail to start. The Logs panel shows the
          failure details.
        </Note>
      </>
    ),
  },
  {
    id: "tips",
    title: "Tips & Troubleshooting",
    icon: Trash2,
    content: (
      <>
        <H3>Search shows no results</H3>
        <Ul>
          <Li>Check the Backend Status card on the Dashboard.</Li>
          <Li>Open the Logs panel and confirm the backend started without errors.</Li>
          <Li>Verify your internet connection can reach huggingface.co.</Li>
        </Ul>
        <H3>Downloads are slow</H3>
        <Ul>
          <Li>Try a different mirror or download from the Hugging Face website directly.</Li>
          <Li>Make sure the bandwidth cap on the Downloads page is not set too low.</Li>
          <Li>Hugging Face rate-limits anonymous traffic; a free account token may improve speeds.</Li>
        </Ul>
        <H3>A runner is not detected</H3>
        <Ul>
          <Li>Confirm the runner is installed and its server is running.</Li>
          <Li>Check the executable or API endpoint path in Runner Settings.</Li>
          <Li>Restart the app after installing a new runner.</Li>
        </Ul>
        <H3>App data and database</H3>
        <P>
          The bundled backend stores its SQLite database and settings in the Tauri app data
          directory. On macOS this is inside your user Library folder under Application Support.
        </P>
      </>
    ),
  },
];

export default function Manual() {
  const [activeId, setActiveId] = useState<string>("overview");
  const contentRef = useRef<HTMLDivElement>(null);

  const activeSection = useMemo(
    () => SECTIONS.find((s) => s.id === activeId) ?? SECTIONS[0],
    [activeId],
  );

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeId]);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <div className="mx-auto flex max-w-7xl gap-6 p-8">
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-8 rounded-xl border border-gray-800 bg-gray-800/50 p-4">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
              <BookOpen className="h-5 w-5 text-blue-400" />
              User Manual
            </h2>
            <nav className="space-y-1">
              {SECTIONS.map((section) => {
                const Icon = section.icon;
                const isActive = activeId === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveId(section.id)}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      isActive
                        ? "bg-blue-600 text-white"
                        : "text-gray-300 hover:bg-gray-700 hover:text-white"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {section.title}
                    {isActive && <ChevronRight className="ml-auto h-4 w-4" />}
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="mb-6 lg:hidden">
            <label htmlFor="manual-select" className="sr-only">
              Select a topic
            </label>
            <select
              id="manual-select"
              value={activeId}
              onChange={(e) => setActiveId(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
            >
              {SECTIONS.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.title}
                </option>
              ))}
            </select>
          </header>

          <div
            ref={contentRef}
            className="rounded-xl border border-gray-800 bg-gray-800/50 p-6 lg:p-8"
          >
            <div className="mb-6 flex items-center gap-3">
              <activeSection.icon className="h-7 w-7 text-blue-400" />
              <h1 className="text-2xl font-bold text-white">{activeSection.title}</h1>
            </div>
            <div className="prose prose-invert max-w-none">{activeSection.content}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
