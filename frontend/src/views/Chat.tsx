import { useEffect, useRef, useState } from "react";
import { getInventory, getLauncherInfo, streamChat } from "../api/client";
import type { ChatMessage, LocalInventoryItem } from "../types";
import {
  AlertCircle,
  Bot,
  Cpu,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  User,
} from "lucide-react";

const SUPPORTED_CHAT_RUNNERS = ["ollama", "llama_cpp", "lm_studio"];

export default function Chat() {
  const [items, setItems] = useState<LocalInventoryItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [selectedRunner, setSelectedRunner] = useState<string>("ollama");
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [itemRunners, setItemRunners] = useState<Record<number, string[]>>({});
  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  async function loadItems() {
    try {
      const data = await getInventory();
      setItems(data);
      const runners: Record<number, string[]> = {};
      await Promise.all(
        data.map(async (item) => {
          try {
            const info = await getLauncherInfo(item.id);
            runners[item.id] = info.runners
              .map((r) => r.id)
              .filter((id) => SUPPORTED_CHAT_RUNNERS.includes(id));
          } catch {
            runners[item.id] = [];
          }
        }),
      );
      setItemRunners(runners);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load library");
    } finally {
      setLoadingItems(false);
    }
  }

  useEffect(() => {
    loadItems();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const selectedItem = items.find((i) => i.id === selectedItemId);
  const availableRunners = selectedItemId ? itemRunners[selectedItemId] ?? [] : [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedItemId || !selectedRunner || !prompt.trim() || busy) return;

    const userPrompt = prompt.trim();
    setPrompt("");
    setBusy(true);
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: userPrompt }]);

    abortRef.current = streamChat(
      selectedItemId,
      selectedRunner,
      userPrompt,
      (streamMessages) => {
        setMessages((prev) => {
          const withoutAssistant = prev.filter((m) => m.role !== "assistant");
          return [...withoutAssistant, ...streamMessages.slice(-1)];
        });
      },
      (err) => {
        setError(err);
        setBusy(false);
      },
      () => {
        setBusy(false);
      },
    );
  }

  function handleCancel() {
    abortRef.current?.abort();
    setBusy(false);
  }

  function handleClear() {
    handleCancel();
    setMessages([]);
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <MessageSquare className="w-8 h-8 text-blue-400" />
          Test Chat
        </h1>
        <p className="text-gray-400 mt-1">
          Send prompts to a loaded model through its runner.
        </p>
      </header>

      {error && (
        <div className="mb-6 flex items-start gap-2 rounded-lg bg-red-900/30 p-3 text-red-200">
          <AlertCircle className="mt-0.5 w-4 h-4" />
          {error}
        </div>
      )}

      <section className="mb-6 rounded-xl border border-gray-700 bg-gray-800 p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5 min-w-[16rem]">
            <label className="text-xs font-medium text-gray-400">Model file</label>
            <select
              value={selectedItemId ?? ""}
              onChange={(e) => {
                const id = Number(e.target.value);
                setSelectedItemId(id || null);
                const runners = itemRunners[id] ?? [];
                if (runners.length > 0 && !runners.includes(selectedRunner)) {
                  setSelectedRunner(runners[0]);
                }
              }}
              className="rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="">{loadingItems ? "Loading…" : "Select a model file"}</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.filename}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5 min-w-[12rem]">
            <label className="text-xs font-medium text-gray-400">Runner</label>
            <select
              value={selectedRunner}
              onChange={(e) => setSelectedRunner(e.target.value)}
              disabled={!selectedItemId || availableRunners.length === 0}
              className="rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none disabled:opacity-50"
            >
              {availableRunners.length === 0 ? (
                <option value="">No chat runner</option>
              ) : (
                availableRunners.map((runner) => (
                  <option key={runner} value={runner}>
                    {runner === "ollama"
                      ? "Ollama"
                      : runner === "llama_cpp"
                        ? "llama.cpp server"
                        : runner === "lm_studio"
                          ? "LM Studio"
                          : runner}
                  </option>
                ))
              )}
            </select>
          </div>

          <button
            onClick={loadItems}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-gray-600 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh library
          </button>
        </div>

        {selectedItem && (
          <p className="mt-3 text-xs text-gray-500 truncate">
            {selectedItem.local_path}
          </p>
        )}
      </section>

      <section className="flex flex-col rounded-xl border border-gray-700 bg-gray-800 shadow-sm" style={{ height: "60vh" }}>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-gray-500">
              <Bot className="mb-2 h-10 w-10" />
              <p>Select a model file and runner, then send a prompt.</p>
              <p className="mt-1 text-sm">
                Make sure the runner server is already running.
              </p>
            </div>
          ) : (
            messages.map((message, index) => (
              <div
                key={index}
                className={`flex gap-3 ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-xl px-4 py-3 ${
                    message.role === "user"
                      ? "bg-blue-900/40 text-blue-100"
                      : "bg-gray-700 text-gray-100"
                  }`}
                >
                  <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-gray-400">
                    {message.role === "user" ? (
                      <User className="h-3 w-3" />
                    ) : (
                      <Cpu className="h-3 w-3" />
                    )}
                    {message.role === "user" ? "You" : "Assistant"}
                  </div>
                  <div className="whitespace-pre-wrap text-sm">{message.content}</div>
                </div>
              </div>
            ))
          )}
          {busy && (
            <div className="flex items-center gap-2 text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Thinking…
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form
          onSubmit={handleSubmit}
          className="border-t border-gray-700 p-4"
        >
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Type a prompt…"
              disabled={busy || !selectedItemId || !selectedRunner}
              className="flex-1 rounded-lg border border-gray-600 bg-gray-900 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none disabled:opacity-50"
            />
            {busy ? (
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-lg bg-red-900/40 px-4 py-2.5 text-sm font-medium text-red-300 hover:bg-red-900/60"
              >
                Stop
              </button>
            ) : (
              <button
                type="submit"
                disabled={!prompt.trim() || !selectedItemId || !selectedRunner}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                Send
              </button>
            )}
          </div>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              className="mt-2 text-xs text-gray-500 hover:text-gray-300"
            >
              Clear conversation
            </button>
          )}
        </form>
      </section>
    </div>
  );
}
