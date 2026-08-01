import {
  ExternalLink,
  Github,
  Heart,
  Info,
  Layers,
  Shield,
} from "lucide-react";

interface CreditItem {
  name: string;
  description: string;
  license: string;
  url?: string;
}

const CREDITS: CreditItem[] = [
  {
    name: "Tauri",
    description: "Rust-based desktop app shell",
    license: "MIT / Apache-2.0",
    url: "https://tauri.app/",
  },
  {
    name: "React",
    description: "Frontend UI library",
    license: "MIT",
    url: "https://react.dev/",
  },
  {
    name: "Vite",
    description: "Frontend build tool",
    license: "MIT",
    url: "https://vitejs.dev/",
  },
  {
    name: "Tailwind CSS",
    description: "Utility-first CSS framework",
    license: "MIT",
    url: "https://tailwindcss.com/",
  },
  {
    name: "FastAPI",
    description: "Python web framework for the backend",
    license: "MIT",
    url: "https://fastapi.tiangolo.com/",
  },
  {
    name: "Uvicorn",
    description: "ASGI server",
    license: "BSD-3-Clause",
    url: "https://www.uvicorn.org/",
  },
  {
    name: "SQLModel",
    description: "SQL databases in Python, designed for models",
    license: "MIT",
    url: "https://sqlmodel.tiangolo.com/",
  },
  {
    name: "Hugging Face Hub",
    description: "Model discovery and download utilities",
    license: "Apache-2.0",
    url: "https://huggingface.co/",
  },
  {
    name: "Lucide",
    description: "Icon library",
    license: "ISC",
    url: "https://lucide.dev/",
  },
  {
    name: "PyInstaller",
    description: "Packages the Python backend as a single-file sidecar",
    license: "GPL-2.0-or-later with exception",
    url: "https://pyinstaller.org/",
  },
];

function Link({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300"
    >
      {children}
      <ExternalLink className="h-3.5 w-3.5" />
    </a>
  );
}

export default function About() {
  return (
    <div className="min-h-screen bg-gray-900 p-8 text-gray-100">
      <div className="mx-auto max-w-4xl rounded-xl border border-gray-800 bg-gray-800/50 p-8 shadow-sm">
        <div className="mb-8 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-blue-600/20">
            <Info className="h-8 w-8 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">AI Model Browser</h1>
            <p className="text-sm text-gray-400">Version 0.1.0</p>
          </div>
        </div>

        <section className="mb-8">
          <p className="text-sm leading-relaxed text-gray-300">
            AI Model Browser is an open-source desktop app for discovering, downloading,
            and running local AI models on your own hardware. It wraps a FastAPI + SQLite
            backend inside a Tauri v2 shell and presents a React + Tailwind CSS interface
            for browsing Hugging Face, scanning local model folders, and chatting with
            models through Ollama, LM Studio, llama.cpp, and other OpenAI-compatible
            runners.
          </p>
        </section>

        <section className="mb-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-white">
              <Github className="h-4 w-4 text-gray-400" />
              Source code
            </div>
            <Link href="https://github.com/LordWhiteley-UK/AI_Model_Browser_App">
              GitHub repository
            </Link>
          </div>

          <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-white">
              <BookIcon />
              Documentation
            </div>
            <p className="text-sm text-gray-300">
              Open the{" "}
              <span className="font-medium text-white">Help</span> page from the top
              navigation for the full user manual.
            </p>
          </div>

          <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-white">
              <Layers className="h-4 w-4 text-gray-400" />
              Architecture
            </div>
            <p className="text-sm text-gray-300">
              Tauri v2 desktop shell · React 18 + TypeScript · FastAPI + Uvicorn + SQLModel
              · SQLite database · PyInstaller sidecar
            </p>
          </div>

          <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-white">
              <Shield className="h-4 w-4 text-gray-400" />
              License
            </div>
            <p className="text-sm text-gray-300">
              Released under the MIT License. See the repository for the full license text.
            </p>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
            <Heart className="h-5 w-5 text-red-400" />
            Third-party credits
          </h2>
          <div className="overflow-hidden rounded-lg border border-gray-700">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-800 text-xs font-medium uppercase text-gray-400">
                <tr>
                  <th className="px-4 py-2">Project</th>
                  <th className="px-4 py-2">Use</th>
                  <th className="px-4 py-2">License</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {CREDITS.map((credit) => (
                  <tr key={credit.name} className="hover:bg-gray-800/50">
                    <td className="px-4 py-2">
                      {credit.url ? (
                        <Link href={credit.url}>{credit.name}</Link>
                      ) : (
                        credit.name
                      )}
                    </td>
                    <td className="px-4 py-2 text-gray-300">{credit.description}</td>
                    <td className="px-4 py-2 text-gray-400">{credit.license}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="text-xs text-gray-500">
          <p>
            Built with Tauri v2 · Bundle identifier{" "}
            <code className="rounded bg-gray-800 px-1 py-0.5 font-mono text-gray-400">
              com.aimodelbrowser.desktop
            </code>
          </p>
        </section>
      </div>
    </div>
  );
}

function BookIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-gray-400"
    >
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}
